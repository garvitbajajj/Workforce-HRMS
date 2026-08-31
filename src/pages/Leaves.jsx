import { useState } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Badge, Avatar, Modal, FormField, Input, Select, Btn, StatCard } from '../components/Layout.jsx'
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns'

export default function Leaves() {
  const { state, dispatch, getLeaveBalance, viewMode, throwUIError } = useHRMS()
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const isAdmin = ['admin','hr'].includes(currentUser?.role) && viewMode === 'admin'
  const isTeamLeader = currentUser?.role === 'team_leader'
  const canApprove = isAdmin || isTeamLeader

  const [showRequest, setShowRequest] = useState(false)
  const [showBalanceMgr, setShowBalanceMgr] = useState(false)
  const [activeTab, setActiveTab] = useState('mine') // mine | team | pending
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const balance = getLeaveBalance(employee?.id)

  const getMyLeaves = () => state.leaveRequests.filter(l => l.employeeId === employee?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const getTeamLeaves = () => {
    if (isAdmin) return state.leaveRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    const managed = state.employees.filter(e => e.managerId === employee?.id).map(e => e.id)
    return state.leaveRequests.filter(l => managed.includes(l.employeeId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  const getPendingForApproval = () => getTeamLeaves().filter(l => l.status === 'pending')

  const handleApprove = (id) => dispatch({ type: 'APPROVE_LEAVE', id, approverId: employee?.id })
  const handleCancel = (id) => dispatch({ type: 'CANCEL_LEAVE', id, employeeId: employee?.id, employeeName: `${employee?.firstName} ${employee?.lastName}` })
  const handleReject = () => {
    if (!rejectReason.trim()) { throwUIError(new Error('Please enter rejection reason')); return }
    dispatch({ type: 'REJECT_LEAVE', id: rejectModal, reason: rejectReason })
    setRejectModal(null); setRejectReason('')
  }

  const statusColor = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'gray' }

  const tabs = canApprove ? ['mine', 'team', 'pending'] : ['mine']
  const columnCount = canApprove && activeTab !== 'mine' ? 8 : 7

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Leave Management</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Manage leave requests, balances, and approvals</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && <Btn variant="ghost" size="sm" onClick={() => setShowBalanceMgr(true)}>💼 Manage Balances</Btn>}
          <Btn variant="primary" size="sm" onClick={() => setShowRequest(true)}>+ Request Leave</Btn>
        </div>
      </div>

      {/* Balance cards */}
      <div className="stats-grid">
        <StatCard label="Paid Balance" value={balance.paidBalance} icon="🏖️" color="#1a56db" sub="Available days" />
        <StatCard label="Carried Forward" value={balance.carriedForward} icon="↗️" color="#7c3aed" sub="From last period" />
        <StatCard label="Unpaid Used" value={balance.unpaidBalance} icon="📉" color="#d97706" sub="This year" />
        <StatCard label="Total Available" value={parseFloat((balance.paidBalance + balance.carriedForward).toFixed(2))} icon="✅" color="#05966b" sub="Paid + carried" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface2)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: activeTab === t ? 'white' : 'transparent', color: activeTab === t ? 'var(--text)' : 'var(--text3)', fontWeight: activeTab === t ? 600 : 400, fontSize: 13, cursor: 'pointer', boxShadow: activeTab === t ? 'var(--shadow)' : 'none', transition: 'all 0.15s', textTransform: 'capitalize' }}>
            {t === 'pending' ? `Pending (${getPendingForApproval().length})` : t === 'team' ? 'Team Leaves' : 'My Leaves'}
          </button>
        ))}
      </div>

      {/* Leave list */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {[...(canApprove && activeTab !== 'mine' ? ['Employee'] : []), 'Period', 'Days', 'Type', 'Reason', 'Status', 'Applied On', ...(canApprove || activeTab === 'mine' ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'mine' ? getMyLeaves() : activeTab === 'team' ? getTeamLeaves() : getPendingForApproval()).map(req => {
                const emp = state.employees.find(e => e.id === req.employeeId)
                const approver = req.approvedBy ? state.employees.find(e => e.id === req.approvedBy) : null
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {canApprove && activeTab !== 'mine' && (
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={emp?.avatar || '?'} size={28} bg="#1a56db" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{emp?.firstName} {emp?.lastName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{state.departments.find(d => d.id === emp?.departmentId)?.name}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: '11px 16px', fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{format(new Date(req.startDate), 'dd MMM')} – {format(new Date(req.endDate), 'dd MMM yyyy')}</div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700 }}>{req.totalDays}d</td>
                    <td style={{ padding: '11px 16px' }}><Badge color={req.leaveType === 'paid' ? 'primary' : 'warning'}>{req.leaveType}</Badge></td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text2)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.reason}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <Badge color={statusColor[req.status]}>{req.status}</Badge>
                      {req.rejectionNote && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>"{req.rejectionNote}"</div>}
                      {approver && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>by {approver.firstName}</div>}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text3)' }}>{format(parseISO(req.createdAt), 'dd MMM, h:mm a')}</td>
                    {(canApprove && activeTab !== 'mine') && (
                      <td style={{ padding: '11px 16px' }}>
                        {req.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn variant="success" size="sm" onClick={() => handleApprove(req.id)}>Approve</Btn>
                            <Btn variant="danger" size="sm" onClick={() => setRejectModal(req.id)}>Reject</Btn>
                          </div>
                        )}
                      </td>
                    )}
                    {activeTab === 'mine' && (
                      <td style={{ padding: '11px 16px' }}>
                        {req.status === 'pending' ? (
                          <Btn variant="ghost" size="sm" onClick={() => handleCancel(req.id)}>Cancel</Btn>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {(activeTab === 'mine' ? getMyLeaves() : activeTab === 'team' ? getTeamLeaves() : getPendingForApproval()).length === 0 && (
                <tr><td colSpan={columnCount} style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>No leave records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Request Leave Modal */}
      {showRequest && <LeaveRequestModal employees={state.employees} balance={balance} employee={employee} departments={state.departments} holidays={state.holidays} onClose={() => setShowRequest(false)}
        onSubmit={(data) => {
          const teamLeaderId = employee?.managerId
          dispatch({ type: 'SUBMIT_LEAVE', request: { employeeId: employee?.id, ...data }, managerId: teamLeaderId, employeeName: `${employee?.firstName} ${employee?.lastName}` })
          setShowRequest(false)
        }} />}

      {/* Balance manager modal (admin/hr only) */}
      {showBalanceMgr && <BalanceManagerModal employees={state.employees} balances={state.leaveBalances} dispatch={dispatch} onClose={() => setShowBalanceMgr(false)} />}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal title="Reject Leave Request" onClose={() => setRejectModal(null)} width={400}>
          <FormField label="Reason for rejection *">
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Explain why..." style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical' }} />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setRejectModal(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={handleReject}>Reject Leave</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LeaveRequestModal({ employee, balance, holidays = [], onClose, onSubmit }) {
  const { throwUIError } = useHRMS()
  const [form, setForm] = useState({ startDate: '', endDate: '', leaveType: 'paid', reason: '' })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const isNonWorkingDay = (date) => {
    const isWorkingSat = date.getDay() === 6 && ((date.getDate() >= 1 && date.getDate() <= 7) || (date.getDate() >= 22 && date.getDate() <= 28))
    if (isWeekend(date) && !isWorkingSat) return true
    const dateStr = format(date, 'yyyy-MM-dd')
    const locKey = employee?.workLocation?.toLowerCase()
    if (locKey && ['pune', 'indore', 'noida', 'bangalore'].includes(locKey)) {
      return holidays.some(h => h.date === dateStr && h[locKey])
    }
    return holidays.some(h => h.date === dateStr)
  }

  const calcDays = () => {
    if (!form.startDate || !form.endDate) return 0
    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    if (end < start) return 0

    const daysList = eachDayOfInterval({ start, end })

    let firstWorkIndex = -1
    let lastWorkIndex = -1

    for (let i = 0; i < daysList.length; i++) {
      if (!isNonWorkingDay(daysList[i])) {
        if (firstWorkIndex === -1) firstWorkIndex = i
        lastWorkIndex = i
      }
    }

    if (firstWorkIndex === -1) return 0 // No working days in the interval

    return lastWorkIndex - firstWorkIndex + 1
  }
  const days = calcDays()
  const insufficient = form.leaveType === 'paid' && days > (balance.paidBalance + balance.carriedForward)

  return (
    <Modal title="Request Leave" onClose={onClose} width={440}>
      <FormField label="Leave Type">
        <Select value={form.leaveType} onChange={set('leaveType')}>
          <option value="paid">Paid Leave (Balance: {parseFloat((balance.paidBalance + balance.carriedForward).toFixed(2))} days)</option>
          <option value="unpaid">Unpaid Leave</option>
        </Select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormField label="Start Date *"><Input type="date" value={form.startDate} onChange={set('startDate')} min={format(new Date(), 'yyyy-MM-dd')} /></FormField>
        <FormField label="End Date *"><Input type="date" value={form.endDate} onChange={set('endDate')} min={form.startDate} /></FormField>
      </div>
      {days > 0 && (
        <div style={{ padding: '10px 14px', background: insufficient ? 'var(--danger-light)' : 'var(--success-light)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: insufficient ? 'var(--danger)' : 'var(--success)' }}>
          {days} working day(s) selected {insufficient ? '⚠️ Insufficient balance' : '✅'}
        </div>
      )}
      <FormField label="Reason *">
        <textarea value={form.reason} onChange={set('reason')} rows={3} placeholder="Briefly describe the reason..." style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical' }} />
      </FormField>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={insufficient} onClick={() => {
          if (!form.startDate || !form.endDate || !form.reason.trim()) { throwUIError(new Error('Fill all fields')); return }
          if (new Date(form.endDate) < new Date(form.startDate)) { throwUIError(new Error('End date before start date')); return }
          onSubmit({ ...form, totalDays: days })
        }}>Submit Request</Btn>
      </div>
    </Modal>
  )
}

function BalanceManagerModal({ employees, balances, dispatch, onClose }) {
  const [selected, setSelected] = useState(employees[0]?.id || '')
  const balance = balances.find(b => b.employeeId === selected) || { paidBalance: 0, unpaidBalance: 0, carriedForward: 0, usedDays: 0 }
  const [form, setForm] = useState({ paidBalance: balance.paidBalance, carriedForward: balance.carriedForward, unpaidBalance: balance.unpaidBalance })
  const [search, setSearch] = useState('')

  const handleEmpChange = (id) => {
    setSelected(id)
    const b = balances.find(b => b.employeeId === id) || { paidBalance: 0, carriedForward: 0, unpaidBalance: 0 }
    setForm({ paidBalance: b.paidBalance, carriedForward: b.carriedForward, unpaidBalance: b.unpaidBalance })
  }

  return (
    <Modal title="Manage Leave Balances" onClose={onClose} width={480}>
      <FormField label="Employee">
        <Input 
          type="text" 
          placeholder="🔍 Search employee name..." 
          value={search} 
          onChange={e => {
            const val = e.target.value
            setSearch(val)
            const matched = employees.find(emp => 
              `${emp.firstName} ${emp.lastName} ${emp.empCode}`.toLowerCase().includes(val.toLowerCase())
            )
            if (matched && matched.id !== selected) {
              handleEmpChange(matched.id)
            }
          }}
          style={{ marginBottom: 8 }}
        />
        <Select value={selected} onChange={e => handleEmpChange(e.target.value)}>
          {employees
            .filter(e => `${e.firstName} ${e.lastName} ${e.empCode}`.toLowerCase().includes(search.toLowerCase()))
            .map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empCode})</option>)}
        </Select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <FormField label="Paid Balance">
          <Input type="number" step="0.5" value={form.paidBalance} onChange={e => setForm(f => ({ ...f, paidBalance: parseFloat(e.target.value) || 0 }))} />
        </FormField>
        <FormField label="Carried Forward">
          <Input type="number" step="0.5" value={form.carriedForward} onChange={e => setForm(f => ({ ...f, carriedForward: parseFloat(e.target.value) || 0 }))} />
        </FormField>
        <FormField label="Unpaid Used">
          <Input type="number" step="0.5" value={form.unpaidBalance} onChange={e => setForm(f => ({ ...f, unpaidBalance: parseFloat(e.target.value) || 0 }))} />
        </FormField>
      </div>
      <div style={{ padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--primary)' }}>
        Total available: <strong>{parseFloat((parseFloat(form.paidBalance) + parseFloat(form.carriedForward)).toFixed(2))} days</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { dispatch({ type: 'UPDATE_LEAVE_BALANCE', employeeId: selected, data: form }); onClose() }}>Save Balance</Btn>
      </div>
    </Modal>
  )
}
