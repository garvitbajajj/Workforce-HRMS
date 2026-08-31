const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Pool } = require('pg')
const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production'

const normalizeRole = (role) => (role === 'manager' ? 'team_leader' : role)
const isAdminOrHrRole = (role) => ['admin', 'hr'].includes(normalizeRole(role))
const isTeamLeaderRole = (role) => normalizeRole(role) === 'team_leader'

// ── Auth Middleware ────────────────────────────────────────────────────────────
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Invalid token' }) }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(normalizeRole(req.user.role))) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// ── Auth Routes ────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const { rows } = await pool.query('SELECT u.*, e.first_name, e.last_name, e.id as emp_id FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.email = $1', [email])
    if (!rows[0]) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    const role = normalizeRole(rows[0].role)
    const token = jwt.sign({ id: rows[0].id, role, employeeId: rows[0].emp_id, email }, JWT_SECRET, { expiresIn: '8h' })
    res.json({ token, user: { id: rows[0].id, email, role, employeeId: rows[0].emp_id, firstName: rows[0].first_name, lastName: rows[0].last_name } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Employee Routes ────────────────────────────────────────────────────────────
app.get('/api/employees', auth, async (req, res) => {
  try {
    const role = normalizeRole(req.user.role)
    let query = `
      SELECT e.*, d.name as dept_name, u.email, u.role,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE 1=1`
    const params = []
    if (role === 'employee') {
      query += ` AND e.id = $${params.length + 1}`
      params.push(req.user.employeeId)
    } else if (role === 'team_leader') {
      query += ` AND (e.id = $${params.length + 1} OR e.manager_id = $${params.length + 1})`
      params.push(req.user.employeeId)
    }
    query += ' ORDER BY e.created_at DESC'
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/employees', auth, requireRole('admin', 'hr'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { firstName, lastName, email, password, phone, departmentId, designation, joiningDate, salary, managerId, empCode, role, initialPaidBalance, carriedForward } = req.body
    const hash = await bcrypt.hash(password || 'pass123', 10)
    const { rows: [user] } = await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id', [email, hash, role || 'employee'])
    const { rows: [emp] } = await client.query('INSERT INTO employees (user_id, emp_code, first_name, last_name, phone, department_id, designation, joining_date, salary, manager_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [user.id, empCode, firstName, lastName, phone, departmentId, designation, joiningDate, salary, managerId || null])
    await client.query('INSERT INTO leave_balances (employee_id, year, paid_balance, carried_forward) VALUES ($1,$2,$3,$4)', [emp.id, new Date().getFullYear(), initialPaidBalance || 0, carriedForward || 0])
    await client.query('COMMIT')
    res.json(emp)
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }) }
  finally { client.release() }
})

app.put('/api/employees/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { firstName, lastName, phone, departmentId, designation, salary, managerId } = req.body
    const { rows } = await pool.query('UPDATE employees SET first_name=$1, last_name=$2, phone=$3, department_id=$4, designation=$5, salary=$6, manager_id=$7 WHERE id=$8 RETURNING *', [firstName, lastName, phone, departmentId, designation, salary, managerId || null, req.params.id])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/employees/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM employees WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/employees/bulk', auth, requireRole('admin', 'hr'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const results = []
    for (const emp of req.body.employees) {
      const hash = await bcrypt.hash(emp.password || 'pass123', 10)
      const { rows: [user] } = await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id', [emp.email, hash, emp.role || 'employee'])
      const { rows: [e] } = await client.query('INSERT INTO employees (user_id, emp_code, first_name, last_name, phone, department_id, designation, joining_date, salary, manager_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [user.id, emp.empCode, emp.firstName, emp.lastName, emp.phone, emp.departmentId, emp.designation, emp.joiningDate, emp.salary, emp.managerId || null])
      await client.query('INSERT INTO leave_balances (employee_id, year, paid_balance, carried_forward) VALUES ($1,$2,$3,$4)', [e.id, new Date().getFullYear(), emp.initialPaidBalance || 0, emp.carriedForward || 0])
      results.push(e)
    }
    await client.query('COMMIT')
    res.json({ imported: results.length })
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }) }
  finally { client.release() }
})

