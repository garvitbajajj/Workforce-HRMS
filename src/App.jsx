import { useState } from 'react'
import { useHRMS } from './store.jsx'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Employees from './pages/Employees.jsx'
import Attendance from './pages/Attendance.jsx'
import Leaves from './pages/Leaves.jsx'
import Reports from './pages/Reports.jsx'
import Profile from './pages/Profile.jsx'
import Holidays from './pages/Holidays.jsx'
import Policies from './pages/Policies.jsx'
import DevDashboard from './pages/DevDashboard.jsx'

export default function App() {
  const { state } = useHRMS()
  const [page, setPage] = useState('dashboard')

  if (!state.auth.isAuthenticated) return <Login />

  const pages = { 
    dashboard: Dashboard, 
    employees: Employees, 
    attendance: Attendance, 
    leaves: Leaves, 
    reports: Reports, 
    profile: Profile,
    holidays: Holidays,
    policies: Policies,
    devdashboard: DevDashboard
  }
  const PageComponent = pages[page] || Dashboard

  return (
    <>
      <Layout page={page} setPage={setPage}>
        <div key={page} className="fade-in">
          <PageComponent setPage={setPage} />
        </div>
      </Layout>
      <SpeedInsights />
    </>
  )
}
