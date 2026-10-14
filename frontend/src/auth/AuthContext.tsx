import React, { createContext, useContext, useEffect, useState } from 'react'
import { me, login as apiLogin, logout as apiLogout, setToken as setApiToken, UserProfile } from '../api/client'

interface AuthContextType {
  user: UserProfile | null
  ready: boolean
  signIn: (u: string, p: string, dev: string, force?: boolean) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const SESSION_KEY = 'cbt.session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function initAuth() {
      try {
        const raw = localStorage.getItem(SESSION_KEY)
        if (!raw) {
          setReady(true)
          return
        }
        const session = JSON.parse(raw)
        if (session && session.token) {
          setApiToken(session.token)
          const profile = await me()
          setUser(profile)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg === 'SESI_HABIS' || msg.includes('401')) {
          localStorage.removeItem(SESSION_KEY)
          setApiToken('')
        }
      } finally {
        setReady(true)
      }
    }
    initAuth()
  }, [])

  async function signIn(u: string, p: string, dev: string, force = false) {
    const res = await apiLogin(u, p, dev, force)
    if (res.access_token) {
      setApiToken(res.access_token)
      try {
        const profile = await me()
        const sessionData = { token: res.access_token, user: profile }
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
        try { localStorage.setItem('cbt.device', dev) } catch {}
        setUser(profile)
      } catch (err: unknown) {
        localStorage.removeItem(SESSION_KEY)
        setApiToken('')
        setUser(null)
        throw err
      }
    }
  }

  function signOut() {
    apiLogout()
    localStorage.removeItem(SESSION_KEY)
    // Jejak ujian demo di PC bersama ikut dibersihkan.
    try {
      const gone: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('cbt.exam.')) gone.push(k)
      }
      gone.forEach(k => localStorage.removeItem(k))
    } catch {}
    setApiToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
