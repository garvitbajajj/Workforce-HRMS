import { useState } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, StatCard, Badge, Avatar, Modal, FormField, Input, Select, Btn } from '../components/Layout.jsx'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, subDays, parseISO } from 'date-fns'

export default function Dashboard({ setPage }) {
  const { state, getLeaveBalance, getTodayLog, getEmpNotifs, getUpcomingHolidays, getMonthlyStats, dispatch, viewMode } = useHRMS()
  const getHoursSoFar = (clockInStr) => {
    if (!clockInStr) return '0.0'
    const diff = (new Date() - new Date(clockInStr)) / 3600000
    return diff < 0 ? '0.0' : diff.toFixed(1)
  }
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const isAdmin = ['admin', 'hr'].includes(currentUser?.role)
  const isTeamLeader = currentUser?.role === 'team_leader'

  const balance = getLeaveBalance(employee?.id)
  const todayLog = getTodayLog(employee?.id)
  const stats = getMonthlyStats(employee?.id)
  const holidays = getUpcomingHolidays(employee?.workLocation)
  const notifs = getEmpNotifs(employee?.id).filter(n => !n.isRead).slice(0, 4)
  const [showPostNotif, setShowPostNotif] = useState(false)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null)

  // Build weekly attendance chart for last 7 days
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const dStr = format(d, 'yyyy-MM-dd')
    const logs = state.attendanceLogs.filter(l => l.workDate === dStr && (viewMode === 'admin' ? true : l.employeeId === employee?.id))
    return {
      day: format(d, 'EEE'),
      hours: logs.length ? parseFloat((logs.reduce((s, l) => s + (l.hoursWorked || 0), 0) / (viewMode === 'admin' ? Math.max(logs.length, 1) : 1)).toFixed(1)) : 0,
      present: logs.length,
    }
  })

  // Group employees by department/team
  const deptCounts = {}
  state.employees.forEach(e => {
    const deptName = e.departmentId || 'Unassigned'
    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1
  })
  const deptData = Object.keys(deptCounts).map(name => ({
    name,
    value: deptCounts[name]
  })).sort((a, b) => b.value - a.value)

  const COLORS = [
    '#1a56db', '#7c3aed', '#05966b', '#d97706', '#e02424',
    '#2563eb', '#db2777', '#0891b2', '#ea580c', '#4f46e5'
  ]

  // Pending approvals
  const pendingLeaves = state.leaveRequests.filter(l => {
    if (l.status !== 'pending') return false
    if (isAdmin) return true
    if (isTeamLeader) {
      const managed = state.employees.filter(e => e.managerId === employee?.id).map(e => e.id)
      return managed.includes(l.employeeId)
    }
    return false
  })

  // Today's attendance for admin
  const todayPresent = [...new Set(state.attendanceLogs.filter(l => l.workDate === format(new Date(), 'yyyy-MM-dd')).map(l => l.employeeId))].length
  const todayAbsent = state.employees.length - todayPresent

  const handleClockIn = async () => {
    let ip = '192.168.1.1'
    try { const res = await fetch('https://api.ipify.org?format=json'); const d = await res.json(); ip = d.ip } catch {}
    dispatch({ type: 'CLOCK_IN', employeeId: employee?.id, ip })
  }
  const handleClockOut = () => { if (todayLog) dispatch({ type: 'CLOCK_OUT', logId: todayLog.id }) }

  const getNotifIcon = (type) => {
    if (type === 'birthday') return '🎂'
    if (type === 'success' || type === 'leave_approved') return '✅'
    if (type === 'warning' || type === 'leave_request') return '⚠️'
    if (type === 'danger' || type === 'leave_rejected') return '❌'
    return 'ℹ️'
  }

  // Today's birthdays
  const todayMMDD = format(new Date(), 'MM-dd')
  const todayBirthdays = state.employees.filter(e => {
    if (!e.dateOfBirth) return false
    return e.dateOfBirth.slice(5) === todayMMDD
  })

  return (
    <div>
      {/* Birthday Banner */}
      {todayBirthdays.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
          borderRadius: 14,
          padding: '18px 24px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          color: '#78350f',
          boxShadow: '0 4px 14px rgba(251, 191, 36, 0.35)',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 36 }}>🎂</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, color: '#451a03' }}>
              🎉 Birthday Today!
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {todayBirthdays.map(e => `${e.firstName} ${e.lastName}`).join(', ')} — Wish them a wonderful day! 🎈
            </div>
          </div>
          <span style={{ fontSize: 36 }}>🎉</span>
        </div>
      )}

      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {employee?.firstName} 👋
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Here's your workspace overview for today.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {((isAdmin && viewMode === 'admin') || isTeamLeader) && (
            <Btn variant="primary" size="sm" onClick={() => setShowPostNotif(true)}>📢 Post Notification</Btn>
          )}
        </div>
      </div>

      {/* Quick Clock In/Out (for employees / employee view) */}
      {viewMode === 'employee' && (
        <div style={{ background: 'linear-gradient(135deg, #1a56db, #7c3aed)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Today's Status</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {!todayLog ? 'Not Clocked In' : !todayLog.clockOut ? `Clocked In (${getHoursSoFar(todayLog.clockIn)}h)` : `Done — ${todayLog.hoursWorked}h worked`}
            </div>
            {todayLog?.clockIn && (
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                In: {format(parseISO(todayLog.clockIn), 'hh:mm a')}
                {todayLog.clockOut ? ` · Out: ${format(parseISO(todayLog.clockOut), 'hh:mm a')} · ${todayLog.hoursWorked}h` : ` · Active: ${getHoursSoFar(todayLog.clockIn)}h`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(!todayLog || todayLog.clockOut) && (
              <button onClick={handleClockIn} style={{ padding: '10px 24px', background: 'white', color: '#1a56db', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {todayLog ? 'Clock In Again' : 'Clock In'}
              </button>
            )}
            {todayLog && !todayLog.clockOut && (
              <button onClick={handleClockOut} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Clock Out</button>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="stats-grid">
        {viewMode === 'admin' ? (
          <>
            <StatCard label="Total Employees" value={state.employees.length} icon="👥" color="#1a56db" sub={`${state.departments.length} departments`} />
            <StatCard label="Present Today" value={todayPresent} icon="✅" color="#05966b" sub={`${todayAbsent} absent`} />
            <StatCard label="Pending Leaves" value={pendingLeaves.length} icon="⏳" color="#d97706" sub="Awaiting approval" />
            <StatCard label="Departments" value={state.departments.length} icon="🏢" color="#7c3aed" sub="Active units" />
          </>
        ) : (
          <>
            <StatCard label="Paid Leave Balance" value={`${parseFloat((balance.paidBalance + balance.carriedForward).toFixed(2))}`} icon="🏖️" color="#1a56db" sub={`${balance.carriedForward} carried forward`} />
            <StatCard label="Hours This Month" value={`${stats.totalHours}h`} icon="⏱️" color="#05966b" sub={`${stats.presentDays} days present`} />
            <StatCard label="Hours Worked Today" value={!todayLog ? '0.0h' : !todayLog.clockOut ? `${getHoursSoFar(todayLog.clockIn)}h` : `${todayLog.hoursWorked}h`} icon="🕒" color="#d97706" sub={!todayLog ? 'Not clocked in' : !todayLog.clockOut ? 'Active now' : 'Completed'} />
            <StatCard label="Pending Requests" value={pendingLeaves.length} icon="📋" color="#7c3aed" sub="Leave requests" />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="charts-grid" style={{ gridTemplateColumns: viewMode === 'admin' ? '1fr 320px' : '1fr' }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: '-0.3px' }}>
            {viewMode === 'admin' ? 'Avg. Daily Working Hours (Team)' : 'Your Working Hours — Past 7 Days'}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a56db" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 10]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} formatter={(v) => [`${v}h`, 'Hours']} />
              <Area type="monotone" dataKey="hours" stroke="#1a56db" strokeWidth={2} fill="url(#colorHours)" dot={{ fill: '#1a56db', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {viewMode === 'admin' && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: '-0.3px' }}>Teams</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie 
                  data={deptData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={55} 
                  label={({ name, value }) => `${name.length > 8 ? name.slice(0, 8) + '..' : name}: ${value}`} 
                  labelLine={false} 
                  fontSize={9}
                  onClick={(data) => { if (data && data.name) setSelectedTeamDetails(data.name) }}
                  style={{ cursor: 'pointer' }}
                >
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', justifyContent: 'center', marginTop: 10 }}>
              {deptData.map((d, i) => (
                <div 
                  key={d.name} 
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: '2px 5px', borderRadius: 4, transition: 'background 0.1s' }} 
                  onClick={() => setSelectedTeamDetails(d.name)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }}></span>
                  <span style={{ color: 'var(--text1)' }}>{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Upcoming holidays */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, letterSpacing: '-0.3px' }}>Upcoming Holidays</div>
          {holidays.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>No upcoming holidays</p>
          ) : holidays.map(h => (
            <div key={h.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{format(new Date(h.date), 'EEE, d MMM yyyy')}</div>
              </div>
              <Badge color="primary">{format(new Date(h.date), 'dd MMM')}</Badge>
            </div>
          ))}
        </Card>

        {/* Pending approvals (admin/team leader) or Recent leaves (employee) */}
        {(isAdmin || isTeamLeader) && pendingLeaves.length > 0 ? (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>Pending Approvals</div>
              <button onClick={() => setPage('leaves')} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {pendingLeaves.slice(0, 5).map(req => {
              const emp = state.employees.find(e => e.id === req.employeeId)
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <Avatar name={emp?.avatar || '?'} size={32} bg="#1a56db" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{emp?.firstName} {emp?.lastName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{req.startDate} · {req.totalDays}d · {req.leaveType}</div>
                  </div>
                  <Badge color="warning">Pending</Badge>
                </div>
              )
            })}
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Announcements card — normal work-related notifications */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>📢</span>
                <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>Announcements</div>
              </div>
              {(() => {
                const announcements = notifs.filter(n => n.type !== 'birthday' && n.type !== 'anniversary')
                return announcements.length === 0 ? (
                  <p style={{ color: 'var(--text3)', fontSize: 13 }}>No new announcements.</p>
                ) : announcements.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16 }}>{getNotifIcon(n.type)}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{n.message}</div>
                    </div>
                  </div>
                ))
              })()}
            </Card>

            {/* Celebrations card — birthdays, work anniversaries */}
            <Card style={{ background: 'linear-gradient(135deg, #fffbf0 0%, #fff9eb 100%)', border: '1px solid #fde68a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🎉</span>
                <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', color: '#92400e' }}>Celebrations</div>
              </div>
              {(() => {
                const celebrations = notifs.filter(n => n.type === 'birthday' || n.type === 'anniversary')
                return celebrations.length === 0 ? (
                  <p style={{ color: '#b45309', fontSize: 13 }}>No celebrations right now. 🎈</p>
                ) : celebrations.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid #fde68a', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16 }}>{n.type === 'birthday' ? '🎂' : '🏆'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.4 }}>{n.message}</div>
                    </div>
                  </div>
                ))
              })()}
            </Card>
          </div>
        )}

        {/* Today's team attendance (admin) or leave balance (employee) */}
        {viewMode === 'admin' ? (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, letterSpacing: '-0.3px' }}>Today's Team Attendance</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={[{ name: 'Present', v: todayPresent }, { name: 'Absent', v: todayAbsent }]}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  <Cell fill="#05966b" />
                  <Cell fill="#e02424" />
                </Bar>
                <Tooltip />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, letterSpacing: '-0.3px' }}>Leave Balance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Paid Leaves', value: balance.paidBalance, color: '#1a56db' },
                { label: 'Carried Forward', value: balance.carriedForward, color: '#7c3aed' },
                { label: 'Unpaid Used', value: balance.unpaidBalance, color: '#d97706' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color, fontSize: 14 }}>{item.value} days</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showPostNotif && (
        <PostNotificationModal 
          employee={employee} 
          isAdmin={isAdmin} 
          isTeamLeader={isTeamLeader}
          onClose={() => setShowPostNotif(false)} 
          onSubmit={(data) => {
            dispatch({ 
              type: 'POST_NOTIFICATION', 
              title: data.title, 
              message: data.message, 
              notifType: data.type, 
              target: data.target, 
              senderEmpId: employee?.id 
            })
            setShowPostNotif(false)
          }} 
        />
      )}
      {selectedTeamDetails && (
        <TeamDetailsModal 
          teamName={selectedTeamDetails} 
          employees={state.employees} 
          departments={state.departments} 
          onClose={() => setSelectedTeamDetails(null)} 
        />
      )}
    </div>
  )
}

function TeamDetailsModal({ teamName, employees, departments, onClose }) {
  const members = employees.filter(e => e.departmentId === teamName)
  const manager = members.find(m => m.role === 'team_leader')

  return (
    <Modal title={`Team Details: ${teamName}`} onClose={onClose} width={480}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Team Leader</div>
        {manager ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <Avatar name={manager.avatar} size={34} bg="#1a56db" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{manager.firstName} {manager.lastName}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{manager.designation} · {manager.email}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No team leader assigned</div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Members ({members.length})</div>
        {members.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No members in this team.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface1)' }}>
                <Avatar name={m.avatar} size={30} bg={['#1a56db','#7c3aed','#05966b','#d97706','#e02424'][m.id.charCodeAt(1) % 5]} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.firstName} {m.lastName}
                    {m.id === manager?.id && <Badge color="primary">Leader</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.designation} · {m.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="primary" size="sm" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}

function PostNotificationModal({ employee, isAdmin, isTeamLeader, onClose, onSubmit }) {
  const { throwUIError } = useHRMS()
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    target: isAdmin ? 'all' : 'team'
  })
  
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Modal title="Post Notification" onClose={onClose} width={460}>
      <FormField label="Title *">
        <Input 
          value={form.title} 
          onChange={set('title')} 
          placeholder="e.g. System Maintenance, Team Meeting" 
          maxLength={100}
        />
      </FormField>
      
      <FormField label="Message *">
        <textarea 
          value={form.message} 
          onChange={set('message')} 
          rows={4} 
          placeholder="Enter the notification message details..." 
          style={{ 
            width: '100%', 
            padding: '9px 12px', 
            border: '1px solid var(--border)', 
            borderRadius: 8, 
            fontSize: 14, 
            outline: 'none', 
            resize: 'vertical',
            fontFamily: 'inherit'
          }} 
        />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormField label="Notification Type">
          <Select value={form.type} onChange={set('type')}>
            <option value="info">ℹ️ Info (Blue)</option>
            <option value="success">✅ Success (Green)</option>
            <option value="warning">⚠️ Warning (Yellow)</option>
            <option value="danger">🚨 Danger/Alert (Red)</option>
          </Select>
        </FormField>
        
        <FormField label="Target Audience">
          <Select value={form.target} onChange={set('target')} disabled={!isAdmin}>
            {isAdmin && <option value="all">📢 All Employees</option>}
            {(isAdmin || isTeamLeader) && <option value="team">👥 My Team Members Only</option>}
          </Select>
        </FormField>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn 
          variant="primary" 
          onClick={() => {
            if (!form.title.trim() || !form.message.trim()) {
              throwUIError(new Error('Please fill in both the title and message fields.'))
              return
            }
            onSubmit(form)
          }}
        >
          Post Announcement
        </Btn>
      </div>
    </Modal>
  )
}