// ── Attendance Routes ──────────────────────────────────────────────────────────
app.post('/api/attendance/clock-in', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const existing = await pool.query('SELECT id FROM attendance_logs WHERE employee_id=$1 AND work_date=$2', [req.user.employeeId, today])
    if (existing.rows[0]) return res.status(400).json({ error: 'Already clocked in today' })
    const now = new Date()
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)
    const { rows } = await pool.query('INSERT INTO attendance_logs (employee_id, work_date, clock_in, is_late, ip_address, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.user.employeeId, today, now.toISOString(), isLate, req.ip, 'present'])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/attendance/clock-out', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { rows: [log] } = await pool.query('SELECT * FROM attendance_logs WHERE employee_id=$1 AND work_date=$2', [req.user.employeeId, today])
    if (!log) return res.status(400).json({ error: 'Not clocked in' })
    if (log.clock_out) return res.status(400).json({ error: 'Already clocked out' })
    const now = new Date()
    const minutes = (now - new Date(log.clock_in)) / 60000
    const hoursWorked = parseFloat((minutes / 60).toFixed(2))
    const earlyLogout = now.getHours() < 17 || (now.getHours() === 17 && now.getMinutes() < 30)
    const { rows } = await pool.query('UPDATE attendance_logs SET clock_out=$1, hours_worked=$2, early_logout=$3 WHERE id=$4 RETURNING *', [now.toISOString(), hoursWorked, earlyLogout, log.id])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/attendance', auth, async (req, res) => {
  try {
    const { from, to, employeeId } = req.query
    let q = 'SELECT a.*, e.first_name, e.last_name, e.emp_code FROM attendance_logs a JOIN employees e ON e.id = a.employee_id WHERE 1=1'
    const params = []
    const role = normalizeRole(req.user.role)
    if (role === 'employee') { q += ` AND a.employee_id = $${params.length + 1}`; params.push(req.user.employeeId) }
    else if (role === 'team_leader') {
      const { rows: teamRows } = await pool.query('SELECT id FROM employees WHERE manager_id=$1 OR id=$1', [req.user.employeeId])
      const teamIds = teamRows.map(row => row.id)
      if (employeeId) {
        if (!teamIds.includes(employeeId)) return res.status(403).json({ error: 'Forbidden' })
        q += ` AND a.employee_id = $${params.length + 1}`
        params.push(employeeId)
      } else if (teamIds.length) {
        q += ` AND a.employee_id = ANY($${params.length + 1})`
        params.push(teamIds)
      }
    } else if (employeeId) { q += ` AND a.employee_id = $${params.length + 1}`; params.push(employeeId) }
    if (from) { q += ` AND a.work_date >= $${params.length + 1}`; params.push(from) }
    if (to) { q += ` AND a.work_date <= $${params.length + 1}`; params.push(to) }
    q += ' ORDER BY a.work_date DESC'
    const { rows } = await pool.query(q, params)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Leave Routes ───────────────────────────────────────────────────────────────
app.get('/api/leaves', auth, async (req, res) => {
  try {
    let q = `SELECT l.*, e.first_name, e.last_name, e.emp_code, d.name as dept_name FROM leave_requests l JOIN employees e ON e.id = l.employee_id LEFT JOIN departments d ON d.id = e.department_id WHERE 1=1`
    const params = []
    const role = normalizeRole(req.user.role)
    if (role === 'employee') { q += ` AND l.employee_id = $${params.length + 1}`; params.push(req.user.employeeId) }
    else if (role === 'team_leader') {
      const { rows: teamRows } = await pool.query('SELECT id FROM employees WHERE manager_id=$1 OR id=$1', [req.user.employeeId])
      const teamIds = teamRows.map(row => row.id)
      if (teamIds.length) { q += ` AND l.employee_id = ANY($${params.length + 1})`; params.push(teamIds) }
    }
    q += ' ORDER BY l.created_at DESC'
    const { rows } = await pool.query(q, params)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/leaves', auth, async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason, totalDays } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [leave] } = await client.query('INSERT INTO leave_requests (employee_id, start_date, end_date, total_days, leave_type, reason, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [req.user.employeeId, startDate, endDate, totalDays, leaveType, reason, 'pending'])
      const { rows: employees } = await client.query('SELECT e.id, e.manager_id, u.role FROM employees e LEFT JOIN users u ON u.id = e.user_id')
      const requester = employees.find(emp => emp.id === req.user.employeeId)
      const recipientIds = new Set()
      if (requester?.manager_id) recipientIds.add(requester.manager_id)
      employees.filter(emp => isAdminOrHrRole(emp.role) && emp.id !== req.user.employeeId).forEach(emp => recipientIds.add(emp.id))
      for (const recipientId of recipientIds) {
        await client.query('INSERT INTO notifications (employee_id, title, message, type) VALUES ($1,$2,$3,$4)', [recipientId, 'New Leave Request', `A new leave request for ${startDate} to ${endDate} was submitted.`, 'warning'])
      }
      await client.query('COMMIT')
      res.json(leave)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/leaves/:id/approve', auth, requireRole('admin', 'hr', 'team_leader'), async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [req_] } = await client.query('SELECT * FROM leave_requests WHERE id=$1', [req.params.id])
    if (!req_) return res.status(404).json({ error: 'Not found' })
    if (normalizeRole(req.user.role) === 'team_leader') {
      const { rows: [managed] } = await client.query('SELECT id FROM employees WHERE id=$1 AND manager_id=$2', [req_.employee_id, req.user.employeeId])
      if (!managed) return res.status(403).json({ error: 'Forbidden' })
    }
    await client.query('UPDATE leave_requests SET status=$1, approved_by=$2 WHERE id=$3', ['approved', req.user.employeeId, req.params.id])
    if (req_.leave_type === 'paid') {
      await client.query('UPDATE leave_balances SET paid_balance = GREATEST(0, paid_balance - $1) WHERE employee_id=$2 AND year=$3', [req_.total_days, req_.employee_id, new Date().getFullYear()])
    } else {
      await client.query('UPDATE leave_balances SET unpaid_balance = unpaid_balance + $1 WHERE employee_id=$2 AND year=$3', [req_.total_days, req_.employee_id, new Date().getFullYear()])
    }
    const { rows: [employee] } = await client.query('SELECT e.id, e.manager_id FROM employees e WHERE e.id = $1', [req_.employee_id])
    if (employee?.manager_id) {
      await client.query('INSERT INTO notifications (employee_id, title, message, type) VALUES ($1,$2,$3,$4)', [employee.manager_id, 'Leave Approved', `Leave request for ${req_.start_date} to ${req_.end_date} was approved.`, 'success'])
    }
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }) }
  finally { client.release() }
})

