import { useState } from 'react'
import { Card } from '../components/Layout.jsx'

export default function Policies() {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Company Policies</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Read the official company policies regarding leaves, attendance, and holidays</p>
        </div>
      </div>

      {/* Policy Document Card */}
      <Card
        onClick={() => setPreviewOpen(true)}
        style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px' }}>
          {/* PDF Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
          }}>
            <span style={{ color: 'white', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>PDF</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>Leave, Attendance and Holiday Policy</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Official Document · Click to preview</div>
          </div>
          <div style={{
            padding: '6px 14px', borderRadius: 8,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            fontSize: 12, fontWeight: 500, color: 'var(--text2)', flexShrink: 0
          }}>
            👁️ Preview
          </div>
        </div>
      </Card>

      {/* Fullscreen Preview Overlay (Google Drive style) */}
      {previewOpen && (
        <div 
          onClick={() => setPreviewOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {/* Top bar */}
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              height: 56, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px',
              background: 'rgba(32, 33, 36, 0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '-0.3px'
              }}>PDF</div>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 500 }}>Leave, Attendance and Holiday Policy.pdf</span>
            </div>
            <button
              onClick={() => setPreviewOpen(false)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
            >
              ✕
            </button>
          </div>

          {/* PDF viewer area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
            <iframe
              onClick={e => e.stopPropagation()}
              src="./policy.pdf#toolbar=0&navpanes=0&scrollbar=1"
              title="Leave, Attendance and Holiday Policy"
              style={{
                width: '100%', maxWidth: 900, height: '100%',
                border: 'none', borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                background: 'white'
              }}
            />
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
