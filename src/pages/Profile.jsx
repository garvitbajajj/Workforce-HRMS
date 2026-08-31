import { useState, useEffect } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Avatar, Badge, FormField, Input, Btn } from '../components/Layout.jsx'
import { format } from 'date-fns'
import { supabase } from '../supabaseClient.js'

const formatDateSafe = (dateVal, formatStr = 'd MMMM yyyy', fallback = 'N/A') => {
  if (!dateVal || String(dateVal).trim().toLowerCase() === 'null') return fallback
  try {
    if (dateVal instanceof Date) {
      return format(dateVal, formatStr)
    }
    const d = new Date(dateVal)
    if (!isNaN(d.getTime())) {
      return format(d, formatStr)
    }
    const parts = String(dateVal).split(/[\/\-]/)
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10)
      const parsedD = new Date(year, month, day)
      if (!isNaN(parsedD.getTime())) {
        return format(parsedD, formatStr)
      }
    }
    return String(dateVal)
  } catch {
    return String(dateVal)
  }
}

export default function Profile() {
  const { state, dispatch, getLeaveBalance, getMonthlyStats } = useHRMS()
  const { currentUser } = state.auth
  const employee = currentUser?.employee
  const dept = state.departments.find(d => d.id === employee?.departmentId)
  const manager = employee?.managerId ? state.employees.find(e => e.id === employee.managerId) : null
  const balance = getLeaveBalance(employee?.id)
  const stats = getMonthlyStats(employee?.id)
  const leavesTaken = state.leaveRequests
    .filter(r => r.employeeId === employee?.id && r.status === 'approved')
    .reduce((sum, r) => sum + (r.totalDays || 0), 0)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    emergencyContact: '',
    bankDetails: '',
    dateOfBirth: ''
  })

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMsg, setPassMsg] = useState({ text: '', type: '' })
  const [showPassword, setShowPassword] = useState(false)

  const handleSuggestPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    let pass = "";
    // Guarantee at least 1 upper, 1 lower, 1 number, 1 special character
    pass += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    pass += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    pass += "0123456789"[Math.floor(Math.random() * 10)];
    pass += "!@#$%^&*()_+-="[Math.floor(Math.random() * 13)];
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Shuffle
    pass = pass.split('').sort(() => Math.random() - 0.5).join('');
    
    setNewPassword(pass)
    setConfirmPassword(pass)
    setPassMsg({ text: '🪄 Suggested a strong password. Confirm Password has been matched automatically!', type: 'success' })
  }

  const getPasswordStrength = (pass) => {
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

  const strength = getPasswordStrength(newPassword)

  useEffect(() => {
    if (employee) {
      setForm({
        phone: employee.phone || '',
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        emergencyContact: employee.emergencyContact || '',
        bankDetails: employee.bankDetails || '',
        dateOfBirth: employee.dateOfBirth || ''
      })
    }
  }, [employee])

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      setPassMsg({ text: 'Please fill both fields', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'Passwords do not match', type: 'error' })
      return
    }
    if (newPassword.length < 6) {
      setPassMsg({ text: 'Password must be at least 6 characters', type: 'error' })
      return
    }
    setPassMsg({ text: 'Updating...', type: 'info' })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPassMsg({ text: error.message, type: 'error' })
    } else {
      setPassMsg({ text: 'Password updated successfully!', type: 'success' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>My Profile</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Your personal and employment information</p>
      </div>

      {/* Profile header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Avatar name={employee?.avatar || 'U'} size={72} bg="#1a56db" />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>{employee?.firstName} {employee?.lastName}</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
              <Badge color="primary">{employee?.designation}</Badge>
              <Badge color="purple">{dept?.name}</Badge>
              <Badge color={currentUser?.role === 'admin' ? 'danger' : currentUser?.role === 'hr' ? 'warning' : 'gray'}>{currentUser?.role?.replace('_', ' ')}</Badge>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              {employee?.empCode} · Joined {formatDateSafe(employee?.joiningDate, 'd MMMM yyyy')}
              {manager && ` · Reports to ${manager.firstName} ${manager.lastName}`}
            </div>
          </div>
          <Btn variant="ghost" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit Profile'}</Btn>
        </div>

        {editing && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormField label="First Name"><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></FormField>
              <FormField label="Last Name"><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></FormField>
              <FormField label="Phone"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></FormField>
              <FormField label="Emergency Contact Info"><Input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="Contact Person, Phone Number, Relation..." /></FormField>
              <FormField label="Bank Account Details"><Input value={form.bankDetails} onChange={e => setForm(f => ({ ...f, bankDetails: e.target.value }))} placeholder="Account Number, IFSC, Bank Name..." /></FormField>
              <FormField label="Date of Birth"><Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></FormField>
            </div>
            <Btn variant="primary" size="sm" style={{ marginTop: 12 }} onClick={() => { dispatch({ type: 'UPDATE_EMPLOYEE', id: employee?.id, data: form }); setEditing(false) }}>Save Changes</Btn>
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Employment details */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Employment Details</div>
          {[
            { label: 'Employee Code', value: employee?.empCode },
            { label: 'Designation', value: employee?.designation },
            { label: 'Job Role', value: employee?.jobRole || 'N/A' },
            { label: 'Grade', value: employee?.grade || 'N/A' },
            { label: 'Level', value: employee?.level || 'N/A' },
            { label: 'Gender', value: employee?.gender || 'N/A' },
            { label: 'Joining Date', value: formatDateSafe(employee?.joiningDate, 'd MMMM yyyy') },
            { label: 'Date of Birth', value: formatDateSafe(employee?.dateOfBirth, 'd MMMM yyyy', 'Not set') },
            { label: 'DOJ Month', value: employee?.dojMonth || 'N/A' },
            { label: 'Account Manager (AM)', value: employee?.am || 'N/A' },
            { label: 'Email', value: currentUser?.email },
            { label: 'Salary', value: `₹${employee?.salary?.toLocaleString() || 0}` },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</span>
            </div>
          ))}
        </Card>

        {/* Leave & attendance summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Leave Summary</div>
            {[
              { label: 'Paid Balance', value: `${balance.paidBalance} days`, color: 'var(--primary)' },
              { label: 'Carried Forward', value: `${balance.carriedForward} days`, color: 'var(--purple)' },
              { label: 'Unpaid Used', value: `${balance.unpaidBalance} days`, color: 'var(--warning)' },
              { label: 'Total Available', value: `${parseFloat((balance.paidBalance + balance.carriedForward).toFixed(2))} days`, color: 'var(--success)' },
              { label: 'Total Leaves Taken', value: `${leavesTaken} days`, color: 'var(--text)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>This Month's Stats</div>
            {[
              { label: 'Days Present', value: stats.presentDays },
              { label: 'Total Hours', value: `${stats.totalHours}h` },
              { label: 'Late Arrivals', value: 0 },
              { label: 'Avg Hours/Day', value: stats.presentDays ? `${(stats.totalHours / stats.presentDays).toFixed(1)}h` : '0h' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Row 2: Personal, Financial & Security details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Personal & Financial Info */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Personal & Financial Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Phone</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{employee?.phone || 'Not set'}</div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Emergency Contact</div>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{employee?.emergencyContact || 'Not set'}</div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Bank Account Details</div>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{employee?.bankDetails || 'Not set'}</div>
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Security & Password</span>
            <button
              type="button"
              onClick={handleSuggestPassword}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              🪄 Suggest Password
            </button>
          </div>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormField label="New Password">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)' }}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>

              {/* Password strength UI */}
              {strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Password strength:</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: strength.color }}>{strength.label}</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${strength.percent}%`, height: '100%', background: strength.color, transition: 'width 0.2s ease-in-out' }} />
                  </div>
                </div>
              )}
            </FormField>
            <FormField label="Confirm Password">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{ paddingRight: 40 }}
                />
              </div>
            </FormField>
            {passMsg.text && (
              <div style={{
                fontSize: 12,
                color: passMsg.type === 'success' ? 'var(--success)' : passMsg.type === 'info' ? 'var(--primary)' : 'var(--danger)',
                background: passMsg.type === 'success' ? 'var(--success-light)' : passMsg.type === 'info' ? 'var(--primary-light)' : 'var(--danger-light)',
                padding: '8px 12px',
                borderRadius: 6,
                lineHeight: 1.4
              }}>
                {passMsg.text}
              </div>
            )}
            <Btn variant="primary" type="submit" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Update Password</Btn>
          </form>
        </Card>
      </div>

      {/* Leave history */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Leave History</div>
        {state.leaveRequests.filter(l => l.employeeId === employee?.id).length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>No leave requests yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.leaveRequests.filter(l => l.employeeId === employee?.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDateSafe(req.startDate, 'dd MMM')} – {formatDateSafe(req.endDate, 'dd MMM yyyy')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{req.totalDays} days · {req.leaveType} · {req.reason}</div>
                </div>
                <Badge color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}>{req.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
