import { useState, useRef } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Badge, Avatar, Modal, FormField, Input, Select, Btn } from '../components/Layout.jsx'
import Papa from 'papaparse'
import { format } from 'date-fns'

export default function Employees() {
  const { state, dispatch, getLeaveBalance, throwUIError } = useHRMS()
  const { currentUser } = state.auth
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editEmp, setEditEmp] = useState(null)
  const [viewEmp, setViewEmp] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  const canEdit = ['admin', 'hr'].includes(currentUser?.role)
  const canViewSalary = ['admin', 'hr'].includes(currentUser?.role)

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(emp => emp.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleExtractData = (exportAll = false) => {
    const targets = exportAll ? state.employees : state.employees.filter(e => selectedIds.includes(e.id))
    if (targets.length === 0) {
      throwUIError(new Error('Please select at least one employee or choose Extract All.'))
      return
    }

    const csvRows = []
    const headers = [
      'Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Team', 'Designation', 'Role', 'Joining Date',
      ...(canViewSalary ? ['Salary (INR)'] : []), 'Gender', 'Account Manager', 'Grade', 'Level', 'Status',
      ...(canViewSalary ? ['Emergency Contact', 'Bank Details'] : []),
      'Paid Leave Balance', 'Carried Forward Leaves', 'Unpaid Leaves Used', 'Total Leaves Taken',
      'Total Days Present', 'Total Hours Worked', 'Late Arrivals'
    ]
    csvRows.push(headers)

    targets.forEach(emp => {
      const balance = getLeaveBalance(emp.id)
      const dept = state.departments.find(d => d.id === emp.departmentId)
      const logs = state.attendanceLogs.filter(l => l.employeeId === emp.id)
      const totalPresent = logs.length
      const totalHours = logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0)
      const totalLate = logs.filter(l => l.isLate).length
      const leavesTaken = state.leaveRequests
        .filter(r => r.employeeId === emp.id && r.status === 'approved')
        .reduce((sum, r) => sum + (r.totalDays || 0), 0)

      const row = [
        emp.empCode || '',
        emp.firstName || '',
        emp.lastName || '',
        emp.email || '',
        emp.phone || '',
        dept?.name || '',
        emp.designation || '',
        emp.role || '',
        emp.joiningDate || '',
        ...(canViewSalary ? [emp.salary || 0] : []),
        emp.gender || '',
        emp.am || '',
        emp.grade || '',
        emp.level || '',
        emp.status || 'active',
        ...(canViewSalary ? [emp.emergencyContact || '', emp.bankDetails || ''] : []),
        balance.paidBalance,
        balance.carriedForward,
        balance.unpaidBalance,
        leavesTaken,
        totalPresent,
        parseFloat(totalHours.toFixed(1)),
        totalLate
      ]
      csvRows.push(row)
    })

    const csvContent = csvRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `employee_data_extract_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Derive unique team names from employees' department column
  const teams = [...new Set(state.employees.map(e => e.departmentId).filter(Boolean))].sort()

  const filtered = state.employees.filter(e => {
    const matchSearch = `${e.firstName} ${e.lastName} ${e.empCode} ${e.designation}`.toLowerCase().includes(search.toLowerCase())
    const matchTeam = !teamFilter || e.departmentId === teamFilter
    return matchSearch && matchTeam
  })


  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Employee Directory</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>{state.employees.length} employees across {teams.length} teams</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => handleExtractData(false)} disabled={selectedIds.length === 0}>
              📥 Extract Selected ({selectedIds.length})
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => handleExtractData(true)}>
              📥 Extract All
            </Btn>
          </div>
          {canEdit && (
            <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Employee</Btn>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, designation..." style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'white', outline: 'none' }}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <th style={{ padding: '12px 16px', width: 40, textAlign: 'left' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length} 
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                </th>
                {['Employee', 'Code', 'Team', 'Designation', 'Joining', ...(canViewSalary ? ['Salary'] : []), 'Team Leader', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const dept = state.departments.find(d => d.id === emp.departmentId)
                const teamLeader = state.employees.find(e => e.id === emp.managerId)
                const user = state.users.find(u => u.employeeId === emp.id)
                return (
                  <tr 
                    key={emp.id} 
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'pointer' }} 
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'} 
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={(e) => {
                      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                        return
                      }
                      setViewEmp(emp)
                    }}
                  >
                    <td style={{ padding: '13px 16px', width: 40 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(emp.id)} 
                        onChange={() => handleSelectOne(emp.id)} 
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={emp.avatar} size={34} bg={['#1a56db','#7c3aed','#05966b','#d97706','#e02424'][emp.id.charCodeAt(1) % 5]} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.firstName} {emp.lastName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{emp.empCode}</td>
                    <td style={{ padding: '13px 16px' }}><Badge color="primary">{dept?.name || 'N/A'}</Badge></td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)' }}>{emp.designation}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)' }}>{format(new Date(emp.joiningDate), 'dd MMM yyyy')}</td>
                    {canViewSalary && (
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600 }}>₹{emp.salary?.toLocaleString()}</td>
                    )}
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text2)' }}>{teamLeader ? `${teamLeader.firstName} ${teamLeader.lastName}` : '—'}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Btn variant="ghost" size="sm" onClick={() => setEditEmp(emp)}>Edit</Btn>
                          <Btn variant="danger" size="sm" onClick={() => { if (confirm(`Delete ${emp.firstName}?`)) dispatch({ type: 'DELETE_EMPLOYEE', id: emp.id }) }}>Del</Btn>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={canViewSalary ? 9 : 8} style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Employee Modal */}
      {showAdd && <EmployeeModal teams={teams} employees={state.employees} onClose={() => setShowAdd(false)} onSave={(data) => { dispatch({ type: 'ADD_EMPLOYEE', employee: data }); setShowAdd(false) }} />}
      {editEmp && <EmployeeModal employee={editEmp} teams={teams} employees={state.employees} onClose={() => setEditEmp(null)} onSave={(data) => { dispatch({ type: 'UPDATE_EMPLOYEE', id: editEmp.id, data }); setEditEmp(null) }} />}
      {viewEmp && <ViewEmployeeModal employee={viewEmp} dept={state.departments.find(d => d.id === viewEmp.departmentId)} teamLeader={state.employees.find(e => e.id === viewEmp.managerId)} onClose={() => setViewEmp(null)} />}

    </div>
  )
}

function ViewEmployeeModal({ employee, dept, teamLeader, onClose }) {
  const { state } = useHRMS()
  const leavesTaken = state.leaveRequests
    .filter(r => r.employeeId === employee.id && r.status === 'approved')
    .reduce((sum, r) => sum + (r.totalDays || 0), 0)

  return (
    <Modal title="Employee Profile" onClose={onClose} width={450}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 20, textAlign: 'center' }}>
        <Avatar name={employee.avatar} size={72} bg={['#1a56db','#7c3aed','#05966b','#d97706','#e02424'][employee.id.charCodeAt(1) % 5]} />
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{employee.firstName} {employee.lastName}</h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 0 0' }}>{employee.designation}</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Employee Code', value: employee.empCode },
          { label: 'Team', value: dept?.name || 'N/A' },
          { label: 'Job Role', value: employee.jobRole || 'N/A' },
          { label: 'Grade', value: employee.grade || 'N/A' },
          { label: 'Level', value: employee.level || 'N/A' },
          { label: 'Joining Date', value: employee.joiningDate ? format(new Date(employee.joiningDate), 'dd MMM yyyy') : 'N/A' },
          { label: 'Team Leader', value: teamLeader ? `${teamLeader.firstName} ${teamLeader.lastName}` : 'N/A' },
          { label: 'Total Leaves Taken', value: `${leavesTaken} days` },
          { label: 'Email', value: employee.email },
          { label: 'Phone', value: employee.phone || 'N/A' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{item.value}</span>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="primary" size="sm" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}

function EmployeeModal({ employee, teams, employees, onClose, onSave }) {
  const { throwUIError } = useHRMS()
  const [form, setForm] = useState({
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    email: employee?.email || '',
    password: 'pass123',
    changePassword: '',
    phone: employee?.phone || '',
    departmentId: employee?.departmentId || '',
    designation: employee?.designation || '',
    joiningDate: employee?.joiningDate || '',
    salary: employee?.salary || '',
    managerId: employee?.managerId || '',
    empCode: employee?.empCode || '',
    role: employee?.role || 'employee',
    initialPaidBalance: 0,
    carriedForward: 0,
    gender: employee?.gender || '',
    am: employee?.am || '',
    grade: employee?.grade || '',
    level: employee?.level || '',
    dojMonth: employee?.dojMonth || '',
    jobRole: employee?.jobRole || '',
    emergencyContact: employee?.emergencyContact || '',
    bankDetails: employee?.bankDetails || ''
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Modal title={employee ? 'Edit Employee' : 'Add New Employee'} onClose={onClose} width={680}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <FormField label="First Name *"><Input value={form.firstName} onChange={set('firstName')} placeholder="John" /></FormField>
        <FormField label="Last Name *"><Input value={form.lastName} onChange={set('lastName')} placeholder="Doe" /></FormField>
        {!employee && <FormField label="Email *"><Input type="email" value={form.email} onChange={set('email')} placeholder="john@company.com" /></FormField>}
        {!employee ? (
          <FormField label="Password"><Input value={form.password} onChange={set('password')} placeholder="Initial password" /></FormField>
        ) : (
          <FormField label="Change Password"><Input type="password" value={form.changePassword} onChange={set('changePassword')} placeholder="Leave blank to keep current" /></FormField>
        )}
        <FormField label="Phone"><Input value={form.phone} onChange={set('phone')} placeholder="9876543210" /></FormField>
        <FormField label="Employee Code"><Input value={form.empCode} onChange={set('empCode')} placeholder="EMP001" /></FormField>
        
        <FormField label="Team *">
          <Select value={form.departmentId} onChange={set('departmentId')}>
            <option value="">Select...</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Designation *"><Input value={form.designation} onChange={set('designation')} placeholder="Software Engineer" /></FormField>
        <FormField label="Job Role"><Input value={form.jobRole} onChange={set('jobRole')} placeholder="e.g. Talent Specialist" /></FormField>
        <FormField label="Account Manager (AM)"><Input value={form.am} onChange={set('am')} placeholder="AM Name" /></FormField>

        <FormField label="Grade">
          <Select value={form.grade} onChange={set('grade')}>
            <option value="">Select...</option>
            {['HB 1.1', 'HB 1.2', 'HB 1.3', 'HB 2.1', 'HB 2.2', 'HB 3.1', 'HB 3.2', 'HB 4.1', 'HB 4.2', 'HB 4.3', 'HB 5.1', 'HB 5.2'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Level">
          <Select value={form.level} onChange={set('level')}>
            <option value="">Select...</option>
            {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Gender">
          <Select value={form.gender} onChange={set('gender')}>
            <option value="">Select...</option>
            {['Male', 'Female', 'Other'].map(g => <option key={g} value={g}>{g}</option>)}
          </Select>
        </FormField>
        <FormField label="System Role">
          <Select value={form.role} onChange={set('role')}>
                {['employee','team_leader','hr','admin'].map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </Select>
        </FormField>

        <FormField label="Joining Date *"><Input type="date" value={form.joiningDate} onChange={set('joiningDate')} /></FormField>
        <FormField label="DOJ Month"><Input value={form.dojMonth} onChange={set('dojMonth')} placeholder="e.g. Jun-26" /></FormField>
        <FormField label="Salary (₹) *"><Input type="number" value={form.salary} onChange={set('salary')} placeholder="80000" /></FormField>
        <FormField label="Emergency Contact Info"><Input value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="Name, Phone, Relation..." /></FormField>
        <FormField label="Bank Account Details"><Input value={form.bankDetails} onChange={set('bankDetails')} placeholder="Account No, Bank, IFSC..." /></FormField>

        {!employee && <>
          <FormField label="Initial Paid Balance (days)"><Input type="number" step="0.5" value={form.initialPaidBalance} onChange={set('initialPaidBalance')} placeholder="0" /></FormField>
          <FormField label="Carried Forward (days)"><Input type="number" step="0.5" value={form.carriedForward} onChange={set('carriedForward')} placeholder="0" /></FormField>
        </>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { 
          if (!form.firstName || !form.lastName || !form.departmentId || !form.designation || !form.joiningDate) { 
            throwUIError(new Error('Fill required fields')); 
            return; 
          }
          
          // Resolve managerId based on chosen team lead name (departmentId)
          const selectedTeam = form.departmentId;
          let resolvedManagerId = '';
          if (selectedTeam) {
            const manager = employees.find(e => 
              `${e.firstName} ${e.lastName}`.toLowerCase().includes(selectedTeam.toLowerCase())
            );
            if (manager) {
              resolvedManagerId = manager.id;
            }
          }
          
          onSave({ ...form, managerId: resolvedManagerId });
        }}>
          {employee ? 'Save Changes' : 'Add Employee'}
        </Btn>
      </div>
    </Modal>
  )
}
