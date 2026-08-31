import { createContext, useContext, useState, useEffect } from 'react'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { supabase } from './supabaseClient.js'
import ErrorOverlay from './components/ErrorOverlay.jsx'
import * as leaveService from './services/leaveService.js'

const HRMSContext = createContext(null)

const normalizeRole = (role) => (role === 'manager' ? 'team_leader' : role)

const BETA_TESTERS = [
  'preeti@huntsmenbarons.com',
  'palak@huntsmenbarons.com',
  'sonal.garg@huntsmenbarons.com',
  'gaurav.rajak@huntsmenbarons.com',
  'soumya.tiwari@huntsmenbarons.com',
  'pratiksha.dhankar@huntsmenbarons.com',
  'nikita.lahadke@huntsmenbarons.com',
  'arpita.udole@huntsmenbarons.com'
]

const isBetaTester = (email) => {
  if (!email) return false
  const e = email.toLowerCase()
  return BETA_TESTERS.includes(e) || e.endsWith('@company.com')
}

const isAllowedAdmin = (email) => {
  if (!email) return false
  const e = email.toLowerCase()
  return e.endsWith('@huntsmenbarons.com') || e.endsWith('@company.com') || BETA_TESTERS.includes(e)
}

const isAdminOrHrRole = (role, email) => {
  const norm = normalizeRole(role)
  if (['admin', 'hr'].includes(norm)) {
    return isAllowedAdmin(email)
  }
  return false
}

const isTeamLeaderRole = (role) => normalizeRole(role) === 'team_leader'

// ── Database Models mapping to UI CamelCase models ──────────────────────────────
function mapEmployeeFromDb(dbEmp) {
  if (!dbEmp) return null
  const nameParts = dbEmp.full_name ? dbEmp.full_name.split(' ') : ['', '']
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  return {
    id: dbEmp.id,
    userId: dbEmp.user_id,
    empCode: dbEmp.employee_code,
    firstName,
    lastName,
    email: dbEmp.email,
    phone: dbEmp.phone,
    departmentId: dbEmp.department,
    designation: dbEmp.designation,
    role: normalizeRole(dbEmp.role),
    joiningDate: dbEmp.joining_date,
    salary: dbEmp.salary,
    managerId: dbEmp.manager_id,
    gender: dbEmp.gender,
    am: dbEmp.am,
    grade: dbEmp.grade,
    level: dbEmp.level,
    dojMonth: dbEmp.doj_month,
    jobRole: dbEmp.job_role,
    emergencyContact: dbEmp.emergency_contact,
    bankDetails: dbEmp.bank_details,
    workLocation: dbEmp.work_location,
    dateOfBirth: dbEmp.date_of_birth,
    isDev: dbEmp.is_dev || false,
    avatar: dbEmp.full_name ? dbEmp.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'
  }
}

