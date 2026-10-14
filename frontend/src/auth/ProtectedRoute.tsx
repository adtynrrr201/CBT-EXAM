import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  roles?: string[]
  children: React.ReactNode
}

export function safeFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('://') && raw !== '/login') {
    return raw
  }
  return null
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
          <span>Memuat sesi…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    const roleRedirects: Record<string, string> = {
      siswa: '/siswa-beranda',
      guru: '/guru',
      proktor: '/proktor',
      admin: '/',
    }
    const target = roleRedirects[user.role] || '/'
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}
