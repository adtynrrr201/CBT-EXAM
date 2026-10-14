import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { fetchUsers, createUser } from '../api/client'
import { IconUsers, IconPlus } from '../components/Icons'

interface Pengguna { id: string; username: string; role: string; nama: string }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', guru: 'Guru', proktor: 'Proktor' }

export default function Pengguna() {
  const [list, setList] = useState<Pengguna[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [nama, setNama] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('guru')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetchUsers()
      setList((res.users || []).filter(u => u.role !== 'siswa').sort((a, b) => a.username.localeCompare(b.username)))
      setErr('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (!username.trim() || !nama.trim() || !password.trim()) {
      setErr('Username, nama, dan password wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const res = await createUser({ username: username.trim(), password, nama: nama.trim(), role })
      setMsg(`Akun ${res.role} "${res.username}" dibuat.`)
      setUsername(''); setNama(''); setPassword(''); setRole('guru')
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Navbar title="Kelola Pengguna" subtitle="Akun staf: admin, guru, proktor (khusus admin)">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconPlus className="w-4 h-4 text-blue-700" />
            Tambah akun staf
          </h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="cth. guru ipa"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-blue-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama lengkap</label>
              <input value={nama} onChange={e => setNama(e.target.value)} placeholder="cth. Ibu Wulan"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-blue-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password awal</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-blue-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Peran</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-blue-700">
                <option value="guru">Guru</option>
                <option value="proktor">Proktor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-[13px] font-medium px-3 py-2 rounded-md">
                {saving ? 'Menyimpan…' : 'Buat akun'}
              </button>
            </div>
          </form>
          {err && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 mt-3">{err}</p>}
          {msg && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mt-3">{msg}</p>}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <IconUsers className="w-4 h-4 text-blue-700" />
            <h2 className="text-[13px] font-semibold">Akun staf ({list.length})</h2>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-500">Memuat…</p>
          ) : list.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-500">Belum ada akun staf selain bawaan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 font-semibold">Username</th>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    <th className="px-3 py-2 font-semibold">Peran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px]">
                  {list.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 tnum">{u.username}</td>
                      <td className="px-3 py-2.5 font-medium">{u.nama}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            Akun siswa dibuat lewat halaman Siswa (upload CSV), bukan di sini.
          </p>
        </div>
      </main>
    </Navbar>
  )
}
