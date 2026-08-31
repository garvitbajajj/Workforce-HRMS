import { useState } from 'react'

export default function ErrorOverlay({ error, onClose }) {
  const [showDetails, setShowDetails] = useState(false)

  if (!error) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      animation: 'errorFadeIn 0.3s ease-out forwards'
    }}>
      <style>{`
        @keyframes errorFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes errorSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .error-card {
          animation: errorSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      <div className="error-card" style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        maxHeight: '90vh',
        boxShadow: '0 24px 48px -12px rgba(224, 36, 36, 0.15), 0 8px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.02) 100%)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#e02424',
              borderRadius: '10px'
            }}>⚠️</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>
                {error.title || 'Application Exception'}
              </h3>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                An error occurred during operation execution
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: 'none',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#dc2626',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
          >
            ×
          </button>
        </div>

        {/* Message */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <div style={{
            fontSize: '14px',
            color: '#1f2937',
            lineHeight: 1.6,
            fontWeight: 500,
            whiteSpace: 'pre-line'
          }}>
            {error.message || 'An unknown error occurred.'}
          </div>

          {/* Details Accordion */}
          {error.stack && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#4b5563',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none'
                }}
              >
                <span style={{
                  transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'inline-block'
                }}>▶</span>
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>

              {showDetails && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px 16px',
                  background: '#0f172a',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <pre style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    color: '#f1f5f9',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(248, 250, 252, 0.8)',
          borderTop: '1px solid rgba(0, 0, 0, 0.05)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(135deg, #e02424 0%, #c81e1e 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(224, 36, 36, 0.25)'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
