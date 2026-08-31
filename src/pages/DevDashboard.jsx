import { useState, useEffect } from 'react'
import { useHRMS } from '../store.jsx'
import { supabase } from '../supabaseClient.js'
import { format } from 'date-fns'

const TABLES = [
  { name: 'employees', icon: '👥', color: '#3b82f6' },
  { name: 'attendance', icon: '🕐', color: '#10b981' },
  { name: 'leave_requests', icon: '📋', color: '#8b5cf6' },
  { name: 'leave_balances', icon: '💰', color: '#f59e0b' },
  { name: 'notifications', icon: '🔔', color: '#ef4444' },
  { name: 'holidays', icon: '🏖️', color: '#06b6d4' },
  { name: 'departments', icon: '🏢', color: '#ec4899' },
  { name: 'attendance_corrections', icon: '✏️', color: '#14b8a6' },
]

const QUICK_LINKS = [
  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', icon: '⚡' },
  { label: 'GitHub Repository', url: 'https://github.com/Abhishekkkakde/Huntsmen-Barons_HRMS', icon: '🐙' },
  { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', icon: '▲' },
]

export default function DevDashboard() {
  const { state } = useHRMS()
  const employee = state.auth.currentUser?.employee

  const [tableCounts, setTableCounts] = useState({})
  const [recentActivity, setRecentActivity] = useState([])
  const [supabaseStatus, setSupabaseStatus] = useState('checking')
  const [pingMs, setPingMs] = useState(null)
  const [clock, setClock] = useState(new Date())
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Supabase ping
  useEffect(() => {
    const ping = async () => {
      try {
        const start = performance.now()
        const { error } = await supabase.from('departments').select('id').limit(1)
        const end = performance.now()
        if (error) {
          setSupabaseStatus('error')
        } else {
          setSupabaseStatus('connected')
          setPingMs(Math.round(end - start))
        }
      } catch {
        setSupabaseStatus('error')
      }
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch table counts
  useEffect(() => {
    const fetchCounts = async () => {
      setLoadingCounts(true)
      const counts = {}
      for (const table of TABLES) {
        try {
          const { count, error } = await supabase
            .from(table.name)
            .select('*', { count: 'exact', head: true })
          counts[table.name] = error ? '—' : count
        } catch {
          counts[table.name] = '—'
        }
      }
      setTableCounts(counts)
      setLoadingCounts(false)
    }
    fetchCounts()
  }, [])

  // Fetch recent activity (last 20 notifications across all users)
  useEffect(() => {
    const fetchActivity = async () => {
      setLoadingActivity(true)
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, employees!notifications_employee_id_fkey(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!error && data) {
          setRecentActivity(data)
        }
      } catch {
        // silently fail
      }
      setLoadingActivity(false)
    }
    fetchActivity()
  }, [])

  // Department distribution from state
  const deptCounts = {}
  state.employees.forEach(e => {
    const d = e.departmentId || 'Unassigned'
    deptCounts[d] = (deptCounts[d] || 0) + 1
  })
  const deptData = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])
  const maxDeptCount = Math.max(...deptData.map(d => d[1]), 1)

  const DEPT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1']

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const maskedUrl = supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').replace(/\.supabase\.co.*/, '.supabase.co') : 'N/A'

  const getNotifTypeStyle = (type) => {
    switch (type) {
      case 'success': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', icon: '✅' }
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: '⚠️' }
      case 'error': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', icon: '❌' }
      default: return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: 'ℹ️' }
    }
  }

  if (!employee?.isDev) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Access Denied</h2>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>You do not have developer access. Contact an administrator.</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`
        .dev-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          color: #e2e8f0;
          transition: all 0.2s ease;
        }
        .dev-card:hover {
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .dev-stat-card {
          background: linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.9) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.2s ease;
          cursor: default;
        }
        .dev-stat-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        }
        .dev-table-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.04);
          transition: all 0.15s ease;
        }
        .dev-table-row:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.1);
        }
        .dev-activity-item {
          display: flex;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }
        .dev-activity-item:hover {
          background: rgba(255,255,255,0.03);
        }
        .dev-bar {
          height: 24px;
          border-radius: 6px;
          transition: width 0.6s ease;
          min-width: 4px;
        }
        .dev-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #94a3b8;
          text-decoration: none;
          transition: all 0.15s ease;
          font-size: 13px;
          font-weight: 500;
        }
        .dev-link:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.12);
          color: #e2e8f0;
          transform: translateX(4px);
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse-glow 2s infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
          50% { opacity: 0.5; box-shadow: 0 0 12px currentColor; }
        }
        @keyframes count-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .count-anim {
          animation: count-up 0.4s ease forwards;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            🛠️ Developer Console
          </h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>System health, database stats, and operational insights</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: '#94a3b8',
            fontFamily: 'monospace',
            letterSpacing: '0.5px'
          }}>
            {format(clock, 'HH:mm:ss')}
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: '#64748b'
          }}>
            {format(clock, 'EEE, d MMM yyyy')}
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* Supabase Status */}
        <div className="dev-stat-card">
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: supabaseStatus === 'connected' ? 'rgba(16,185,129,0.15)' : supabaseStatus === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
          }}>⚡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Supabase</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="pulse-dot" style={{
                background: supabaseStatus === 'connected' ? '#10b981' : supabaseStatus === 'error' ? '#ef4444' : '#f59e0b',
                color: supabaseStatus === 'connected' ? '#10b981' : supabaseStatus === 'error' ? '#ef4444' : '#f59e0b'
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: supabaseStatus === 'connected' ? '#34d399' : supabaseStatus === 'error' ? '#f87171' : '#fbbf24' }}>
                {supabaseStatus === 'connected' ? 'Connected' : supabaseStatus === 'error' ? 'Error' : 'Checking...'}
              </span>
              {pingMs !== null && <span style={{ fontSize: 11, color: '#64748b' }}>({pingMs}ms)</span>}
            </div>
          </div>
        </div>

        {/* Platform */}
        <div className="dev-stat-card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▲</div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Platform</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>Vercel</div>
          </div>
        </div>

        {/* Total Employees */}
        <div className="dev-stat-card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👥</div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Employees</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{state.employees.length} registered</div>
          </div>
        </div>

        {/* Framework */}
        <div className="dev-stat-card">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚛️</div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Stack</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#22d3ee' }}>React + Vite</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Database Statistics */}
        <div className="dev-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>📊 Database Tables</div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {loadingCounts ? 'Loading...' : `${TABLES.length} tables`}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TABLES.map((table, i) => (
              <div key={table.name} className="dev-table-row">
                <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{table.icon}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1', fontFamily: 'monospace' }}>{table.name}</span>
                </div>
                <div className={!loadingCounts ? 'count-anim' : ''} style={{ animationDelay: `${i * 60}ms` }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: table.color,
                    background: `${table.color}15`, padding: '3px 10px', borderRadius: 8,
                    fontFamily: 'monospace', minWidth: 50, textAlign: 'center', display: 'inline-block'
                  }}>
                    {loadingCounts ? '...' : (tableCounts[table.name] ?? '—')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="dev-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>📡 Recent System Activity</div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {loadingActivity ? 'Loading...' : `Last ${recentActivity.length} events`}
            </span>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {loadingActivity ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>Loading activity feed...</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>No activity recorded</div>
            ) : recentActivity.map((item, i) => {
              const typeStyle = getNotifTypeStyle(item.type)
              const empName = item.employees?.full_name || 'System'
              return (
                <div key={item.id || i} className="dev-activity-item">
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: typeStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14
                  }}>{typeStyle.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {empName} · {item.created_at ? format(new Date(item.created_at), 'dd MMM, HH:mm') : '—'}
                    </div>
                  </div>
                  <div style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: typeStyle.bg, color: typeStyle.color, textTransform: 'uppercase', letterSpacing: '0.5px',
                    flexShrink: 0
                  }}>
                    {item.type || 'info'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Employee Distribution */}
        <div className="dev-card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: '-0.3px' }}>🏢 Employee Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deptData.map(([name, count], i) => (
              <div key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: DEPT_COLORS[i % DEPT_COLORS.length] }}>{count}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  <div className="dev-bar" style={{
                    width: `${(count / maxDeptCount) * 100}%`,
                    background: `linear-gradient(90deg, ${DEPT_COLORS[i % DEPT_COLORS.length]}, ${DEPT_COLORS[i % DEPT_COLORS.length]}88)`
                  }} />
                </div>
              </div>
            ))}
            {deptData.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 13 }}>No department data</div>
            )}
          </div>
        </div>

        {/* Environment Info */}
        <div className="dev-card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: '-0.3px' }}>⚙️ Environment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Supabase Host', value: maskedUrl },
              { label: 'Environment', value: import.meta.env.MODE || 'production' },
              { label: 'Auth Provider', value: 'Supabase Auth' },
              { label: 'Session Storage', value: 'sessionStorage' },
              { label: 'Build Tool', value: 'Vite 5.x' },
              { label: 'Styling', value: 'Vanilla CSS (Inline)' },
              { label: 'Charts Library', value: 'Recharts' },
              { label: 'Logged In As', value: employee?.email || 'N/A' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dev-card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, letterSpacing: '-0.3px' }}>🚀 Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="dev-link">
                <span style={{ fontSize: 18 }}>{link.icon}</span>
                <span>{link.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.5 }}>↗</span>
              </a>
            ))}

            {/* System Summary */}
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>System Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Departments', value: state.departments.length },
                  { label: 'Holidays', value: state.holidays.length },
                  { label: 'Leave Requests', value: state.leaveRequests.length },
                  { label: 'Notifications', value: state.notifications.length },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
