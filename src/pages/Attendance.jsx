import { useState, useEffect } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Badge, Avatar, StatCard, Modal, FormField, Input, Btn, Select } from '../components/Layout.jsx'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'

export default function Attendance() {
  const { state, dispatch, getTodayLog, viewMode, throwUIError } = useHRMS()
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const isPrivileged = ['admin', 'hr', 'team_leader'].includes(currentUser?.role) && viewMode === 'admin'
  const canApprove = (['admin', 'hr'].includes(currentUser?.role) && viewMode === 'admin') || currentUser?.role === 'team_leader'
  const [view, setView] = useState('today') // today | weekly | monthly
  const [selectedEmp, setSelectedEmp] = useState(isPrivileged ? '' : employee?.id)
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'))
  const [search, setSearch] = useState('')

  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [rejectCorrectionModal, setRejectCorrectionModal] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    setSelectedEmp(isPrivileged ? '' : employee?.id)
  }, [isPrivileged, employee?.id])

  const todayLog = getTodayLog(employee?.id)
  const now = new Date()

  const getFilteredLogs = () => {
    let logs = state.attendanceLogs
    if (!isPrivileged) logs = logs.filter(l => l.employeeId === employee?.id)
    else if (selectedEmp) logs = logs.filter(l => l.employeeId === selectedEmp)
    if (view === 'today') return logs.filter(l => l.workDate === format(now, 'yyyy-MM-dd'))
    if (view === 'weekly') {
      const weekStart = format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), 'yyyy-MM-dd')
      return logs.filter(l => l.workDate >= weekStart)
    }
    if (view === 'monthly') return logs.filter(l => l.workDate.startsWith(monthFilter))
    return logs
  }

  const logs = getFilteredLogs().sort((a, b) => new Date(b.workDate) - new Date(a.workDate))

  // Monthly calendar for employee
  const [calMonth, setCalMonth] = useState(new Date())
  const monthDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const myLogs = state.attendanceLogs.filter(l => l.employeeId === (selectedEmp || employee?.id))
  const logMap = {}
  myLogs.forEach(l => { logMap[l.workDate] = l })

  const handleClockIn = async () => {
    let ip = '192.168.1.1'
    try { const res = await fetch('https://api.ipify.org?format=json'); const d = await res.json(); ip = d.ip } catch { }
    dispatch({ type: 'CLOCK_IN', employeeId: employee?.id, ip })
  }
  const handleClockOut = () => { if (todayLog) dispatch({ type: 'CLOCK_OUT', logId: todayLog.id }) }

  const monthStats = myLogs.filter(l => l.workDate.startsWith(monthFilter))
  const totalHours = monthStats.reduce((s, l) => s + (l.hoursWorked || 0), 0)
  const lateDays = isPrivileged ? monthStats.filter(l => l.isLate).length : 0
  const presentDays = monthStats.length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Attendance</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Track daily attendance and working hours</p>
        </div>
        {isPrivileged && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="🔍 Search employee..." 
              value={search} 
              onChange={e => {
                const val = e.target.value
                setSearch(val)
                const matched = state.employees.find(emp => 
                  `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(val.toLowerCase())
                )
                if (matched && matched.id !== selectedEmp) {
                  setSelectedEmp(matched.id)
                } else if (!val) {
                  setSelectedEmp('')
                }
              }}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'white', outline: 'none' }}
            />
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'white' }}>
              <option value="">All Employees</option>
              {state.employees
                .filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()))
                .map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Employee clock in/out widget */}
      {employee && (
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Today, {format(now, 'EEE d MMM')}</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>{format(now, 'hh:mm a')}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>Office: 9:00 AM – 7:00 PM</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              {todayLog && (
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Clock In: {format(parseISO(todayLog.clockIn), 'hh:mm a')}
                  {todayLog.clockOut && <span> · Out: {format(parseISO(todayLog.clockOut), 'hh:mm a')}</span>}
                  {todayLog.hoursWorked && <span> · {todayLog.hoursWorked}h</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {(!todayLog || todayLog.clockOut) && (
                  <button onClick={handleClockIn} style={{ padding: '11px 28px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    {todayLog ? 'Clock In Again' : 'Clock In'}
                  </button>
                )}
                {todayLog && !todayLog.clockOut && <button onClick={handleClockOut} style={{ padding: '11px 28px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Clock Out</button>}
                <button onClick={() => setShowCorrectionModal(true)} style={{ padding: '11px 20px', background: 'transparent', color: 'white', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Request Past Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="stats-grid">
        <StatCard label="Present Days" value={presentDays} icon="📅" color="#05966b" sub={`Month of ${format(new Date(monthFilter), 'MMM')}`} />
        <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} icon="⏱️" color="#1a56db" sub="This month" />
        <StatCard label="Late Arrivals" value={lateDays} icon="⚠️" color="#d97706" sub="After 9:30 AM" />
        <StatCard label="Avg. Hours/Day" value={presentDays ? (totalHours / presentDays).toFixed(1) : '0'} icon="📊" color="#7c3aed" sub="Per working day" />
      </div>

      {/* All logs table for admin */}
      {isPrivileged && (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Attendance Logs</span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {['today', 'weekly', 'monthly'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: view === v ? 'var(--primary)' : 'white', color: view === v ? 'white' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
              ))}
              {view === 'monthly' && <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'IP'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const emp = state.employees.find(e => e.id === log.employeeId)
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={emp?.avatar || '?'} size={28} bg="#1a56db" />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{emp?.firstName} {emp?.lastName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13 }}>{format(new Date(log.workDate), 'EEE, dd MMM yyyy')}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{format(parseISO(log.clockIn), 'hh:mm a')}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{log.clockOut ? format(parseISO(log.clockOut), 'hh:mm a') : '—'}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600 }}>{log.hoursWorked ? `${log.hoursWorked}h` : '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        {log.isLate ? <Badge color="warning">Late</Badge> : <Badge color="success">Present</Badge>}
                        {log.earlyLogout && <Badge color="danger" style={{ marginLeft: 4 }}>Early Out</Badge>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{log.ipAddress}</td>
                    </tr>
                  )
                })}
                {logs.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No attendance records for this period</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="attendance-calendar-grid">
        {/* Calendar */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Attendance Calendar</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }}>←</button>
              <span style={{ fontSize: 14, fontWeight: 600, padding: '4px 12px' }}>{format(calMonth, 'MMMM yyyy')}</span>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }}>→</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>)}
            {/* Empty cells for first day offset */}
            {Array.from({ length: monthDays[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
            {monthDays.map(d => {
              const ds = format(d, 'yyyy-MM-dd')
              const log = logMap[ds]
              const isToday = ds === format(now, 'yyyy-MM-dd')
              const isWorkingSat = d.getDay() === 6 && ((d.getDate() >= 1 && d.getDate() <= 7) || (d.getDate() >= 22 && d.getDate() <= 28))
              const isWeekendDay = isWeekend(d) && !isWorkingSat
              const isHoliday = state.holidays.some(h => h.date === ds)
              const isPast = ds < format(now, 'yyyy-MM-dd')
              const myApprovedLeaves = state.leaveRequests.filter(r => r.employeeId === (selectedEmp || employee?.id) && r.status === 'approved')
              const onLeave = myApprovedLeaves.some(r => ds >= r.startDate && ds <= r.endDate)
              const myPendingLeaves = state.leaveRequests.filter(r => r.employeeId === (selectedEmp || employee?.id) && r.status === 'pending')
              const pendingLeave = myPendingLeaves.some(r => ds >= r.startDate && ds <= r.endDate)

              const myCorrections = state.attendanceCorrections?.filter(c => c.employeeId === (selectedEmp || employee?.id)) || []
              const pendingCorrection = myCorrections.find(c => c.workDate === ds && c.status === 'pending')

              let bg = 'transparent', color = 'var(--text2)', title = ''

              if (pendingCorrection) {
                bg = '#f59e0b' // Amber
                color = '#ffffff'
                title = `Correction Pending: ${pendingCorrection.reason}`
              } else if (isWeekendDay || isHoliday) {
                bg = '#e5e7eb' // Weekend / public holiday - Gray
                color = '#6b7280'
                title = isHoliday ? 'Holiday' : 'Weekend'
              } else if (log && !log.clockOut) {
                // Attendance pending approval (In progress shift) OR current shift
                bg = isToday ? '#10b981' : '#f59e0b' // if today, let's keep it green/in progress, else amber
                color = '#ffffff'
                title = isToday ? 'Clocked In' : 'Attendance Pending Approval'
              } else if (log && log.clockOut) {
                if (log.status === 'absent') {
                  bg = '#ef4444' // Absent - Red
                  color = '#ffffff'
                  title = 'Absent'
                } else {
                  bg = '#10b981' // Present - Green
                  color = '#ffffff'
                  title = log.hoursWorked ? `${log.hoursWorked}h` : 'Present'
                }
              } else if (pendingLeave || onLeave) {
                // Approved Leave & Leave applied - Light Red
                bg = '#fee2e2'
                color = '#b91c1c'
                title = pendingLeave ? 'Leave Applied (Pending)' : 'On Leave'
              } else if (isPast) {
                // neither leave nor present - Light Black
                bg = '#374151'
                color = '#ffffff'
                title = isWorkingSat ? 'Working Saturday (No Record)' : 'No Record'
              } else if (isWorkingSat) {
                title = 'Working Saturday'
              }

              return (
                <div key={ds} title={title} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: (isToday || log || isHoliday) ? 600 : 400, cursor: log ? 'pointer' : 'default', position: 'relative', border: isToday ? '2px solid #1a56db' : 'none' }}>
                  {d.getDate()}
                  {log && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'white' }} />}
                </div>
              )
            })}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Present', bg: '#10b981', border: '#10b981' },
              { label: 'Absent', bg: '#ef4444', border: '#ef4444' },
              { label: 'Attendance Pending', bg: '#f59e0b', border: '#f59e0b' },
              { label: 'Leave / Pending Leave', bg: '#fee2e2', border: '#fca5a5' },
              { label: 'No Record', bg: '#374151', border: '#374151' },
              { label: 'Weekend/Holiday', bg: '#e5e7eb', border: '#d1d5db' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', fontWeight: 500 }}>
                <div style={{ width: 10, height: 10, background: item.bg, borderRadius: 3, border: `1px solid ${item.border}` }} />
                {item.label}
              </div>
            ))}
          </div>
        </Card>

        {/* Recent logs */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Recent Logs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {state.attendanceLogs.filter(l => l.employeeId === (selectedEmp || employee?.id)).sort((a, b) => new Date(b.workDate) - new Date(a.workDate)).slice(0, 8).map(log => (
              <div key={log.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{format(new Date(log.workDate), 'EEE, d MMM')}</span>
                  {log.isLate && isPrivileged && <Badge color="warning">Late</Badge>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  In: {format(parseISO(log.clockIn), 'h:mm a')}
                  {log.clockOut ? ` · Out: ${format(parseISO(log.clockOut), 'h:mm a')} · ${log.hoursWorked}h` : ' · In progress'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pending corrections card for Admin/HR/TL */}
      {canApprove && (
        <Card style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Pending Attendance Corrections</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Employee', 'Date', 'Requested Clock In', 'Requested Clock Out', 'Reason', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.attendanceCorrections?.filter(c => c.status === 'pending').map(corr => {
                  const emp = state.employees.find(e => e.id === corr.employeeId)
                  return (
                    <tr key={corr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={emp?.avatar || '?'} size={28} bg="#1a56db" />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{emp?.firstName} {emp?.lastName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 13 }}>{format(new Date(corr.workDate), 'dd MMM yyyy')}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{format(parseISO(corr.clockIn), 'hh:mm a')}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{format(parseISO(corr.clockOut), 'hh:mm a')}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text2)' }}>{corr.reason}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant="success" size="sm" onClick={() => dispatch({ type: 'APPROVE_CORRECTION', correctionId: corr.id, approverId: employee?.id })}>Approve</Btn>
                          <Btn variant="danger" size="sm" onClick={() => setRejectCorrectionModal(corr.id)}>Reject</Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(state.attendanceCorrections?.filter(c => c.status === 'pending').length === 0) && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No pending correction requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* My Correction requests card for employee */}
      {!isPrivileged && (
        <Card style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>My Attendance Corrections</span>
            <Btn variant="primary" size="sm" onClick={() => setShowCorrectionModal(true)}>+ Request Correction</Btn>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Requested In', 'Requested Out', 'Reason', 'Status', 'Applied On', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.attendanceCorrections?.filter(c => c.employeeId === employee?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(corr => (
                  <tr key={corr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13 }}>{format(new Date(corr.workDate), 'dd MMM yyyy')}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{format(parseISO(corr.clockIn), 'hh:mm a')}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontFamily: 'var(--mono)' }}>{format(parseISO(corr.clockOut), 'hh:mm a')}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text2)' }}>{corr.reason}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <Badge color={corr.status === 'approved' ? 'success' : corr.status === 'rejected' ? 'danger' : 'warning'}>{corr.status}</Badge>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text3)' }}>{format(parseISO(corr.createdAt), 'dd MMM, h:mm a')}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {corr.status === 'pending' && (
                        <Btn variant="danger" size="sm" onClick={() => {
                          if (confirm('Are you sure you want to cancel this request?')) {
                            dispatch({
                              type: 'CANCEL_CORRECTION',
                              correctionId: corr.id
                            })
                          }
                        }}>Cancel</Btn>
                      )}
                    </td>
                  </tr>
                ))}
                {(state.attendanceCorrections?.filter(c => c.employeeId === employee?.id).length === 0) && (
                  <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No correction requests submitted yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Request Correction Modal */}
      {showCorrectionModal && (
        <AttendanceCorrectionModal
          employee={employee}
          onClose={() => setShowCorrectionModal(false)}
          onSubmit={(correction) => {
            dispatch({
              type: 'SUBMIT_CORRECTION',
              correction,
              employeeName: `${employee?.firstName} ${employee?.lastName}`
            })
            setShowCorrectionModal(false)
          }}
        />
      )}

      {/* Reject Correction Modal */}
      {rejectCorrectionModal && (
        <Modal title="Reject Correction Request" onClose={() => setRejectCorrectionModal(null)} width={400}>
          <FormField label="Reason for rejection *">
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Explain why..."
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical' }}
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setRejectCorrectionModal(null)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  throwUIError(new Error('Please enter a rejection reason'))
                  return
                }
                dispatch({ type: 'REJECT_CORRECTION', correctionId: rejectCorrectionModal, rejectionReason, approverId: employee?.id })
                setRejectCorrectionModal(null)
                setRejectionReason('')
              }}
            >
              Reject Request
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

function AttendanceCorrectionModal({ employee, onClose, onSubmit }) {
  const { throwUIError } = useHRMS()
  const [form, setForm] = useState({
    workDate: '',
    clockIn: '09:00',
    clockOut: '19:00',
    reason: ''
  })
  
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  
  const maxDate = format(new Date(), 'yyyy-MM-dd')

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!form.workDate || !form.clockIn || !form.clockOut || !form.reason.trim()) {
      throwUIError(new Error('Please fill in all fields'))
      return
    }
    
    // Combine date and time to ISO strings
    const clockInISO = new Date(`${form.workDate}T${form.clockIn}:00`).toISOString()
    const clockOutISO = new Date(`${form.workDate}T${form.clockOut}:00`).toISOString()
    
    if (new Date(clockOutISO) <= new Date(clockInISO)) {
      throwUIError(new Error('Clock Out time must be after Clock In time'))
      return
    }

    onSubmit({
      employeeId: employee.id,
      workDate: form.workDate,
      clockIn: clockInISO,
      clockOut: clockOutISO,
      reason: form.reason
    })
  }

  return (
    <Modal title="Request Attendance Correction" onClose={onClose} width={440}>
      <form onSubmit={handleFormSubmit}>
        <FormField label="Date *">
          <Input type="date" value={form.workDate} onChange={set('workDate')} max={maxDate} required />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="Clock In *">
            <Input type="time" value={form.clockIn} onChange={set('clockIn')} required />
          </FormField>
          <FormField label="Clock Out *">
            <Input type="time" value={form.clockOut} onChange={set('clockOut')} required />
          </FormField>
        </div>
        <FormField label="Reason *">
          <textarea
            value={form.reason}
            onChange={set('reason')}
            rows={3}
            placeholder="Why are you requesting this correction? (e.g. Forgot to clock in/out)"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical' }}
            required
          />
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit">Submit Request</Btn>
        </div>
      </form>
    </Modal>
  )
}
