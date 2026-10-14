import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { safeFrom } from '../auth/ProtectedRoute'
import { IconUser, IconLock, IconShieldAlert } from '../components/Icons'

export default function Login() {
  const nav = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [nis, setNis] = useState('')
  const [password, setPassword] = useState('')
  // ponytail: crypto.randomUUID butuh secure-context; fallback agar halaman login tak crash di http LAN
  const [device] = useState(() => {
    try {
      return 'DEV-' + crypto.randomUUID().slice(0, 8).toUpperCase()
    } catch {
      return 'DEV-' + Math.random().toString(36).slice(2, 10).toUpperCase()
    }
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [forceLogin, setForceLogin] = useState(false)

  async function handleSubmit(e: React.FormEvent, force = false) {
    e.preventDefault()
    if (!nis.trim() || !password.trim()) {
      setError('NIS / username dan password wajib diisi.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await signIn(nis, password, device, force || forceLogin)
      
      const sessionRaw = localStorage.getItem('cbt.session')
      let userRole = 'admin'
        let ujianAktif = ''
        if (sessionRaw) {
          try {
            const parsed = JSON.parse(sessionRaw)
            if (parsed && parsed.user) {
              userRole = parsed.user.role
              // Backend mengirim objek {ujian_id, judul} bila ada — ambil id-nya.
              const ua = parsed.user.ujian_aktif
              ujianAktif = typeof ua === 'object' && ua !== null ? ua.ujian_id || '' : ua || ''
            }
          } catch {}
        }

      const fromState = safeFrom((location.state as { from?: { pathname: string } })?.from?.pathname)
      if (fromState) {
        nav(fromState, { replace: true })
        return
      }

      if (userRole === 'admin') {
        nav('/', { replace: true })
      } else if (userRole === 'guru') {
        nav('/guru', { replace: true })
      } else if (userRole === 'proktor') {
        nav('/proktor', { replace: true })
      } else if (userRole === 'siswa') {
        if (ujianAktif) {
          nav(`/ujian/${ujianAktif}`, { replace: true })
        } else {
          nav('/siswa-beranda', { replace: true })
        }
      } else {
        nav('/', { replace: true })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('409')) {
        setError('Akun ini sedang dipakai di perangkat lain (mungkin sesi kemarin belum keluar).')
        setForceLogin(true)
      } else if (msg === 'SESI_HABIS' || msg.includes('401')) {
        setError('NIS / username atau password tidak terdaftar. Periksa kembali.')
      } else {
        setError(`Tidak terhubung ke server: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <div className="hidden md:flex flex-col justify-between bg-slate-900 text-white rounded-lg p-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white text-slate-900 text-xs font-bold flex items-center justify-center">CB</div>
            <span className="text-sm font-semibold">CBT-BINAZ</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight leading-snug">Ujian terkunci,<br />nilai terkumpul rapi.</h1>
            <p className="text-[13px] text-slate-400">Tahun ajaran 2025/2026 · Semester 1</p>
            <dl className="grid grid-cols-3 gap-3 text-center pt-2">
              {[['300+', 'siswa / berkas'], ['<800ms', 'autosave p95'], ['5×', 'batas fokus']].map(([v, l]) => (
                <div key={l} className="border border-white/15 rounded-lg py-3 px-2 bg-white/5">
                  <dt className="text-sm font-bold tnum text-white">{v}</dt>
                  <dd className="text-[11px] text-slate-400 mt-0.5">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-[11px] text-slate-400 tnum">Server aktif · lockdown siap · {device}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8 flex flex-col justify-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Masuk</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Siswa pakai NIS · proktor pakai akun admin.</p>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-[13px] text-rose-950">
              <IconShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Gagal masuk</p>
                <p className="text-xs text-rose-800 mt-0.5">{error}</p>
                {forceLogin && (
                  <button
                    type="button"
                    onClick={(ev) => handleSubmit(ev as unknown as React.FormEvent, true)}
                    className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
                  >
                    Masuk paksa di perangkat ini (keluarkan sesi lain)
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">NIS / Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <IconUser className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={nis}
                  onChange={e => setNis(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-700 text-slate-900 bg-white"
                  placeholder="cth. 12345"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <IconLock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsOn(e.getModifierState ? e.getModifierState('CapsLock') : false)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-700 text-slate-900 bg-white"
                  placeholder="••••••••"
                />
              </div>
              {capsOn && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                  Caps Lock menyala — password membedakan huruf besar/kecil.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Memverifikasi…' : 'Masuk ke sistem'}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-slate-500 tnum">
            Perangkat {device} · <Link to="/login" className="underline underline-offset-2 text-blue-700">Kembali</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
