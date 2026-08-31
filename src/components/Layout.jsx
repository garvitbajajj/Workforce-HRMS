import { useState, useEffect } from 'react'
import { useHRMS } from '../store.jsx'
import { format, parseISO } from 'date-fns'
import { supabase } from '../supabaseClient.js'

const NAV = [
  { id: 'dashboard', icon: '▦', label: 'Dashboard', roles: ['admin','hr','team_leader','employee'] },
  { id: 'attendance', icon: '🕐', label: 'Attendance', roles: ['admin','hr','team_leader','employee'] },
  { id: 'leaves', icon: '📋', label: 'Leaves', roles: ['admin','hr','team_leader','employee'] },
  { id: 'employees', icon: '👥', label: 'Employees', roles: ['admin','hr','team_leader'] },
  { id: 'holidays', icon: '🏖️', label: 'Holidays', roles: ['admin','hr','team_leader','employee'] },
  { id: 'policies', icon: '📜', label: 'Policies', roles: ['admin','hr','team_leader','employee'] },
  { id: 'reports', icon: '📊', label: 'Reports', roles: ['admin','hr'] },
]

export default function Layout({ page, setPage, children }) {
  const { state, dispatch, getEmpNotifs, getTodayLog, viewMode, setViewMode } = useHRMS()
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const [showNotifs, setShowNotifs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pickerNotifId, setPickerNotifId] = useState(null)

  const [recPassword, setRecPassword] = useState('')
  const [recConfirm, setRecConfirm] = useState('')
  const [recLoading, setRecLoading] = useState(false)
  const [recMsg, setRecMsg] = useState({ text: '', type: '' })
  const [showRecPass, setShowRecPass] = useState(false)

  const handleRecPasswordChange = async (e) => {
    e.preventDefault()
    if (!recPassword || !recConfirm) {
      setRecMsg({ text: 'Please fill both fields', type: 'error' })
      return
    }
    if (recPassword !== recConfirm) {
      setRecMsg({ text: 'Passwords do not match', type: 'error' })
      return
    }
    if (recPassword.length < 6) {
      setRecMsg({ text: 'Password must be at least 6 characters', type: 'error' })
      return
    }
    setRecLoading(true)
    setRecMsg({ text: 'Updating password...', type: 'info' })
    const { error } = await supabase.auth.updateUser({ password: recPassword })
    setRecLoading(false)
    if (error) {
      setRecMsg({ text: error.message, type: 'error' })
    } else {
      setRecMsg({ text: 'Password updated successfully! Redirecting...', type: 'success' })
      setRecPassword('')
      setRecConfirm('')
      setTimeout(() => {
        dispatch({ type: 'DISMISS_RECOVERY' })
      }, 1500)
    }
  }

  const handleRecSuggest = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    let pass = "";
    pass += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    pass += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    pass += "0123456789"[Math.floor(Math.random() * 10)];
    pass += "!@#$%^&*()_+-="[Math.floor(Math.random() * 13)];
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass = pass.split('').sort(() => Math.random() - 0.5).join('');
    setRecPassword(pass)
    setRecConfirm(pass)
    setRecMsg({ text: '🪄 Suggested a strong password. Confirm Password has been matched automatically!', type: 'success' })
  }

  const getRecStrength = (pass) => {
    if (!pass) return null
    if (pass.length < 6) return { label: 'Too Short', color: '#ef4444', percent: 25 }
    let score = 0
    if (pass.length >= 8) score += 1
    if (/[A-Z]/.test(pass)) score += 1
    if (/[a-z]/.test(pass)) score += 1
    if (/[0-9]/.test(pass)) score += 1
    if (/[^A-Za-z0-9]/.test(pass)) score += 1

    if (score <= 1) return { label: 'Weak', color: '#f97316', percent: 50 }
    if (score === 2 || score === 3) return { label: 'Medium', color: '#eab308', percent: 75 }
    return { label: 'Strong', color: '#10b981', percent: 100 }
  }

  const recStrength = getRecStrength(recPassword)

  const notifs = getEmpNotifs(employee?.id || '')
  const unread = notifs.filter(n => !n.isRead).length
  
  const activeRole = (currentUser?.role === 'admin' || currentUser?.role === 'hr') && viewMode === 'employee' ? 'employee' : currentUser?.role
  const navItems = [
    ...NAV.filter(n => n.roles.includes(activeRole)),
    ...(employee?.isDev ? [{ id: 'devdashboard', icon: '🛠️', label: 'Dev Console' }] : [])
  ]

  // Clock in/out logic
  const todayLog = getTodayLog(employee?.id)

  const handleClockIn = async () => {
    let ip = '192.168.1.1'
    try { const res = await fetch('https://api.ipify.org?format=json'); const d = await res.json(); ip = d.ip } catch { }
    dispatch({ type: 'CLOCK_IN', employeeId: employee?.id, ip })
  }
  const handleClockOut = () => { if (todayLog) dispatch({ type: 'CLOCK_OUT', logId: todayLog.id }) }

  // Redirect to dashboard if the page is no longer allowed in current view mode

  useEffect(() => {
    if (page === 'profile') return // Profile page is always allowed for authenticated users
    const isAllowed = navItems.some(n => n.id === page)
    if (!isAllowed) {
      setPage('dashboard')
    }
  }, [activeRole, page, navItems, setPage])

  const handleNavClick = (id) => {
    setPage(id)
    setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>

      {/* Sidebar wrapper — slides in on hover or mobile toggle */}
      <div className={`sidebar-wrapper ${sidebarOpen ? 'open' : ''}`} onMouseLeave={() => setSidebarOpen(false)}>
        <aside>
          {/* Logo */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: '#1a56db', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>WorkForce</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>HRMS Platform</div>
              </div>
            </div>
          </div>

          {/* Clock In / Clock Out Buttons */}
          <div className="sidebar-clock-btns">
            {(!todayLog || todayLog.clockOut) && (
              <button className="btn-clock-in" onClick={handleClockIn}>
                ▶ {todayLog ? 'Clock In Again' : 'Clock In'}
              </button>
            )}
            {todayLog && !todayLog.clockOut && (
              <>
                <button className="btn-clock-out" onClick={handleClockOut}>
                  ⏹ Clock Out
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'var(--mono)' }}>
                  In: {format(parseISO(todayLog.clockIn), 'h:mm a')}
                </div>
              </>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 600, letterSpacing: '1px', padding: '0 8px', marginBottom: 8, textTransform: 'uppercase' }}>Menu</div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2,
                  background: page === item.id ? 'rgba(26,86,219,0.3)' : 'transparent',
                  color: page === item.id ? '#60a5fa' : 'rgba(255,255,255,0.55)',
                  fontSize: 13.5, fontWeight: page === item.id ? 600 : 400, transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
                {page === item.id && <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#60a5fa' }} />}
              </button>
            ))}
          </nav>

          {/* User profile */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name={employee?.avatar || 'U'} size={34} bg="#1e40af" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{employee?.firstName} {employee?.lastName}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, textTransform: 'capitalize' }}>{currentUser?.role?.replace('_', ' ')}</div>
              </div>
            </div>
            <button onClick={() => dispatch({ type: 'LOGOUT' })}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
              Sign Out
            </button>
          </div>
        </aside>
      </div>

      {/* Overlay to close sidebar */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="main-content-wrapper">
        {/* Topbar */}
        <header style={{ height: 'var(--topbar-h)', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div
            className="sidebar-dots"
            onMouseEnter={() => setSidebarOpen(true)}
          >
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>{navItems.find(n => n.id === page)?.label || 'Dashboard'}</div>
            <div className="topbar-date" style={{ fontSize: 12, color: 'var(--text3)' }}>{format(new Date(), 'EEEE, d MMMM yyyy')}</div>
          </div>

          {/* View Toggle for Admin/HR */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'hr') && (
            <div style={{ display: 'inline-flex', background: 'var(--surface2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', marginRight: 12 }}>
              <button 
                onClick={() => setViewMode('admin')} 
                style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: viewMode === 'admin' ? 'white' : 'transparent', color: viewMode === 'admin' ? 'var(--text)' : 'var(--text3)', fontWeight: viewMode === 'admin' ? 600 : 400, fontSize: 12, cursor: 'pointer', boxShadow: viewMode === 'admin' ? 'var(--shadow)' : 'none', transition: 'all 0.15s' }}
              >
                🏢 Admin<span className="toggle-text-label"> View</span>
              </button>
              <button 
                onClick={() => setViewMode('employee')} 
                style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: viewMode === 'employee' ? 'white' : 'transparent', color: viewMode === 'employee' ? 'var(--text)' : 'var(--text3)', fontWeight: viewMode === 'employee' ? 600 : 400, fontSize: 12, cursor: 'pointer', boxShadow: viewMode === 'employee' ? 'var(--shadow)' : 'none', transition: 'all 0.15s' }}
              >
                👤 Employee<span className="toggle-text-label"> View</span>
              </button>
            </div>
          )}

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifs(!showNotifs)}
              style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', fontSize: 16 }}>
              🔔
              {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 17, height: 17, background: '#e02424', borderRadius: '50%', fontSize: 10, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{unread}</span>}
            </button>
            {showNotifs && (
              <div style={{ position: 'absolute', right: 0, top: 46, width: 370, maxWidth: 'calc(100vw - 32px)', background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                  {unread > 0 && <button onClick={() => { dispatch({ type: 'MARK_ALL_READ', employeeId: employee?.id }); setShowNotifs(false) }} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>}
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No notifications</div>
                  ) : notifs.slice(0, 15).map(n => {
                    const ackCount = (n.acknowledgedBy || []).length
                    const hasAcked = (n.acknowledgedBy || []).includes(employee?.id)
                    const ackNames = (n.acknowledgedBy || []).map(aid => {
                      const e = state.employees.find(emp => emp.id === aid)
                      return e ? `${e.firstName} ${e.lastName}` : 'Unknown'
                    }).join(', ')
                    return (
                    <div key={n.id} 
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: n.type === 'birthday' ? (n.isRead ? '#fffbf0' : '#fff3d6') : (n.isRead ? 'white' : '#f0f5ff'), transition: 'background 0.15s' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => { dispatch({ type: 'MARK_NOTIF_READ', id: n.id }); setPickerNotifId(null); }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{n.type === 'birthday' ? '🎂' : n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : n.type === 'danger' ? '❌' : 'ℹ️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: n.type === 'birthday' ? '#b45309' : 'var(--text)' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: n.type === 'birthday' ? '#92400e' : 'var(--text2)', lineHeight: 1.4 }}>{n.message}</div>
                        </div>
                      </div>
                      
                      {/* Reactions & Acknowledge Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                        {/* Reaction pills on the left */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          {Object.entries(n.reactions || {}).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null
                            const hasReacted = userIds.includes(employee?.id)
                            const reactorNames = userIds.map(uid => {
                              const e = state.employees.find(emp => emp.id === uid)
                              return e ? `${e.firstName} ${e.lastName}` : 'Unknown'
                            }).join(', ')
                            return (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  dispatch({ type: 'REACT_NOTIFICATION', notifId: n.id, employeeId: employee?.id, emoji })
                                }}
                                title={reactorNames}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  padding: '2px 6px', borderRadius: 10,
                                  background: hasReacted ? '#e0e7ff' : 'var(--surface2)',
                                  border: `1px solid ${hasReacted ? '#c7d2fe' : 'var(--border)'}`,
                                  color: hasReacted ? '#4338ca' : 'var(--text)',
                                  fontSize: 11, cursor: 'pointer',
                                  transition: 'all 0.15s', fontWeight: 500
                                }}
                              >
                                <span>{emoji}</span>
                                <span style={{ fontSize: 10, opacity: 0.85 }}>{userIds.length}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Action buttons on the right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                          {ackCount > 0 && (
                            <span title={ackNames} style={{ fontSize: 11, color: 'var(--text3)', cursor: 'default' }}>
                              {ackCount} {ackCount === 1 ? 'ack' : 'acks'}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!hasAcked) dispatch({ type: 'ACK_NOTIFICATION', notifId: n.id, employeeId: employee?.id }) }}
                            title={hasAcked ? 'You acknowledged this' : 'Acknowledge'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 8px', borderRadius: 14,
                              background: hasAcked ? '#dbeafe' : 'var(--surface2)',
                              border: `1px solid ${hasAcked ? '#93c5fd' : 'var(--border)'}`,
                              color: hasAcked ? '#1d4ed8' : 'var(--text3)',
                              fontSize: 13, cursor: hasAcked ? 'default' : 'pointer',
                              transition: 'all 0.15s', fontWeight: 500
                            }}
                          >
                            {hasAcked ? '👍' : '👍🏻'}
                          </button>

                          {/* Reaction Picker Button */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setPickerNotifId(pickerNotifId === n.id ? null : n.id) }}
                              title="React with Emoji"
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 26, height: 26, borderRadius: '50%',
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                                color: 'var(--text2)'
                              }}
                            >
                              😀
                            </button>
                            {pickerNotifId === n.id && (
                              <div style={{
                                position: 'absolute', right: 0, bottom: 32,
                                background: 'white', border: '1px solid var(--border)',
                                borderRadius: 20, padding: '4px 8px',
                                boxShadow: 'var(--shadow-md)', display: 'flex', gap: 6,
                                zIndex: 10, animation: 'fadeIn 0.15s ease',
                                whiteSpace: 'nowrap'
                              }}>
                                {['👍', '❤️', '🎉', '👏', '😂', '😮'].map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      dispatch({ type: 'REACT_NOTIFICATION', notifId: n.id, employeeId: employee?.id, emoji })
                                      setPickerNotifId(null)
                                    }}
                                    style={{
                                      background: 'none', border: 'none',
                                      fontSize: 16, cursor: 'pointer',
                                      transition: 'transform 0.1s', padding: 2
                                    }}
                                    onMouseEnter={e => e.target.style.transform = 'scale(1.3)'}
                                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}
          </div>

          <Avatar name={employee?.avatar || 'U'} size={34} bg="#1a56db" onClick={() => { setPage('profile'); setShowNotifs(false) }} />
        </header>

        {/* Page content */}
        <main className="main-container" onClick={() => { setShowNotifs(false); setPickerNotifId(null); }}>
          {children}
        </main>
      </div>

      {state.auth.isPasswordRecovery && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 20
        }}>
          <div className="modal-content-animated" style={{
            background: 'linear-gradient(135deg, #101a2f 0%, #070b13 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'white',
            borderRadius: 16,
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'white' }}>Choose New Password</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Please enter a strong password for your account.</p>
            </div>

            <form onSubmit={handleRecPasswordChange}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={recPassword}
                    onChange={e => setRecPassword(e.target.value)}
                    type={showRecPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      fontSize: 14,
                      outline: 'none',
                      color: 'white',
                      paddingRight: 40
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecPass(!showRecPass)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      fontSize: 12
                    }}
                  >
                    {showRecPass ? 'Hide' : 'Show'}
                  </button>
                </div>

                {/* Password Suggestion Button */}
                <div style={{ textAlign: 'right', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleRecSuggest}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 11, cursor: 'pointer', padding: 0 }}
                  >
                    🪄 Suggest a strong password
                  </button>
                </div>

                {/* Password Strength Meter */}
                {recStrength && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                      <span>Strength: <strong style={{ color: recStrength.color }}>{recStrength.label}</strong></span>
                    </div>
                    <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${recStrength.percent}%`, height: '100%', background: recStrength.color, transition: 'all 0.3s ease' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>Confirm Password</label>
                <input
                  value={recConfirm}
                  onChange={e => setRecConfirm(e.target.value)}
                  type={showRecPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    fontSize: 14,
                    outline: 'none',
                    color: 'white'
                  }}
                  required
                />
              </div>

              {recMsg.text && (
                <div style={{
                  background: recMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : recMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${recMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : recMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: recMsg.type === 'error' ? '#fca5a5' : recMsg.type === 'success' ? '#a7f3d0' : '#bfdbfe',
                  fontSize: 12,
                  marginBottom: 16
                }}>
                  {recMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'DISMISS_RECOVERY' })}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recLoading}
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #1a56db 0%, #1446c0 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(26, 86, 219, 0.3)'
                  }}
                >
                  {recLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function Avatar({ name, size = 36, bg = '#1a56db', onClick }) {
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}>
      {name}
    </div>
  )
}

export function Card({ children, style, onClick }) {
  return (
    <div className="hover-card slide-up" onClick={onClick} style={{ background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '20px', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  )
}

export function Badge({ children, color = 'primary' }) {
  const colors = {
    primary: { bg: '#ebf0fd', text: '#1a56db' },
    success: { bg: '#edfaf5', text: '#05966b' },
    warning: { bg: '#fffbeb', text: '#d97706' },
    danger: { bg: '#fef2f2', text: '#e02424' },
    purple: { bg: '#f5f3ff', text: '#7c3aed' },
    gray: { bg: '#f3f4f6', text: '#6b7280' },
  }
  const c = colors[color] || colors.gray
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>{children}</span>
}

export function StatCard({ label, value, sub, icon, color = '#1a56db', bgColor }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
        </div>
        {icon && <div style={{ width: 44, height: 44, borderRadius: 12, background: bgColor || `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>}
      </div>
    </Card>
  )
}

export function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div className="fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div className="modal-content-animated" style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

export function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ ...props }) {
  return <input {...props} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', ...props.style }} />
}

export function Select({ children, ...props }) {
  return <select {...props} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white', ...props.style }}>{children}</select>
}

export function Btn({ children, variant = 'primary', size = 'md', ...props }) {
  const styles = {
    primary: { background: 'var(--primary)', color: 'white', border: 'none' },
    secondary: { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--danger)', color: 'white', border: 'none' },
    success: { background: 'var(--success)', color: 'white', border: 'none' },
    ghost: { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)' },
  }
  const sizes = { sm: '7px 12px', md: '9px 18px', lg: '11px 24px' }
  return (
    <button {...props} style={{ padding: sizes[size], borderRadius: 8, fontSize: size === 'sm' ? 12 : 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', ...styles[variant], ...props.style }}>
      {children}
    </button>
  )
}
