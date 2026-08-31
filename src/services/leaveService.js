import { supabase } from '../supabaseClient.js'

// ── Private Helper Mappers ───────────────────────────────────────────────────

function mapNotification(n) {
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
}

function mapLeaveRequest(l) {
  return {
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
  }
}

function mapLeaveBalance(plRow, ulRow, employeeId, unpaidUsedVal) {
  return {
    id: plRow?.id || ulRow?.id || employeeId,
    employeeId: employeeId,
    year: plRow?.year || ulRow?.year || new Date().getFullYear(),
    paidBalance: (plRow?.total_allocated || 0) - (plRow?.used_days || 0),
    unpaidBalance: ulRow && ulRow.used_days !== null && ulRow.used_days !== undefined ? ulRow.used_days : unpaidUsedVal,
    carriedForward: plRow?.carry_forward_days || 0,
    usedDays: plRow?.used_days || 0
  }
}

// ── Exported Services ────────────────────────────────────────────────────────

export async function getLeaveBalanceForEmployee(employeeId, year = new Date().getFullYear()) {
  const { data: lbs, error: lbErr } = await supabase
    .from('leave_balances')
    .select('*, leave_types(*)')
    .eq('employee_id', employeeId)
    .eq('year', year)

  if (lbErr) throw lbErr

  // Fetch approved unpaid leaves count to calculate unpaidBalance if UL record doesn't exist
  const { data: unpaidRequests, error: reqErr } = await supabase
    .from('leave_requests')
    .select('total_days, leave_types!inner(*)')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .eq('leave_types.is_paid', false)

  if (reqErr) throw reqErr

  const unpaidUsedVal = (unpaidRequests || []).reduce((sum, r) => sum + r.total_days, 0)

  const plRow = (lbs || []).find(b => b.leave_types?.code === 'PL') || (lbs || []).find(b => b.leave_types?.is_paid !== false)
  const ulRow = (lbs || []).find(b => b.leave_types?.code === 'UL') || (lbs || []).find(b => b.leave_types?.is_paid === false)

  return mapLeaveBalance(plRow, ulRow, employeeId, unpaidUsedVal)
}

export async function submitLeaveRequest(employeeId, request, managerId, employeeName) {
  const { data: lt, error: ltErr } = await supabase
    .from('leave_types')
    .select('id, is_paid')
    .eq('code', request.leaveType === 'paid' ? 'PL' : 'UL')
    .single()

  if (ltErr || !lt) throw ltErr || new Error('Leave type not found')

  const { data: newReq, error: reqErr } = await supabase
    .from('leave_requests')
    .insert({
      employee_id: employeeId,
      leave_type_id: lt.id,
      from_date: request.startDate,
      to_date: request.endDate,
      total_days: request.totalDays,
      reason: request.reason,
      status: 'pending'
    })
    .select('*, leave_types(*)')
    .single()

  if (reqErr) throw reqErr

  const { data: allEmployees, error: empErr } = await supabase
    .from('employees')
    .select('id, role, manager_id, email')

  if (empErr) throw empErr

  const recipientIds = new Set()
  const submitter = (allEmployees || []).find(emp => emp.id === employeeId)

  if (submitter?.manager_id) recipientIds.add(submitter.manager_id)
  ;(allEmployees || [])
    .filter(emp => {
      const norm = emp.role === 'manager' ? 'team_leader' : emp.role
      if (['admin', 'hr'].includes(norm)) {
        const e = emp.email ? emp.email.toLowerCase() : ''
        return e.endsWith('@huntsmenbarons.com') || e.endsWith('@company.com') || [
          'preeti@huntsmenbarons.com',
          'palak@huntsmenbarons.com',
          'sonal.garg@huntsmenbarons.com',
          'gaurav.rajak@huntsmenbarons.com',
          'soumya.tiwari@huntsmenbarons.com',
          'pratiksha.dhankar@huntsmenbarons.com',
          'nikita.lahadke@huntsmenbarons.com',
          'arpita.udole@huntsmenbarons.com'
        ].includes(e)
      }
      return false
    })
    .forEach(emp => {
      if (emp.id !== employeeId) {
        recipientIds.add(emp.id)
      }
    })

  const notifications = []
  for (const recipientId of recipientIds) {
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        employee_id: recipientId,
        title: 'New Leave Request',
        message: `${employeeName} has requested ${request.totalDays} day(s) leave.`,
        type: 'warning'
      })
      .select()
      .single()

    if (!notifErr && notif) {
      notifications.push(mapNotification(notif))
    }
  }

  return {
    request: mapLeaveRequest(newReq),
    notifications
  }
}

