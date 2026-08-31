import { useState } from 'react'
import { useHRMS } from '../store.jsx'
import { Card, Badge, StatCard, Btn } from '../components/Layout.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import Papa from 'papaparse'

export default function Reports() {
  const { state } = useHRMS()
  const [reportType, setReportType] = useState('attendance')
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deptFilter, setDeptFilter] = useState('')

  // Monthly attendance trends (last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))
  const monthlyTrend = last6Months.map(m => {
    const mStr = format(m, 'yyyy-MM')
    const logs = state.attendanceLogs.filter(l => l.workDate.startsWith(mStr))
    const empCount = state.employees.length || 1
    return {
      month: format(m, 'MMM'),
      present: [...new Set(logs.map(l => l.employeeId))].length,
      late: logs.filter(l => l.isLate).length,
      avgHours: logs.length ? parseFloat((logs.reduce((s, l) => s + (l.hoursWorked || 0), 0) / logs.length).toFixed(1)) : 0,
    }
  })

  // Leave stats
  const leaveStats = last6Months.map(m => {
    const mStr = format(m, 'yyyy-MM')
    const reqs = state.leaveRequests.filter(l => l.startDate.startsWith(mStr))
    return {
      month: format(m, 'MMM'),
      approved: reqs.filter(l => l.status === 'approved').length,
      rejected: reqs.filter(l => l.status === 'rejected').length,
      pending: reqs.filter(l => l.status === 'pending').length,
    }
  })

  // Dynamic unique teams/departments from employees
  const uniqueDepts = [...new Set(state.employees.map(e => e.departmentId).filter(Boolean))].sort()

  // 1. Attendance Report Data (filtered by date and team)
  const filteredAttendance = state.attendanceLogs
    .filter(l => l.workDate >= dateFrom && l.workDate <= dateTo)
    .filter(l => {
      if (!deptFilter) return true
      const emp = state.employees.find(e => e.id === l.employeeId)
      return emp?.departmentId === deptFilter
    })
    .map(l => {
      const emp = state.employees.find(e => e.id === l.employeeId)
      return {
        id: l.id,
        date: l.workDate,
        empCode: emp?.empCode || 'N/A',
        name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        dept: emp?.departmentId || 'Unassigned',
        clockIn: l.clockIn ? format(parseISO(l.clockIn), 'HH:mm') : '--:--',
        clockOut: l.clockOut ? format(parseISO(l.clockOut), 'HH:mm') : '--:--',
        hours: l.hoursWorked || 0,
        isLate: l.isLate,
        status: l.status || 'present'
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  // 2. Leave Report Data (filtered by date range and team)
  const filteredLeaves = state.leaveRequests
    .filter(l => l.startDate >= dateFrom && l.startDate <= dateTo)
    .filter(l => {
      if (!deptFilter) return true
      const emp = state.employees.find(e => e.id === l.employeeId)
      return emp?.departmentId === deptFilter
    })
    .map(l => {
      const emp = state.employees.find(e => e.id === l.employeeId)
      return {
        id: l.id,
        name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        empCode: emp?.empCode || 'N/A',
        dept: emp?.departmentId || 'Unassigned',
        type: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.totalDays,
        reason: l.reason || 'N/A',
        status: l.status
      }
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  // 3. Employee Productivity Data (filtered by team, calculations within date range)
  const empProductivity = state.employees
    .filter(e => !deptFilter || e.departmentId === deptFilter)
    .map(emp => {
      const logs = state.attendanceLogs.filter(l => l.employeeId === emp.id && l.workDate >= dateFrom && l.workDate <= dateTo)
      const totalHours = logs.reduce((s, l) => s + (l.hoursWorked || 0), 0)
      const balance = state.leaveBalances.find(b => b.employeeId === emp.id) || {}
      return {
        empId: emp.id,
        empCode: emp.empCode || 'N/A',
        name: `${emp.firstName} ${emp.lastName}`,
        dept: emp.departmentId || 'Unassigned',
        presentDays: logs.length,
        totalHours: parseFloat(totalHours.toFixed(1)),
        lateDays: logs.filter(l => l.isLate).length,
        paidLeaveBalance: (balance.paidBalance || 0) + (balance.carriedForward || 0),
        leavesUsed: state.leaveRequests.filter(l => l.employeeId === emp.id && l.status === 'approved').reduce((s, l) => s + l.totalDays, 0),
      }
    })

  const exportCSV = () => {
    let data = []
    if (reportType === 'attendance') {
      data = filteredAttendance.map(l => ({
        Date: l.date, EmployeeCode: l.empCode, Name: l.name, Department: l.dept,
        ClockIn: l.clockIn, ClockOut: l.clockOut, HoursWorked: l.hours,
        Status: l.status, IsLate: l.isLate ? 'Yes' : 'No'
      }))
    } else if (reportType === 'leave') {
      data = filteredLeaves.map(l => ({
        EmployeeCode: l.empCode, Name: l.name, Department: l.dept,
        LeaveType: l.type, StartDate: l.startDate, EndDate: l.endDate,
        TotalDays: l.days, Reason: l.reason, Status: l.status
      }))
    } else {
      data = empProductivity.map(e => ({
        EmployeeCode: e.empCode, Name: e.name, Department: e.dept,
        PresentDays: e.presentDays, TotalHours: e.totalHours, LateDays: e.lateDays,
        PaidLeaveBalance: e.paidLeaveBalance, LeavesUsed: e.leavesUsed
      }))
    }
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hrms_${reportType}_report_${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
  }

  const exportPayrollCSV = () => {
    const data = state.employees.map(emp => {
      const bal = state.leaveBalances.find(b => b.employeeId === emp.id) || {}
      const monthLogs = state.attendanceLogs.filter(l => l.employeeId === emp.id && l.workDate.startsWith(format(new Date(), 'yyyy-MM')))
      const leavesUsed = state.leaveRequests.filter(l => l.employeeId === emp.id && l.status === 'approved' && l.leaveType === 'unpaid' && l.startDate.startsWith(format(new Date(), 'yyyy-MM'))).reduce((s, l) => s + l.totalDays, 0)
      return {
        EmployeeCode: emp.empCode, Name: `${emp.firstName} ${emp.lastName}`,
        Designation: emp.designation, Department: emp.departmentId || 'Unassigned',
        GrossSalary: emp.salary, PresentDays: monthLogs.length, TotalHours: monthLogs.reduce((s, l) => s + (l.hoursWorked || 0), 0).toFixed(1),
        LateDays: monthLogs.filter(l => l.isLate).length, UnpaidLeaveDays: leavesUsed,
        Deduction: ((emp.salary / 26) * leavesUsed).toFixed(2), NetPayable: (emp.salary - (emp.salary / 26) * leavesUsed).toFixed(2),
        PaidLeaveBalance: (bal.paidBalance || 0) + (bal.carriedForward || 0),
        Month: format(new Date(), 'MMMM yyyy')
      }
    })
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `payroll_export_${format(new Date(), 'yyyyMM')}.csv`; a.click()
  }

  // Summary totals
  const totalHoursThisMonth = state.attendanceLogs.filter(l => l.workDate.startsWith(format(new Date(), 'yyyy-MM'))).reduce((s, l) => s + (l.hoursWorked || 0), 0)
  const pendingLeaves = state.leaveRequests.filter(l => l.status === 'pending').length
  const lateThisMonth = state.attendanceLogs.filter(l => l.isLate && l.workDate.startsWith(format(new Date(), 'yyyy-MM'))).length

  const renderTable = () => {
    if (reportType === 'attendance') {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Code', 'Employee', 'Team', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Late'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAttendance.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 600 }}>{log.date}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>{log.empCode}</td>
                <td style={{ padding: '11px 14px', fontWeight: 500 }}>{log.name}</td>
                <td style={{ padding: '11px 14px' }}><Badge color="primary">{log.dept}</Badge></td>
                <td style={{ padding: '11px 14px' }}>{log.clockIn}</td>
                <td style={{ padding: '11px 14px' }}>{log.clockOut}</td>
                <td style={{ padding: '11px 14px' }}>{log.hours}h</td>
                <td style={{ padding: '11px 14px' }}>
                  <Badge color={log.status === 'present' ? 'success' : log.status === 'absent' ? 'danger' : 'warning'}>{log.status}</Badge>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  {log.isLate ? <Badge color="danger">Yes</Badge> : <Badge color="success">No</Badge>}
                </td>
              </tr>
            ))}
            {filteredAttendance.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>No attendance logs found in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      )
    }

    if (reportType === 'leave') {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Code', 'Employee', 'Team', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLeaves.map(req => (
              <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>{req.empCode}</td>
                <td style={{ padding: '11px 14px', fontWeight: 600 }}>{req.name}</td>
                <td style={{ padding: '11px 14px' }}><Badge color="primary">{req.dept}</Badge></td>
                <td style={{ padding: '11px 14px', textTransform: 'capitalize' }}>{req.type}</td>
                <td style={{ padding: '11px 14px' }}>{req.startDate}</td>
                <td style={{ padding: '11px 14px' }}>{req.endDate}</td>
                <td style={{ padding: '11px 14px', fontWeight: 600 }}>{req.days} days</td>
                <td style={{ padding: '11px 14px' }}>
                  <Badge color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}>{req.status}</Badge>
                </td>
                <td style={{ padding: '11px 14px', color: 'var(--text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>{req.reason}</td>
              </tr>
            ))}
            {filteredLeaves.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>No leave requests found in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      )
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Employee', 'Team', 'Present Days', 'Total Hours', 'Late Days', 'Leave Balance', 'Leaves Used'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empProductivity.map(emp => (
            <tr key={emp.empId} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '11px 14px', fontWeight: 600 }}>{emp.name}</td>
              <td style={{ padding: '11px 14px' }}><Badge color="primary">{emp.dept}</Badge></td>
              <td style={{ padding: '11px 14px' }}>{emp.presentDays}</td>
              <td style={{ padding: '11px 14px' }}>{emp.totalHours}h</td>
              <td style={{ padding: '11px 14px' }}>
                {emp.lateDays > 0 ? <Badge color="warning">{emp.lateDays}</Badge> : <Badge color="success">0</Badge>}
              </td>
              <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--primary)' }}>{parseFloat(emp.paidLeaveBalance.toFixed(2))}</td>
              <td style={{ padding: '11px 14px' }}>{emp.leavesUsed}</td>
            </tr>
          ))}
          {empProductivity.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>No employee productivity records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>Reports & Analytics</h2>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Export payroll-ready reports and track team performance</p>
        </div>
        <Btn variant="success" onClick={exportPayrollCSV}>💰 Export Payroll CSV</Btn>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <StatCard label="Total Employees" value={state.employees.length} icon="👥" color="#1a56db" />
        <StatCard label="Hours This Month" value={`${totalHoursThisMonth.toFixed(0)}h`} icon="⏱️" color="#05966b" />
        <StatCard label="Late This Month" value={lateThisMonth} icon="⚠️" color="#d97706" />
        <StatCard label="Pending Leaves" value={pendingLeaves} icon="📋" color="#e02424" />
      </div>

      {/* Trends */}
      <div className="reports-charts-grid">
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Attendance Trend (6 months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" name="Present" fill="#1a56db" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="Late" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Leave Requests (6 months)</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={leaveStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="approved" name="Approved" stroke="#05966b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#e02424" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="pending" name="Pending" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Report export section */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Export Reports</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'white' }}>
              <option value="attendance">Attendance Report</option>
              <option value="leave">Leave Report</option>
              <option value="productivity">Employee Productivity</option>
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            <span style={{ lineHeight: '32px', color: 'var(--text3)' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'white' }}>
              <option value="">All Teams</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <Btn variant="primary" size="sm" onClick={exportCSV}>⬇️ Export CSV</Btn>
          </div>
        </div>

        {/* Preview table */}
        <div style={{ overflowX: 'auto' }}>
          {renderTable()}
        </div>
      </Card>

      {/* Payroll export card */}
      <Card style={{ marginTop: 16, background: 'linear-gradient(135deg, #f0f5ff, #faf5ff)', border: '1px solid #c7d7fd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>💰 Monthly Payroll Export</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 500, lineHeight: 1.5 }}>
              Generates a complete payroll-ready CSV with gross salary, attendance, unpaid leave deductions, and net payable for <strong>{format(new Date(), 'MMMM yyyy')}</strong>.
            </div>
          </div>
          <Btn variant="primary" onClick={exportPayrollCSV}>Export {format(new Date(), 'MMM yyyy')} Payroll</Btn>
        </div>
      </Card>
    </div>
  )
}
