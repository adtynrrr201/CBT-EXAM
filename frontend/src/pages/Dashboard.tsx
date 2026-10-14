import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { fetchHealth, fetchAudit, fetchSyncStatus, postSnapshot } from '../api/client'
import type { AuditEntry } from '../api/client'
import {
  IconUsers, IconBookOpen, IconMonitor, IconShieldAlert,
  IconPlus, IconUpload, IconFileText, IconChevronRight,
  IconServer
} from '../components/Icons'

const METRICS = [
  { label: 'Siswa', value: '312', sub: '12 kelas', icon: IconUsers },
  { label: 'Soal', value: '480', sub: '8 mapel', icon: IconBookOpen },
  { label: 'Sesi', value: '2', sub: '1 berjalan', icon: IconMonitor, live: true },
  { label: 'Pelanggaran', value: '7', sub: 'hari ini', icon: IconShieldAlert, alert: true },
]

const PELANGGARAN = [
  { waktu: '09:42:10', nis: '12346', nama: 'Siti Aminah', kelas: 'XII-IPA-1', tipe: 'FOCUS_LOST', detail: 'Pindah window / tab 3 kali' },
  { waktu: '09:38:05', nis: '12345', nama: 'Ahmad Bin Azis', kelas: 'XII-IPA-1', tipe: 'FULLSCREEN_EXIT', detail: 'Keluar mode fullscreen' },
  { waktu: '09:35:18', nis: '12349', nama: 'Dewi Lestari', kelas: 'XII-IPA-2', tipe: 'FOCUS_LOST', detail: 'Pindah window 1 kali' },
  { waktu: '09:20:44', nis: '12350', nama: 'Rudi Hartono', kelas: 'XII-IPS-1', tipe: 'HEARTBEAT_MISS', detail: 'Tidak ada koneksi 95 detik' },
  { waktu: '09:11:02', nis: '12346', nama: 'Siti Aminah', kelas: 'XII-IPA-1', tipe: 'FOCUS_LOST', detail: 'Pindah window 2 kali' },
]

function tipeDot(t: string) {
  if (t === 'HEARTBEAT_MISS') return 'bg-rose-500'
  if (t === 'FULLSCREEN_EXIT') return 'bg-orange-500'
  return 'bg-amber-500'
}