export async function approveLeaveRequest(requestId, approverId) {
  const { data: reqRows, error: reqErr } = await supabase
    .from('leave_requests')
    .select('id, employee_id, total_days, from_date, to_date, status, leave_type_id, leave_types(is_paid, code)')
    .eq('id', requestId)
    .limit(1)

  const req = reqRows?.[0]
  if (reqErr || !req) throw reqErr || new Error('Leave request not found')

  const { data: updatedReqRows, error: updateErr } = await supabase
    .from('leave_requests')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_on: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('id, employee_id, total_days, from_date, to_date, status, leave_type_id, approved_by, approved_on, leave_types(is_paid, code)')
    .limit(1)

  const updatedReq = updatedReqRows?.[0]

  if (updateErr || !updatedReq) throw updateErr || new Error('Failed to update leave request')

  const year = new Date().getFullYear()
  
  if (req.leave_types?.is_paid !== false) {
    const { data: balRows, error: balFetchErr } = await supabase
      .from('leave_balances')
      .select('id, used_days, total_allocated, carry_forward_days, leave_type_id, leave_types(*)')
      .eq('employee_id', req.employee_id)
      .eq('year', year)

    if (balFetchErr) throw balFetchErr

    const paidBalance = (balRows || []).find(row => row.leave_types?.code === 'PL' || row.leave_types?.is_paid !== false)

    if (paidBalance) {
      const currentPaidBalance = Math.max(0, (paidBalance.total_allocated || 0) - (paidBalance.used_days || 0))
      const currentCarryForward = paidBalance.carry_forward_days || 0
      const paidDeduct = Math.min(req.total_days || 0, currentPaidBalance)
      const carryDeduct = Math.max(0, (req.total_days || 0) - paidDeduct)

      const { error: balUpdateErr } = await supabase
        .from('leave_balances')
        .update({
          used_days: (paidBalance.used_days || 0) + paidDeduct,
          carry_forward_days: Math.max(0, currentCarryForward - carryDeduct)
        })
        .eq('id', paidBalance.id)

      if (balUpdateErr) throw balUpdateErr
    }
  }

  const balance = await getLeaveBalanceForEmployee(req.employee_id, year)

  const { data: notifRows, error: notifErr } = await supabase
    .from('notifications')
    .insert({
      employee_id: req.employee_id,
      title: 'Leave Approved',
      message: `Your leave request for ${req.from_date} to ${req.to_date} has been approved.`,
      type: 'success'
    })
    .select()

  const notif = notifRows?.[0]

  if (notifErr || !notif) throw notifErr || new Error('Failed to create approval notification')

  return {
    request: mapLeaveRequest(updatedReq),
    balance,
    notification: mapNotification(notif)
  }
}

export async function rejectLeaveRequest(requestId, reason, approverId) {
  const { data: req, error: reqErr } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) throw reqErr || new Error('Leave request not found')

  const { data: updatedReq, error: updateErr } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      approved_by: approverId,
      approved_on: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('*, leave_types(*)')
    .single()

  if (updateErr) throw updateErr

  const { data: notif, error: notifErr } = await supabase
    .from('notifications')
    .insert({
      employee_id: req.employee_id,
      title: 'Leave Rejected',
      message: `Your leave request was rejected. Reason: ${reason}`,
      type: 'error'
    })
    .select()
    .single()

  if (notifErr) throw notifErr

  return {
    request: mapLeaveRequest(updatedReq),
    notification: mapNotification(notif)
  }
}

