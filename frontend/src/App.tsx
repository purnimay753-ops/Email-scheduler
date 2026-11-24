import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/ui/Spinner'
import { useAuth } from './hooks/useAuth'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <DashboardPage />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