export function HRMSProvider({ children }) {
  const [state, setState] = useState({
    auth: { currentUser: null, isAuthenticated: false, error: null, isPasswordRecovery: false },
    employees: [],
    departments: [],
    attendanceLogs: [],
    leaveBalances: [],
    leaveRequests: [],
    notifications: [],
    holidays: [],
    attendanceCorrections: [],
    users: []
  })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('employee')
  const [globalError, setGlobalError] = useState(null)

  const throwUIError = (err) => {
    console.error('UI Error Triggered:', err)
    const message = err?.message || String(err)
    const stack = err?.stack || ''
    const title = err?.name || 'Error'
    setGlobalError({ title, message, stack })
  }

  useEffect(() => {
    if (state.auth.currentUser) {
      const role = state.auth.currentUser.role
      setViewMode(['admin', 'hr'].includes(role) ? 'admin' : 'employee')
    } else {
      setViewMode('employee')
    }
  }, [state.auth.currentUser?.id, state.auth.currentUser?.role])

  // ── Load All Data from Supabase ───────────────────────────────────────────────
  const loadAllData = async (user) => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch current employee
      const { data: dbEmp, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (empErr) throw empErr

      if (!dbEmp) {
        // Logged in user but no employee profile yet (e.g. newly signed up user)
        setState(s => ({
          ...s,
          auth: {
            currentUser: { id: user.id, email: user.email, role: 'employee', employee: null },
            isAuthenticated: true,
            error: null,
            isPasswordRecovery: s.auth.isPasswordRecovery
          }
        }))
        setLoading(false)
        return
      }

      const mappedEmp = mapEmployeeFromDb(dbEmp)
      const normalizedRole = normalizeRole(dbEmp.role)
      const isAdminOrHr = isAdminOrHrRole(normalizedRole, user.email)
      const isTeamLeader = isTeamLeaderRole(normalizedRole)

      // 2. Fetch Employees (based on role permissions)
      let empsQuery = supabase.from('employees').select('*')
      if (!isAdminOrHr) {
        if (isTeamLeader) {
          empsQuery = empsQuery.or(`id.eq.${dbEmp.id},manager_id.eq.${dbEmp.id}`)
        } else {
          empsQuery = empsQuery.eq('id', dbEmp.id)
        }
      }
      const { data: emps } = await empsQuery
      const accessibleEmployeeIds = (emps || []).map(emp => emp.id)

      // 3. Fetch Departments
      const { data: depts } = await supabase.from('departments').select('*')

      // 4. Fetch Holidays
      const { data: hols } = await supabase.from('holidays').select('*')

      // 5. Fetch Attendance
      let attQuery = supabase.from('attendance').select('*')
      if (!isAdminOrHr) {
        if (isTeamLeader && accessibleEmployeeIds.length) {
          attQuery = attQuery.in('employee_id', accessibleEmployeeIds)
        } else {
          attQuery = attQuery.eq('employee_id', dbEmp.id)
        }
      }
      const { data: att } = await attQuery

      // 6. Fetch Leave Balances
      let balQuery = supabase.from('leave_balances').select('*, leave_types(*)')
      if (!isAdminOrHr) {
        balQuery = balQuery.eq('employee_id', dbEmp.id)
      }
      const { data: lb } = await balQuery

      // 7. Fetch Leave Requests
      let lrQuery = supabase.from('leave_requests').select('*, leave_types(*)')
      if (!isAdminOrHr) {
        if (isTeamLeader && accessibleEmployeeIds.length) {
          lrQuery = lrQuery.in('employee_id', accessibleEmployeeIds)
        } else {
          lrQuery = lrQuery.eq('employee_id', dbEmp.id)
        }
      }
      const { data: lr } = await lrQuery

      // 8. Fetch Notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('employee_id', dbEmp.id)

      // 9. Fetch Attendance Corrections
      let corrQuery = supabase.from('attendance_corrections').select('*')
      if (!isAdminOrHr) {
        if (isTeamLeader && accessibleEmployeeIds.length) {
          corrQuery = corrQuery.in('employee_id', accessibleEmployeeIds)
        } else {
          corrQuery = corrQuery.eq('employee_id', dbEmp.id)
        }
      }
      const { data: corrections } = await corrQuery

      // ── Process and Map to state ────────────────────────────────────────────────
      const employees = (emps || []).map(mapEmployeeFromDb)
      const departments = (depts || []).map(d => ({ id: d.name, name: d.name, headId: d.head_id }))
      const holidays = (hols || []).map(h => ({
        id: h.id,
        date: h.date,
        name: h.name,
        pune: h.pune !== false,
        indore: h.indore !== false,
        noida: h.noida !== false,
        bangalore: h.bangalore !== false
      }))

      const attendanceLogs = (att || []).map(a => ({
        id: a.id,
        employeeId: a.employee_id,
        workDate: a.date,
        clockIn: a.clock_in,
        clockOut: a.clock_out,
        hoursWorked: a.working_hours,
        isLate: a.is_late,
        earlyLogout: a.early_logout,
        ipAddress: a.clock_in_ip || '0.0.0.0',
        status: a.status
      }))

      const leaveBalances = (employees || []).map(emp => {
        const empLbs = (lb || []).filter(b => b.employee_id === emp.id)
        const plRow = empLbs.find(b => b.leave_types?.code === 'PL') || empLbs.find(b => b.leave_types?.is_paid !== false)
        const ulRow = empLbs.find(b => b.leave_types?.code === 'UL') || empLbs.find(b => b.leave_types?.is_paid === false)

        const unpaidUsed = (lr || [])
          .filter(r => r.employee_id === emp.id && r.status === 'approved' && r.leave_types?.is_paid === false)
          .reduce((sum, r) => sum + r.total_days, 0)

        return {
          id: plRow?.id || ulRow?.id || emp.id,
          employeeId: emp.id,
          year: plRow?.year || ulRow?.year || new Date().getFullYear(),
          paidBalance: (plRow?.total_allocated || 0) - (plRow?.used_days || 0),
          unpaidBalance: ulRow && ulRow.used_days !== null && ulRow.used_days !== undefined ? ulRow.used_days : unpaidUsed,
          carriedForward: plRow?.carry_forward_days || 0,
          usedDays: plRow?.used_days || 0
        }
      })

      const leaveRequests = (lr || []).map(l => ({
        id: l.id,
        employeeId: l.employee_id,
        approvedBy: l.approved_by,
        startDate: l.from_date,
        endDate: l.to_date,
        totalDays: l.total_days,
        leaveType: l.leave_types?.is_paid ? 'paid' : 'unpaid',
        status: l.status,
        reason: l.reason,
        rejectionNote: l.rejection_reason,
        createdAt: l.created_at
      }))

      const notifications = (notifs || []).map(n => {
        let displayType = 'info'
        if (n.title && n.title.startsWith('🎂')) displayType = 'birthday'
        else if (n.type === 'error' || n.type === 'leave_rejected') displayType = 'danger'
        else if (n.type === 'leave_request' || n.type === 'warning') displayType = 'warning'
        else if (n.type === 'leave_approved' || n.type === 'success') displayType = 'success'
        return {
          id: n.id,
          employeeId: n.employee_id,
          title: n.title,
          message: n.message,
          type: displayType,
          isRead: n.is_read,
          acknowledgedBy: n.acknowledged_by || [],
          reactions: n.reactions || {},
          createdAt: n.created_at
        }
      })

      const attendanceCorrections = (corrections || []).map(c => ({
        id: c.id,
        employeeId: c.employee_id,
        workDate: c.work_date,
        clockIn: c.clock_in,
        clockOut: c.clock_out,
        reason: c.reason,
        status: c.status,
        approvedBy: c.approved_by,
        createdAt: c.created_at
      }))

      setState(s => ({
        ...s,
        auth: {
          currentUser: { id: user.id, email: user.email, role: isAdminOrHr ? normalizedRole : (isTeamLeader ? 'team_leader' : 'employee'), employee: mappedEmp },
          isAuthenticated: true,
          error: null,
          isPasswordRecovery: s.auth.isPasswordRecovery
        },
        employees,
        departments,
        attendanceLogs,
        leaveBalances,
        leaveRequests,
        notifications,
        holidays,
        attendanceCorrections,
        users: []
      }))
    } catch (err) {
      console.error('Error loading HRMS data:', err)
      throwUIError(err)
    } finally {
      setLoading(false)
    }
  }

  // ── Monitor Auth State Changes ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (!isBetaTester(session.user.email)) {
          supabase.auth.signOut()
          setState(s => ({
            ...s,
            auth: { currentUser: null, isAuthenticated: false, error: 'Access is temporarily restricted to beta testers.', isPasswordRecovery: false }
          }))
          setLoading(false)
        } else {
          loadAllData(session.user)
        }
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (!isBetaTester(session.user.email)) {
          supabase.auth.signOut()
          setState({
            auth: { currentUser: null, isAuthenticated: false, error: 'Access is temporarily restricted to beta testers.', isPasswordRecovery: false },
            employees: [],
            departments: [],
            attendanceLogs: [],
            leaveBalances: [],
            leaveRequests: [],
            notifications: [],
            holidays: [],
            users: []
          })
        } else {
          loadAllData(session.user)
          if (event === 'PASSWORD_RECOVERY') {
            setState(s => ({
              ...s,
              auth: {
                ...s.auth,
                isPasswordRecovery: true
              }
            }))
          }
        }
      } else {
        setState({
          auth: { currentUser: null, isAuthenticated: false, error: null, isPasswordRecovery: false },
          employees: [],
          departments: [],
          attendanceLogs: [],
          leaveBalances: [],
          leaveRequests: [],
          notifications: [],
          holidays: [],
          users: []
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Auto-check birthdays once per session ────────────────────────────────────
  const birthdayChecked = useState(false)
  useEffect(() => {
    if (state.auth.isAuthenticated && !birthdayChecked[0]) {
      birthdayChecked[1](true)
        // Run birthday check directly (dispatch not yet available in scope)
        ; (async () => {
          try {
            const today = format(new Date(), 'MM-dd')
            const todayStart = format(new Date(), 'yyyy-MM-dd')
            const { data: allEmps } = await supabase.from('employees').select('id, full_name, date_of_birth')
            if (!allEmps) return

            const birthdayPeople = allEmps.filter(e => {
              if (!e.date_of_birth) return false
              return e.date_of_birth.slice(5) === today
            })

            if (birthdayPeople.length === 0) return

            for (const bday of birthdayPeople) {
              const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .like('title', `Happy Birthday%`)
                .like('message', `%${bday.full_name}%`)
                .gte('created_at', todayStart + 'T00:00:00')
                .limit(1)

              if (existing && existing.length > 0) continue

              const recipients = allEmps.map(e => e.id)
              const inserts = recipients.map(recipientId => ({
                employee_id: recipientId,
                title: `Happy Birthday, ${bday.full_name}!`,
                message: `Today is ${bday.full_name}'s birthday! Wish them a wonderful day!`,
                type: 'info'
              }))

              await supabase.from('notifications').insert(inserts)
            }

            // Reload to pick up new birthday notifications
            if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          } catch (err) {
            console.error('Birthday check error:', err)
          }
        })()
    }
  }, [state.auth.isAuthenticated])

  // ── Dispatch Handler (Supabase Mutations) ──────────────────────────────────────
  const dispatch = async (action) => {
    try {
      switch (action.type) {
        case 'LOGIN': {
          setState(s => ({ ...s, auth: { ...s.auth, error: null } }))
          if (!isBetaTester(action.email)) {
            setState(s => ({ ...s, auth: { ...s.auth, error: 'Access is temporarily restricted to beta testers.' } }))
            return { error: 'Access is temporarily restricted to beta testers.' }
          }
          const { data, error } = await supabase.auth.signInWithPassword({
            email: action.email,
            password: action.password
          })
          if (error) {
            setState(s => ({ ...s, auth: { ...s.auth, error: error.message } }))
            return { error: error.message }
          }
          await loadAllData(data.user)
          break
        }
        case 'LOGOUT': {
          await supabase.auth.signOut()
          setState({
            auth: { currentUser: null, isAuthenticated: false, error: null },
            employees: [],
            departments: [],
            attendanceLogs: [],
            leaveBalances: [],
            leaveRequests: [],
            notifications: [],
            holidays: [],
            users: []
          })
          break
        }
        case 'CLOCK_IN': {
          const today = format(new Date(), 'yyyy-MM-dd')
          const now = new Date()
          const deploymentStartDate = new Date('2026-06-16T00:00:00')
          const isDeploymentActive = now >= deploymentStartDate
          const existingLog = state.attendanceLogs.find(l => l.employeeId === action.employeeId && l.workDate === today)
          const isLate = existingLog 
            ? existingLog.isLate 
            : (isDeploymentActive && (now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() > 0)))

          let clockInTime = now
          if (existingLog && existingLog.hoursWorked) {
            const prevMs = existingLog.hoursWorked * 3600000
            clockInTime = new Date(now.getTime() - prevMs)
          }

          // Refund previous deduction for today if the user is clocking in again
          let refundDeduct = 0
          if (existingLog && isDeploymentActive) {
            if (existingLog.status === 'absent') {
              refundDeduct = 1.0
            } else if (existingLog.status === 'half_day') {
              refundDeduct = 0.5
            }
          }

          if (refundDeduct > 0) {
            const year = new Date().getFullYear()
            const { data: bal, error: balFetchErr } = await supabase
              .from('leave_balances')
              .select('*')
              .eq('employee_id', action.employeeId)
              .eq('year', year)
              .maybeSingle()

            if (balFetchErr) throw balFetchErr

            if (bal) {
              const { error: balUpdateErr } = await supabase.from('leave_balances').update({
                used_days: Math.max(0, bal.used_days - refundDeduct)
              }).eq('id', bal.id)
              
              if (balUpdateErr) throw balUpdateErr
            }
          }

          const initialStatus = isLate ? 'half_day' : 'present'

          const { error } = await supabase.from('attendance').upsert({
            employee_id: action.employeeId,
            date: today,
            clock_in: clockInTime.toISOString(),
            clock_in_ip: action.ip,
            status: initialStatus,
            is_late: isLate,
            clock_out: null
          }, { onConflict: 'employee_id,date' })

          if (error) throw error

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'CLOCK_OUT': {
          const now = new Date()
          const log = state.attendanceLogs.find(l => l.id === action.logId)
          if (!log) throw new Error('Attendance log not found')

          const clockInTime = new Date(log.clockIn)
          const clockOutTime = now
          const minutes = (clockOutTime - clockInTime) / 60000
          const hoursWorked = parseFloat((minutes / 60).toFixed(2))

          let status = 'present'
          let deductLeave = 0

          const deploymentStartDate = new Date('2026-06-16T00:00:00')
          const isDeploymentActive = now >= deploymentStartDate

          if (isDeploymentActive) {
            if (hoursWorked < 5.0) {
              status = 'absent'
              deductLeave = 1.0
            } else if (hoursWorked < 9.0 || log.isLate) {
              status = 'half_day'
              deductLeave = 0.5
            } else {
              status = 'present'
            }
          } else {
            status = 'present'
          }


          const { error: updateErr } = await supabase.from('attendance').update({
            clock_out: clockOutTime.toISOString(),
            early_logout: hoursWorked < 9.0,
            status: status
          }).eq('id', action.logId)

          if (updateErr) throw updateErr

          if (deductLeave > 0) {
            const year = new Date().getFullYear()
            const { data: bal, error: balFetchErr } = await supabase
              .from('leave_balances')
              .select('*')
              .eq('employee_id', log.employeeId)
              .eq('year', year)
              .maybeSingle()

            if (balFetchErr) throw balFetchErr

            if (bal) {
              const { error: balUpdateErr } = await supabase.from('leave_balances').update({
                used_days: bal.used_days + deductLeave
              }).eq('id', bal.id)
              
              if (balUpdateErr) throw balUpdateErr
            }
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'SUBMIT_LEAVE': {
          const res = await leaveService.submitLeaveRequest(
            action.request.employeeId,
            action.request,
            action.managerId,
            action.employeeName
          )
          setState(s => ({
            ...s,
            leaveRequests: [res.request, ...s.leaveRequests],
            notifications: [...res.notifications, ...s.notifications]
          }))
          break
        }
        case 'APPROVE_LEAVE': {
          const res = await leaveService.approveLeaveRequest(action.id, action.approverId)
          setState(s => ({
            ...s,
            leaveRequests: s.leaveRequests.map(r => r.id === res.request.id ? res.request : r),
            leaveBalances: s.leaveBalances.map(b => b.employeeId === res.balance.employeeId ? res.balance : b),
            notifications: [res.notification, ...s.notifications]
          }))
          break
        }
        case 'REJECT_LEAVE': {
          const res = await leaveService.rejectLeaveRequest(action.id, action.reason, action.approverId)
          setState(s => ({
            ...s,
            leaveRequests: s.leaveRequests.map(r => r.id === res.request.id ? res.request : r),
            notifications: [res.notification, ...s.notifications]
          }))
          break
        }
        case 'CANCEL_LEAVE': {
          const res = await leaveService.cancelLeaveRequest(action.id, action.employeeId, action.employeeName)
          setState(s => ({
            ...s,
            leaveRequests: s.leaveRequests.map(r => r.id === res.request.id ? res.request : r),
            notifications: [...res.notifications, ...s.notifications]
          }))
          break
        }
        case 'ADD_EMPLOYEE': {
          // Signup the new employee's authentication account
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: action.employee.email,
            password: action.employee.password || 'pass123',
            options: {
              data: {
                role: normalizeRole(action.employee.role || 'employee')
              }
            }
          })
          if (authError) throw authError

          const { data: emp, error: empError } = await supabase.from('employees').insert({
            user_id: authData.user.id,
            employee_code: action.employee.empCode,
            full_name: `${action.employee.firstName} ${action.employee.lastName}`,
            email: action.employee.email,
            phone: action.employee.phone,
            department: action.employee.departmentId || 'Engineering',
            designation: action.employee.designation,
            role: normalizeRole(action.employee.role || 'employee'),
            joining_date: action.employee.joiningDate,
            salary: action.employee.salary,
            manager_id: action.employee.managerId || null,
            status: 'active',
            gender: action.employee.gender || null,
            am: action.employee.am || null,
            grade: action.employee.grade || null,
            level: action.employee.level || null,
            doj_month: action.employee.dojMonth || null,
            job_role: action.employee.jobRole || null,
            emergency_contact: action.employee.emergencyContact || null,
            bank_details: action.employee.bankDetails || null
          }).select().single()

          if (empError) throw empError

          const { data: lt } = await supabase
            .from('leave_types')
            .select('id')
            .eq('code', 'PL')
            .single()

          if (lt) {
            await supabase.from('leave_balances').insert({
              employee_id: emp.id,
              leave_type_id: lt.id,
              year: new Date().getFullYear(),
              total_allocated: action.employee.initialPaidBalance || 0,
              carry_forward_days: action.employee.carriedForward || 0
            })
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'BULK_ADD_EMPLOYEES': {
          for (const emp of action.employees) {
            const { data: authData, error: authError } = await supabase.auth.signUp({
              email: emp.email,
              password: emp.password || 'pass123',
              options: {
                data: {
                  role: normalizeRole(emp.role || 'employee')
                }
              }
            })
            if (authError) continue // Skip on auth error for safety, or log

            const { data: dbEmp } = await supabase.from('employees').insert({
              user_id: authData.user.id,
              employee_code: emp.empCode,
              full_name: `${emp.firstName} ${emp.lastName}`,
              email: emp.email,
              phone: emp.phone,
              department: emp.departmentId || 'Engineering',
              designation: emp.designation,
              role: normalizeRole(emp.role || 'employee'),
              joining_date: emp.joiningDate,
              salary: emp.salary,
              manager_id: emp.managerId || null,
              status: 'active'
            }).select().single()

            const { data: lt } = await supabase
              .from('leave_types')
              .select('id')
              .eq('code', 'PL')
              .single()

            if (dbEmp && lt) {
              await supabase.from('leave_balances').insert({
                employee_id: dbEmp.id,
                leave_type_id: lt.id,
                year: new Date().getFullYear(),
                total_allocated: parseFloat(emp.initialPaidBalance) || 0,
                carry_forward_days: parseFloat(emp.carriedForward) || 0
              })
            }
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'UPDATE_EMPLOYEE': {
          const updateData = {}
          if (action.data.firstName !== undefined && action.data.lastName !== undefined) {
            updateData.full_name = `${action.data.firstName} ${action.data.lastName}`
          }
          if (action.data.phone !== undefined) updateData.phone = action.data.phone
          if (action.data.empCode !== undefined) updateData.employee_code = action.data.empCode
          if (action.data.departmentId !== undefined) updateData.department = action.data.departmentId
          if (action.data.designation !== undefined) updateData.designation = action.data.designation
          if (action.data.role !== undefined) updateData.role = action.data.role
          if (action.data.joiningDate !== undefined) updateData.joining_date = action.data.joiningDate
          if (action.data.salary !== undefined) updateData.salary = parseFloat(action.data.salary) || 0
          if (action.data.managerId !== undefined) updateData.manager_id = action.data.managerId || null
          if (action.data.gender !== undefined) updateData.gender = action.data.gender || null
          if (action.data.am !== undefined) updateData.am = action.data.am || null
          if (action.data.grade !== undefined) updateData.grade = action.data.grade || null
          if (action.data.level !== undefined) updateData.level = action.data.level || null
          if (action.data.dojMonth !== undefined) updateData.doj_month = action.data.dojMonth || null
          if (action.data.jobRole !== undefined) updateData.job_role = action.data.jobRole || null
          if (action.data.emergencyContact !== undefined) updateData.emergency_contact = action.data.emergencyContact || null
          if (action.data.bankDetails !== undefined) updateData.bank_details = action.data.bankDetails || null
          if (action.data.dateOfBirth !== undefined) updateData.date_of_birth = action.data.dateOfBirth || null

          const { error: updateError } = await supabase.from('employees').update(updateData).eq('id', action.id)
          if (updateError) throw updateError

          if (action.data.changePassword) {
            const employeeRecord = state.employees.find(e => e.id === action.id)
            const targetEmail = employeeRecord?.email || action.data.email
            if (!targetEmail) throw new Error('Employee email not found')
            const { error: passError } = await supabase.rpc('admin_change_password', {
              target_email: targetEmail,
              new_password: action.data.changePassword
            })
            if (passError) throw passError
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'DELETE_EMPLOYEE': {
          await supabase.from('employees').delete().eq('id', action.id)
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'MARK_NOTIF_READ': {
          await supabase.from('notifications').update({ is_read: true }).eq('id', action.id)
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'MARK_ALL_READ': {
          await supabase.from('notifications').update({ is_read: true }).eq('employee_id', action.employeeId)
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'REQUEST_PASSWORD_RESET': {
          const { error } = await supabase.rpc('request_password_reset', { user_email: action.email })
          if (error) throw error
          break
        }
        case 'DISMISS_RECOVERY': {
          setState(s => ({
            ...s,
            auth: {
              ...s.auth,
              isPasswordRecovery: false
            }
          }))
          break
        }
        case 'ACK_NOTIFICATION': {
          // Acknowledge a notification (thumbs up)
          const { data: notifData } = await supabase
            .from('notifications')
            .select('acknowledged_by')
            .eq('id', action.notifId)
            .single()

          const existingAcks = notifData?.acknowledged_by || []
          if (!existingAcks.includes(action.employeeId)) {
            await supabase.from('notifications').update({
              acknowledged_by: [...existingAcks, action.employeeId]
            }).eq('id', action.notifId)
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'REACT_NOTIFICATION': {
          const { notifId, employeeId, emoji } = action
          const { data: notifData } = await supabase
            .from('notifications')
            .select('reactions')
            .eq('id', notifId)
            .single()

          const currentReactions = notifData?.reactions || {}
          const updatedReactions = { ...currentReactions }
          
          const emojiUsers = updatedReactions[emoji] || []
          if (emojiUsers.includes(employeeId)) {
            updatedReactions[emoji] = emojiUsers.filter(id => id !== employeeId)
            if (updatedReactions[emoji].length === 0) {
              delete updatedReactions[emoji]
            }
          } else {
            updatedReactions[emoji] = [...emojiUsers, employeeId]
          }

          await supabase.from('notifications').update({
            reactions: updatedReactions
          }).eq('id', notifId)

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'SUBMIT_CORRECTION': {
          const { employeeId, workDate, clockIn, clockOut, reason } = action.correction
          
          const { error: submitErr } = await supabase.from('attendance_corrections').upsert({
            employee_id: employeeId,
            work_date: workDate,
            clock_in: clockIn,
            clock_out: clockOut,
            reason: reason,
            status: 'pending',
            approved_by: null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'employee_id,work_date' })

          if (submitErr) throw submitErr

          const { data: allEmployees } = await supabase
            .from('employees')
            .select('id, role, manager_id, email')

          const recipientIds = new Set()
          const submitter = (allEmployees || []).find(emp => emp.id === employeeId)

          if (submitter?.manager_id) recipientIds.add(submitter.manager_id)
          ; (allEmployees || [])
            .filter(emp => isAdminOrHrRole(emp.role, emp.email) && emp.id !== employeeId)
            .forEach(emp => recipientIds.add(emp.id))

          for (const recipientId of recipientIds) {
            await supabase.from('notifications').insert({
              employee_id: recipientId,
              title: 'Attendance Correction Request',
              message: `${action.employeeName} has requested attendance correction for ${workDate}.`,
              type: 'warning'
            })
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'APPROVE_CORRECTION': {
          const { correctionId, approverId } = action
          
          // Get the correction request
          const { data: corr, error: corrErr } = await supabase
            .from('attendance_corrections')
            .select('*')
            .eq('id', correctionId)
            .single()

          if (corrErr || !corr) throw new Error('Correction request not found')

          // Mark correction as approved
          await supabase.from('attendance_corrections').update({
            status: 'approved',
            approved_by: approverId,
            updated_at: new Date().toISOString()
          }).eq('id', correctionId)

          // Calculate hours worked
          const cin = new Date(corr.clock_in)
          const cout = new Date(corr.clock_out)
          const minutes = (cout - cin) / 60000
          const hoursWorked = parseFloat((minutes / 60).toFixed(2))

          // Check if it's late / early logout
          const isLate = cin.getHours() > 12 || (cin.getHours() === 12 && cin.getMinutes() > 0)
          const earlyLogout = hoursWorked < 9.0

          const workDate = new Date(corr.work_date)
          const deploymentStartDate = new Date('2026-06-16T00:00:00')
          const isDeploymentActive = workDate >= deploymentStartDate

          let status = 'present'
          let deductLeave = 0
          if (isDeploymentActive) {
            if (hoursWorked < 5.0) {
              status = 'absent'
              deductLeave = 1.0
            } else if (hoursWorked < 9.0 || isLate) {
              status = 'half_day'
              deductLeave = 0.5
            }
          }

          // Fetch existing attendance status to adjust leave balance deduction
          const { data: existingLog } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', corr.employee_id)
            .eq('date', corr.work_date)
            .maybeSingle()

          let prevDeduct = 0
          if (existingLog && isDeploymentActive) {
            if (existingLog.status === 'absent') {
              prevDeduct = 1.0
            } else if (existingLog.status === 'half_day') {
              prevDeduct = 0.5
            }
          }

          const netDeduct = deductLeave - prevDeduct
          if (netDeduct !== 0) {
            const year = new Date(corr.work_date).getFullYear()
            const { data: bal, error: balFetchErr } = await supabase
              .from('leave_balances')
              .select('*')
              .eq('employee_id', corr.employee_id)
              .eq('year', year)
              .maybeSingle()

            if (balFetchErr) throw balFetchErr

            if (bal) {
              const { error: balUpdateErr } = await supabase.from('leave_balances').update({
                used_days: Math.max(0, bal.used_days + netDeduct)
              }).eq('id', bal.id)
              
              if (balUpdateErr) throw balUpdateErr
            }
          }

          // Insert or update attendance log in supabase 'attendance' table
          const { error: upsertErr } = await supabase.from('attendance').upsert({
            employee_id: corr.employee_id,
            date: corr.work_date,
            clock_in: corr.clock_in,
            clock_out: corr.clock_out,
            status: status,
            is_late: isLate,
            early_logout: earlyLogout,
            clock_in_ip: 'Correction'
          }, { onConflict: 'employee_id,date' })

          if (upsertErr) throw upsertErr

          // Send notification to employee
          await supabase.from('notifications').insert({
            employee_id: corr.employee_id,
            title: 'Attendance Correction Approved',
            message: `Your attendance correction request for ${corr.work_date} has been approved.`,
            type: 'success'
          })

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'REJECT_CORRECTION': {
          const { correctionId, rejectionReason, approverId } = action
          
          // Get the correction request
          const { data: corr, error: corrErr } = await supabase
            .from('attendance_corrections')
            .select('*')
            .eq('id', correctionId)
            .single()

          if (corrErr || !corr) throw new Error('Correction request not found')

          // Mark correction as rejected
          await supabase.from('attendance_corrections').update({
            status: 'rejected',
            approved_by: approverId,
            updated_at: new Date().toISOString()
          }).eq('id', correctionId)

          // Send notification to employee
          const { error: notifError } = await supabase.from('notifications').insert({
            employee_id: corr.employee_id,
            title: 'Attendance Correction Rejected',
            message: `Your attendance correction request for ${corr.work_date} was rejected. Reason: ${rejectionReason || 'Not specified'}`,
            type: 'error'
          })
          if (notifError) throw notifError

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'CANCEL_CORRECTION': {
          const { correctionId } = action
          
          const { data: corr, error: corrErr } = await supabase
            .from('attendance_corrections')
            .select('*')
            .eq('id', correctionId)
            .single()

          if (corrErr || !corr) throw new Error('Correction request not found')
          if (corr.status !== 'pending') throw new Error('Only pending correction requests can be cancelled')

          await supabase.from('attendance_corrections').delete().eq('id', correctionId)

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'UPDATE_LEAVE_BALANCE': {
          const res = await leaveService.updateLeaveBalance(action.employeeId, action.data)
          setState(s => {
            const exists = s.leaveBalances.some(b => b.employeeId === res.balance.employeeId)
            const newBalances = exists
              ? s.leaveBalances.map(b => b.employeeId === res.balance.employeeId ? res.balance : b)
              : [...s.leaveBalances, res.balance]
            return {
              ...s,
              leaveBalances: newBalances
            }
          })
          break
        }
        case 'POST_NOTIFICATION': {
          const { title, message, notifType, target, senderEmpId } = action
          let recipients = []

          if (target === 'all') {
            const { data: allEmps, error: err } = await supabase
              .from('employees')
              .select('id')
            if (err) throw err
            recipients = allEmps.map(e => e.id)
          } else if (target === 'team') {
            const { data: teamEmps, error: err } = await supabase
              .from('employees')
              .select('id')
              .eq('manager_id', senderEmpId)
            if (err) throw err
            recipients = teamEmps.map(e => e.id)
          }

          if (recipients.length === 0) {
            throw new Error(target === 'team' ? 'You do not have any team members to notify.' : 'No employees found.')
          }

          const inserts = recipients.map(empId => ({
            employee_id: empId,
            title: title,
            message: message,
            type: (notifType === 'danger' ? 'error' : notifType) || 'info',
            is_read: false
          }))

          const { error: insertErr } = await supabase
            .from('notifications')
            .insert(inserts)
          if (insertErr) throw insertErr

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'ADD_HOLIDAY': {
          const { error } = await supabase.from('holidays').insert({
            name: action.holiday.name,
            date: action.holiday.date,
            pune: action.holiday.pune,
            indore: action.holiday.indore,
            noida: action.holiday.noida,
            bangalore: action.holiday.bangalore
          })
          if (error) throw error
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'EDIT_HOLIDAY': {
          const { error } = await supabase.from('holidays').update({
            name: action.holiday.name,
            date: action.holiday.date,
            pune: action.holiday.pune,
            indore: action.holiday.indore,
            noida: action.holiday.noida,
            bangalore: action.holiday.bangalore
          }).eq('id', action.holiday.id)
          if (error) throw error
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'DELETE_HOLIDAY': {
          const { error } = await supabase.from('holidays').delete().eq('id', action.id)
          if (error) throw error
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'ADD_DEPARTMENT': {
          await supabase.from('departments').insert({
            name: action.dept.name,
            head_id: action.dept.headId
          })
          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'CHECK_BIRTHDAYS': {
          // Check for today's birthdays and send notifications to all employees
          const today = format(new Date(), 'MM-dd')
          const { data: allEmps } = await supabase.from('employees').select('id, full_name, date_of_birth')
          if (!allEmps) break

          const birthdayPeople = allEmps.filter(e => {
            if (!e.date_of_birth) return false
            const dob = e.date_of_birth // format: 'YYYY-MM-DD'
            return dob.slice(5) === today // compare MM-DD
          })

          if (birthdayPeople.length === 0) break

          // For each birthday person, check if notification already sent today
          for (const bday of birthdayPeople) {
            const todayStart = format(new Date(), 'yyyy-MM-dd')
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .like('title', `Happy Birthday%`)
              .like('message', `%${bday.full_name}%`)
              .gte('created_at', todayStart + 'T00:00:00')
              .limit(1)

            if (existing && existing.length > 0) continue // Already sent today

            // Send to all employees
            const recipients = allEmps.map(e => e.id)
            const inserts = recipients.map(recipientId => ({
              employee_id: recipientId,
              title: `Happy Birthday, ${bday.full_name}!`,
              message: `Today is ${bday.full_name}'s birthday! Wish them a wonderful day!`,
              type: 'info' // stored as 'info' in DB, detected as birthday by title prefix
            }))

            await supabase.from('notifications').insert(inserts)
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        case 'ACCRUE_LEAVES': {
          const year = new Date().getFullYear()
          const { data: balances, error: fetchErr } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('year', year)

          if (fetchErr) throw fetchErr

          if (balances && balances.length > 0) {
            for (const bal of balances) {
              const { error: updateErr } = await supabase
                .from('leave_balances')
                .update({
                  total_allocated: bal.total_allocated + 1.75
                })
                .eq('id', bal.id)
              if (updateErr) console.error(`Failed to accrue leaves for bal id ${bal.id}:`, updateErr)
            }
          }

          const { data: allEmps } = await supabase.from('employees').select('id')
          if (allEmps && allEmps.length > 0) {
            const inserts = allEmps.map(emp => ({
              employee_id: emp.id,
              title: 'Monthly Leaves Accrued',
              message: '1.75 days of paid leave have been credited to your leave balance for this month.',
              type: 'success',
              is_read: false
            }))
            await supabase.from('notifications').insert(inserts)
          }

          if (state.auth.currentUser) await loadAllData(state.auth.currentUser)
          break
        }
        default:
          break
      }
    } catch (e) {
      console.error('Error dispatching action:', action.type, e)
      throwUIError(e)
    }
  }

  // ── Selectors ─────────────────────────────────────────────────────────────────
  const getEmployee = (id) => state.employees.find(e => e.id === id)
  const getDept = (id) => state.departments.find(d => d.id === id) || { id, name: id }

  const getLeaveBalance = (empId) =>
    state.leaveBalances.find(b => b.employeeId === empId) || { paidBalance: 0, unpaidBalance: 0, carriedForward: 0, usedDays: 0 }

  const getTodayLog = (empId) =>
    state.attendanceLogs.find(l => l.employeeId === empId && l.workDate === format(new Date(), 'yyyy-MM-dd'))

  const getEmpNotifs = (empId) =>
    state.notifications.filter(n => n.employeeId === empId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getEmpLeaves = (empId) =>
    state.leaveRequests.filter(l => l.employeeId === empId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getEmpAttendance = (empId) =>
    state.attendanceLogs.filter(l => l.employeeId === empId).sort((a, b) => new Date(b.workDate) - new Date(a.workDate))

  const getPendingLeaves = (managerId) => {
    const managed = managerId ? state.employees.filter(e => e.managerId === managerId).map(e => e.id) : state.employees.map(e => e.id)
    return state.leaveRequests.filter(l => l.status === 'pending' && (managerId ? managed.includes(l.employeeId) : true))
  }

  const getUpcomingHolidays = (location) => {
    let list = state.holidays
    if (location) {
      const locKey = location.toLowerCase()
      if (['pune', 'indore', 'noida', 'bangalore'].includes(locKey)) {
        list = list.filter(h => h[locKey])
      }
    }
    return list.filter(h => new Date(h.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5)
  }

  const getMonthlyStats = (empId) => {
    const logs = state.attendanceLogs.filter(l => l.employeeId === empId)
    const thisMonth = logs.filter(l => l.workDate.startsWith(format(new Date(), 'yyyy-MM')))
    const totalHours = thisMonth.reduce((s, l) => s + (l.hoursWorked || 0), 0)
    const lateDays = thisMonth.filter(l => l.isLate).length
    const presentDays = thisMonth.length
    return { totalHours: parseFloat(totalHours.toFixed(1)), lateDays, presentDays }
  }

  const getPendingCorrections = (managerId) => {
    const managed = managerId ? state.employees.filter(e => e.managerId === managerId).map(e => e.id) : state.employees.map(e => e.id)
    return state.attendanceCorrections.filter(c => c.status === 'pending' && (managerId ? managed.includes(c.employeeId) : true))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, background: '#f0f2f7', fontFamily: 'sans-serif' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e5e7ef', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}>Loading WorkForce HRMS...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <HRMSContext.Provider value={{ state, dispatch, viewMode, setViewMode, getEmployee, getDept, getLeaveBalance, getTodayLog, getEmpNotifs, getEmpLeaves, getEmpAttendance, getPendingLeaves, getUpcomingHolidays, getMonthlyStats, getPendingCorrections, throwUIError }}>
      {children}
      <ErrorOverlay error={globalError} onClose={() => setGlobalError(null)} />
    </HRMSContext.Provider>
  )
}

export const useHRMS = () => useContext(HRMSContext)