export default function Dashboard() {
  const { user } = useAuth()
  const namaAdmin = user?.nama || 'Admin'

  const [health, setHealth] = useState<{ mem_mb: number; goroutines: number; users: number; siswa: number } | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [sync, setSync] = useState<{ packages_active: number; packages_total: number; answers: number; results: number; last_snapshot_at: string | null } | null>(null)
  const [snapMsg, setSnapMsg] = useState('')
  const [snapping, setSnapping] = useState(false)

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => {})
    fetchAudit().then(r => { setAudit(r.entries ?? []); setAuditLoaded(true) }).catch(() => setAuditLoaded(true))
    fetchSyncStatus().then(setSync).catch(() => {})
  }, [])

  function handleSnapshot() {
    setSnapping(true)
    setSnapMsg('')
    postSnapshot()
      .then(r => {
        setSnapMsg(`Cadangan tersimpan (${r.packages} paket, ${r.answers} jawaban).`)
        return fetchSyncStatus()
      })
      .then(setSync)
      .catch(e => setSnapMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setSnapping(false))
  }

  return (
    <Navbar title="Dashboard" subtitle={`Halo, ${namaAdmin} · Senin, 13 Okt 2026`}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard Admin</h1>
            <p className="text-[13px] text-slate-500 mt-1 tnum">
              Sapaan: {namaAdmin} · Senin, 13 Okt 2026
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ujian-baru"
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[13px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Buat ujian primer</span>
            </Link>
            <Link
              to="/proktor"
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-[13px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <IconMonitor className="w-3.5 h-3.5" />
              <span>Proktor ghost</span>
            </Link>
          </div>
        </div>

        {/* Metrik 4 berdivider */}
        <div className="bg-white rounded-lg border border-slate-200 grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200">
          {METRICS.map(m => (
            <div key={m.label} className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <m.icon className={`w-3.5 h-3.5 ${m.alert ? 'text-rose-600' : 'text-slate-400'}`} />
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{m.label}</span>
              </div>
              <p className={`text-xl font-semibold tracking-tight tnum mt-1 ${m.live ? 'text-blue-800 font-bold' : 'text-slate-900'}`}>
                {m.value} <span className="text-[11px] font-normal text-slate-500">{m.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Grid 2 kolom: tabel pelanggaran formal + aksi cepat list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Pelanggaran terbaru</h2>
              <Link to="/proktor" className="text-xs font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2">
                Proktor
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <th className="px-4 py-2.5">Waktu</th>
                    <th className="px-3 py-2.5">Siswa</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Kelas</th>
                    <th className="px-3 py-2.5">Jenis</th>
                    <th className="px-4 py-2.5 hidden md:table-cell">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                  {PELANGGARAN.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs text-slate-500 tnum whitespace-nowrap">{p.waktu}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900 block leading-tight">{p.nama}</span>
                        <span className="text-[11px] text-slate-500 tnum font-mono">{p.nis}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs hidden sm:table-cell whitespace-nowrap tnum">{p.kelas}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${tipeDot(p.tipe)}`}></span>
                          <span className="tnum font-medium">{p.tipe}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 hidden md:table-cell">{p.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-700 px-2 py-1.5">Aksi cepat list</p>
            {[
              { to: '/siswa', icon: IconUpload, t: 'Import siswa', d: 'CSV → akun otomatis' },
              { to: '/soal', icon: IconFileText, t: 'Upload soal', d: '.docx → bank soal' },
              { to: '/hasil', icon: IconBookOpen, t: 'Hasil & PDF', d: 'ZIP + rekap kelas' },
            ].map(a => (
              <Link key={a.to} to={a.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                <span className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                  <a.icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-slate-900 block leading-tight">{a.t}</span>
                  <span className="text-[11px] text-slate-500 block">{a.d}</span>
                </span>
                <IconChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Kesehatan & aktivitas */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Kesehatan &amp; aktivitas</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Sisi kiri — health */}
            <div className="px-4 py-3">
              {health ? (
                <div className="flex items-center gap-4 flex-wrap text-xs text-slate-700">
                  <IconServer className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="tnum"><b className="text-slate-900">{health.mem_mb}</b> MB</span>
                  <span className="tnum"><b className="text-slate-900">{health.goroutines}</b> goroutines</span>
                  <span className="tnum"><b className="text-slate-900">{health.users}</b> users</span>
                  <span className="tnum"><b className="text-slate-900">{health.siswa}</b> siswa</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Memuat kesehatan…</span>
              )}
            </div>
            {/* Sisi kanan — audit */}
            <div className="px-4 py-3 space-y-1.5">
              {auditLoaded && audit.length === 0 && (
                <p className="text-xs text-slate-400">Belum ada aktivitas tercatat</p>
              )}
              {audit.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs text-slate-700">
                  <span className="text-slate-500 tnum shrink-0">{a.time}</span>
                  <span className="font-medium text-slate-900">{a.actor}</span>
                  <span className="text-slate-500">·</span>
                  <span>{a.action}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-500 truncate">{a.target}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Baris sync semi-daring */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Sync lab</span>
            {sync ? (
              <span className="text-xs text-slate-600 tnum">
                {sync.packages_active}/{sync.packages_total} paket aktif · {sync.answers} jawaban · {sync.results} hasil
                {sync.last_snapshot_at ? ` · cadangan ${new Date(sync.last_snapshot_at).toLocaleString('id-ID')}` : ' · belum ada cadangan'}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Memuat status sync…</span>
            )}
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              className="ml-auto bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {snapping ? 'Menyimpan…' : 'Simpan cadangan'}
            </button>
            {snapMsg && <span className="text-xs text-emerald-700 w-full">{snapMsg}</span>}
          </div>
        </div>

      </main>
    </Navbar>
  )
}