app.put('/api/leaves/:id/reject', auth, requireRole('admin', 'hr', 'team_leader'), async (req, res) => {
  try {
    const { rows: [leave] } = await pool.query('SELECT * FROM leave_requests WHERE id=$1', [req.params.id])
    if (!leave) return res.status(404).json({ error: 'Not found' })
    if (normalizeRole(req.user.role) === 'team_leader') {
      const { rows: [managed] } = await pool.query('SELECT id FROM employees WHERE id=$1 AND manager_id=$2', [leave.employee_id, req.user.employeeId])
      if (!managed) return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('UPDATE leave_requests SET status=$1, rejection_note=$2 WHERE id=$3', ['rejected', req.body.reason, req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/leaves/:id/cancel', auth, async (req, res) => {
  try {
    const { rows: [leave] } = await pool.query('SELECT * FROM leave_requests WHERE id=$1', [req.params.id])
    if (!leave) return res.status(404).json({ error: 'Not found' })
    if (normalizeRole(req.user.role) !== 'employee' || leave.employee_id !== req.user.employeeId) return res.status(403).json({ error: 'Forbidden' })
    if (leave.status !== 'pending') return res.status(400).json({ error: 'Only pending leave requests can be cancelled' })
    await pool.query('UPDATE leave_requests SET status=$1, updated_at=NOW() WHERE id=$2', ['cancelled', req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Leave Balance Routes ────────────────────────────────────────────────────────
app.get('/api/leave-balances', auth, async (req, res) => {
  try {
    const empId = req.user.role === 'employee' ? req.user.employeeId : (req.query.employeeId || null)
    let q = 'SELECT * FROM leave_balances WHERE year=$1'
    const params = [new Date().getFullYear()]
    if (empId) { q += ` AND employee_id = $${params.length + 1}`; params.push(empId) }
    const { rows } = await pool.query(q, params)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/leave-balances/:employeeId', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { paidBalance, carriedForward, unpaidBalance } = req.body
    await pool.query('UPDATE leave_balances SET paid_balance=$1, carried_forward=$2, unpaid_balance=$3 WHERE employee_id=$4 AND year=$5', [paidBalance, carriedForward, unpaidBalance, req.params.employeeId, new Date().getFullYear()])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Departments ────────────────────────────────────────────────────────────────
app.get('/api/departments', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM departments ORDER BY name')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Notifications ──────────────────────────────────────────────────────────────
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notifications WHERE employee_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.employeeId])
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`HRMS API running on port ${PORT}`))