export async function cancelLeaveRequest(requestId, employeeId, employeeName) {
  const { data: req, error: reqErr } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqErr || !req) throw reqErr || new Error('Leave request not found')
  if (req.employee_id !== employeeId) throw new Error('You can only cancel your own leave requests')
  if (req.status !== 'pending') throw new Error('Only pending leave requests can be cancelled')

  const { data: updatedReq, error: updateErr } = await supabase
    .from('leave_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('*, leave_types(*)')
    .single()

  if (updateErr) throw updateErr

  const { data: allEmployees, error: empErr } = await supabase
    .from('employees')
    .select('id, role, manager_id, email')

  if (empErr) throw empErr

  const recipientIds = new Set()
  const submitter = (allEmployees || []).find(emp => emp.id === req.employee_id)

  if (submitter?.manager_id) recipientIds.add(submitter.manager_id)
  ;(allEmployees || [])
    .filter(emp => {
      const norm = emp.role === 'manager' ? 'team_leader' : emp.role
      if (['admin', 'hr'].includes(norm)) {
        const e = emp.email ? emp.email.toLowerCase() : ''
        return e.endsWith('@huntsmenbarons.com') || e.endsWith('@company.com') || [
          'preeti@huntsmenbarons.com',
          'palak@huntsmenbarons.com',
          'sonal.garg@huntsmenbarons.com',
          'gaurav.rajak@huntsmenbarons.com',
          'soumya.tiwari@huntsmenbarons.com',
          'pratiksha.dhankar@huntsmenbarons.com',
          'nikita.lahadke@huntsmenbarons.com',
          'arpita.udole@huntsmenbarons.com'
        ].includes(e)
      }
      return false
    })
    .forEach(emp => {
      if (emp.id !== req.employee_id) {
        recipientIds.add(emp.id)
      }
    })

  const notifications = []
  for (const recipientId of recipientIds) {
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        employee_id: recipientId,
        title: 'Leave Cancelled',
        message: `${employeeName || 'An employee'} cancelled a leave request.`,
        type: 'warning'
      })
      .select()
      .single()

    if (!notifErr && notif) {
      notifications.push(mapNotification(notif))
    }
  }

  return {
    request: mapLeaveRequest(updatedReq),
    notifications
  }
}

export async function updateLeaveBalance(employeeId, data) {
  const year = new Date().getFullYear()

  // 1. Fetch existing leave balances for this employee and year to get current used_days
  const { data: lbs, error: lbErr } = await supabase
    .from('leave_balances')
    .select('*, leave_types(*)')
    .eq('employee_id', employeeId)
    .eq('year', year)

  if (lbErr) throw lbErr

  // 2. Fetch leave type IDs for PL and UL
  const { data: lts, error: ltErr } = await supabase
    .from('leave_types')
    .select('id, code')

  if (ltErr) throw ltErr

  const plType = (lts || []).find(t => t.code === 'PL')
  const ulType = (lts || []).find(t => t.code === 'UL')

  if (!plType || !ulType) throw new Error('PL or UL leave type not found in database')

  const plRow = (lbs || []).find(b => b.leave_type_id === plType.id)
  const plUsed = plRow?.used_days || 0

  // 3. Upsert Paid Leave (PL) row
  const { error: plError } = await supabase
    .from('leave_balances')
    .upsert({
      employee_id: employeeId,
      leave_type_id: plType.id,
      year: year,
      total_allocated: data.paidBalance + plUsed,
      carry_forward_days: data.carriedForward,
      updated_at: new Date().toISOString()
    }, { onConflict: 'employee_id,leave_type_id,year' })

  if (plError) throw plError

  // 4. Upsert Unpaid Leave (UL) row
  const { error: ulError } = await supabase
    .from('leave_balances')
    .upsert({
      employee_id: employeeId,
      leave_type_id: ulType.id,
      year: year,
      used_days: data.unpaidBalance,
      updated_at: new Date().toISOString()
    }, { onConflict: 'employee_id,leave_type_id,year' })

  if (ulError) throw ulError

  const balance = await getLeaveBalanceForEmployee(employeeId, year)

  return {
    balance
  }
}
