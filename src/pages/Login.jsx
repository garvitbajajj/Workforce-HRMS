import { useState } from 'react'
import { useHRMS } from '../store.jsx'

export default function Login() {
  const { state, dispatch } = useHRMS()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    if (!forgotEmail) return
    dispatch({ type: 'REQUEST_PASSWORD_RESET', email: forgotEmail })
    setForgotSent(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    dispatch({ type: 'LOGIN', email, password })
    setLoading(false)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      width: '100%',
      flex: 1,
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: 'linear-gradient(135deg, #070b13 0%, #101a2f 50%, #070b13 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      {/* Ambient background glows */}
      <div style={{
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(26, 86, 219, 0.15) 0%, rgba(26, 86, 219, 0) 70%)',
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        zIndex: 0,
        pointerEvents: 'none',
        filter: 'blur(40px)'
      }} />
      <div style={{
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, rgba(124, 58, 237, 0) 70%)',
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        zIndex: 0,
        pointerEvents: 'none',
        filter: 'blur(50px)'
      }} />

      {/* Inject custom CSS classes for hover states, responsive layouts, and animations */}
      <style>{`
        .login-container {
          display: flex;
          width: 100%;
          max-width: 900px;
          min-height: 480px;
          background: linear-gradient(135deg, rgba(26, 86, 219, 0.12) 0%, rgba(15, 23, 42, 0.65) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
          position: relative;
          z-index: 1;
        }
        .left-panel {
          flex: 1.25;
          padding: 48px;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .right-panel {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 44px 32px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
          transform: translateY(-30px);
          transition: all 0.3s ease;
        }
        .login-card:hover {
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.45);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-33px);
        }
        .glass-tile {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.25s ease;
        }
        .glass-tile:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateX(6px);
        }
        .input-field {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }
        .input-field:focus {
          background: rgba(255, 255, 255, 0.09);
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
        .login-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #1a56db 0%, #1446c0 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(26, 86, 219, 0.3);
        }
        .login-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow: 0 6px 16px rgba(26, 86, 219, 0.4);
          transform: translateY(-1px);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .forgot-link {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }
        .forgot-link:hover {
          color: #60a5fa;
        }
        .forgot-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          padding: 20px;
        }
        .forgot-card {
          width: 100%;
          max-width: 400px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 32px;
        }
        @media (max-width: 768px) {
          .login-container {
            flex-direction: column;
            background: transparent;
            border: none;
            box-shadow: none;
          }
          .left-panel {
            display: none !important;
          }
          .right-panel {
            padding: 0;
          }
          .login-card {
            transform: none !important;
            background: rgba(15, 23, 42, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
        }
      `}</style>

      {/* Main split container */}
      <div className="login-container">
        {/* Left Info Panel */}
        <div className="left-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 40, height: 40, background: '#1a56db', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚡</div>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>WorkForce HRMS</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.8px' }}>
            Manage your team,<br/>effortlessly.
          </h1>
          <p style={{ fontSize: 15, opacity: 0.7, lineHeight: 1.5, marginBottom: 36 }}>
            Complete HR management — attendance, leaves, payroll analytics, and employee lifecycle in one unified platform.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🕐', text: 'Real-time attendance with IP tracking' },
              { icon: '📋', text: 'Automated leave accrual & approvals' },
              { icon: '📊', text: 'Payroll-ready reports & CSV export' },
            ].map(f => (
              <div key={f.text} className="glass-tile">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.9 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Form Panel with floating overlapping card */}
        <div className="right-panel">
          <div className="login-card">
            {/* Circular Glass Logo */}
            <div style={{
              width: 70,
              height: 70,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              fontSize: 32,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
            }}>
              ⚡
            </div>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>Welcome back</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Sign in to your workspace</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Email Address</label>
                <input 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  type="email" 
                  className="input-field" 
                  placeholder="you@company.com" 
                  required 
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    type={showPassword ? 'text' : 'password'} 
                    className="input-field" 
                    placeholder="••••••••" 
                    style={{ paddingRight: '40px' }}
                    required 
                  />
                  <button
                    type="button"
                    onMouseEnter={() => setShowPassword(true)}
                    onMouseLeave={() => setShowPassword(false)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.45)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      transition: 'color 0.15s'
                    }}
                    onFocus={() => {}}
                    onBlur={() => {}}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {state.auth.error && (
                <div style={{ 
                  background: 'rgba(224, 36, 36, 0.15)', 
                  border: '1px solid rgba(224, 36, 36, 0.3)', 
                  borderRadius: 8, 
                  padding: '10px 12px', 
                  color: '#fca5a5', 
                  fontSize: 12, 
                  marginBottom: 16 
                }}>
                  {state.auth.error}
                </div>
              )}
              <button 
                type="submit" 
                disabled={loading} 
                className="login-btn"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="forgot-link" onClick={() => { setShowForgot(true); setForgotEmail(email || ''); setForgotSent(false) }}>
                Forgot your password?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="forgot-overlay" onClick={() => setShowForgot(false)}>
          <div className="forgot-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Reset Password</h3>
              <button onClick={() => setShowForgot(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 }}>Request sent!</p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5 }}>A password reset request has been forwarded to the Admin. Please contact your administrator to receive your new password.</p>
                <button onClick={() => setShowForgot(false)} style={{ marginTop: 20, padding: '10px 24px', background: '#1a56db', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Got it</button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>Enter your email address to request a password reset from the Administrator.</p>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Email Address</label>
                <input
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  type="email"
                  className="input-field"
                  placeholder="you@company.com"
                  required
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" onClick={() => setShowForgot(false)} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }}>Request Reset</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
