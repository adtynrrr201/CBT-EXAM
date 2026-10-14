import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Siswa from './pages/Siswa'
import Pengaturan from './pages/Pengaturan'
import AuditLog from './pages/AuditLog'
import BankSoal from './pages/BankSoal'
import Ujian from './pages/Ujian'
import ExecUjian from './pages/ExecUjian'
import Proktor from './pages/Proktor'
import Hasil from './pages/Hasil'
import GuruDashboard from './pages/GuruDashboard'
import SiswaBeranda from './pages/SiswaBeranda'
import Pengguna from './pages/Pengguna'

function PublicLoginRoute() {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (user) {
    const roleRedirects: Record<string, string> = {
      siswa: '/siswa-beranda',
      guru: '/guru',
      proktor: '/proktor',
      admin: '/',
    }
    return <Navigate to={roleRedirects[user.role] || '/'} replace />
  }
  return <Login />
}

function RoleCatchAll() {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  const home: Record<string, string> = {
    siswa: '/siswa-beranda',
    guru: '/guru',
    proktor: '/proktor',
    admin: '/',
  }
  return <Navigate to={home[user.role] || '/'} replace />
}

function Shell() {
  const loc = useLocation()
  const bare = loc.pathname === '/login'
  if (bare) {
    return (
      <Routes>
        <Route path="/login" element={<PublicLoginRoute />} />
        <Route path="*" element={<RoleCatchAll />} />
      </Routes>
    )
  }
  return (
    <>
      <Routes>
          <Route path="/login" element={<PublicLoginRoute />} />

          {/* Admin routes */}
          <Route path="/" element={<ProtectedRoute roles={['admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="/pengguna" element={<ProtectedRoute roles={['admin']}><Pengguna /></ProtectedRoute>} />
          
          {/* Admin & Guru routes */}
          <Route path="/siswa" element={<ProtectedRoute roles={['admin', 'guru']}><Siswa /></ProtectedRoute>} />
          <Route path="/pengaturan" element={<ProtectedRoute roles={['admin']}><Pengaturan /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute roles={['admin']}><AuditLog /></ProtectedRoute>} />
          <Route path="/soal" element={<ProtectedRoute roles={['admin', 'guru']}><BankSoal /></ProtectedRoute>} />
          <Route path="/ujian-baru" element={<ProtectedRoute roles={['admin', 'guru']}><Ujian /></ProtectedRoute>} />
          <Route path="/hasil" element={<ProtectedRoute roles={['admin', 'guru']}><Hasil /></ProtectedRoute>} />

          {/* Admin & Proktor routes */}
          <Route path="/proktor" element={<ProtectedRoute roles={['admin', 'proktor']}><Proktor /></ProtectedRoute>} />

          {/* Siswa routes */}
          <Route path="/ujian/:id" element={<ProtectedRoute roles={['siswa', 'admin']}><ExecUjian /></ProtectedRoute>} />

          {/* Role Placeholder dashboards */}
          <Route path="/guru" element={<ProtectedRoute roles={['guru', 'admin']}><GuruDashboard /></ProtectedRoute>} />
          <Route path="/siswa-beranda" element={<ProtectedRoute roles={['siswa', 'admin']}><SiswaBeranda /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<RoleCatchAll />} />
        </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  )
}
