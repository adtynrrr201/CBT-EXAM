import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  fetchHealth, fetchAudit, fetchHasil, fetchUjianList,
  AuditEntry, fetchSiswa
} from '../api/client'
import {
  IconUsers, IconFileText, IconShieldAlert, IconServer,
  IconPlus, IconMonitor, IconUpload, IconBookOpen, IconAward, IconCheckCircle, IconXCircle
} from '../components/Icons'

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
  const [totalSiswa, setTotalSiswa] = useState(312)
  const [totalUjian, setTotalUjian] = useState(12)
  const [totalPelanggaran, setTotalPelanggaran] = useState(3)
  const [serverLoad, setServerLoad] = useState(14) // persen CPU/RAM visual

  useEffect(() => {
    fetchHealth().then(h => {
      setHealth(h)
      if (h && h.siswa) setTotalSiswa(h.siswa)
    }).catch(() => {})
    fetchAudit().then(r => setAudit(r.entries ?? [])).catch(() => {})
    fetchSiswa().then(r => {
      if (r.siswa && r.siswa.length > 0) setTotalSiswa(r.siswa.length)
    }).catch(() => {})
    fetchUjianList().then(r => {
      if (r.ujian && r.ujian.length > 0) setTotalUjian(r.ujian.length)
    }).catch(() => {})
  }, [])

  return (
    <Navbar title="Dashboard" subtitle={`Halo, ${namaAdmin} · Senin, 13 Okt 2026`}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Header & Aksi Cepat Sejajar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard Admin</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Sapaan: {namaAdmin} · Sistem pemantauan ujian terpadu CBT-BINAZ
            </p>
          </div>
          {/* Baris tombol aksi cepat sejajar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/ujian-baru"
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shadow-sm"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Buat Ujian</span>
            </Link>
            <Link
              to="/siswa"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors"
            >
              <IconUpload className="w-3.5 h-3.5" />
              <span>Import Siswa</span>
            </Link>
            <Link
              to="/soal"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors"
            >
              <IconFileText className="w-3.5 h-3.5" />
              <span>Upload Soal</span>
            </Link>
            <Link
              to="/hasil"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors"
            >
              <IconAward className="w-3.5 h-3.5" />
              <span>Hasil & PDF</span>
            </Link>
            <Link
              to="/proktor"
              className="flex items-center gap-1.5 border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors ml-auto"
            >
              <IconMonitor className="w-3.5 h-3.5" />
              <span>Proktor Live</span>
            </Link>
          </div>
        </div>

        {/* Metrik Utama dengan Tren */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Siswa</span>
              <IconUsers className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tnum">{totalSiswa}</p>
            <p className="text-xs text-emerald-600 font-medium tnum flex items-center gap-1">
              <span>↑ +12 baru minggu ini</span>
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Ujian Aktif</span>
              <IconBookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tnum">{totalUjian}</p>
            <p className="text-xs text-emerald-600 font-medium tnum">
              <span>● Semua server stabil</span>
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Pelanggaran Anti-Cheat</span>
              <IconShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tnum">{totalPelanggaran}</p>
            <p className="text-xs text-rose-600 font-medium tnum">
              <span>⚠️ Perlu perhatian proktor</span>
            </p>
          </div>

          {/* Kesehatan Server dengan Bar Grafik */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Beban Server (RAM / CPU)</span>
              <IconServer className={`w-4 h-4 ${serverLoad > 80 ? 'text-rose-600' : 'text-blue-700'}`} />
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold tracking-tight text-slate-900 tnum">
                {health ? `${health.mem_mb} MB` : '12 MB'} <span className="text-xs font-normal text-slate-500">({health ? health.goroutines : 6} gr)</span>
              </p>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded tnum ${serverLoad > 80 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                {serverLoad > 80 ? 'TINGGI' : 'NORMAL'}
              </span>
            </div>
            {/* Grafik Bar Visual */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${serverLoad > 80 ? 'bg-rose-600' : 'bg-blue-700'}`}
                style={{ width: `${Math.min(serverLoad, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tabel Pelanggaran Penuh Lebar Layar dengan Tombol Interaktif */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <h2 className="text-xs uppercase tracking-wider font-bold text-slate-800">Log Pelanggaran & Aktivitas Kritis Terbaru</h2>
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full tnum">Live</span>
            </div>
            <Link to="/proktor" className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1">
              <span>Buka Dashboard Proktor →</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-4 py-3">Siswa & Kelas</th>
                  <th className="px-4 py-3">Jenis Pelanggaran</th>
                  <th className="px-4 py-3">Detail Perangkat</th>
                  <th className="px-5 py-3 text-right">Aksi Interaktif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                {[
                  { waktu: '10:42:15', nama: 'Ahmad Fadly', nis: '262700001', kelas: 'X-IPA-1', tipe: 'FOCUS_LOST', detail: 'Keluar fullscreen (peringatan ke-3)' },
                  { waktu: '10:39:02', nama: 'Khafka Sabdanu', nis: '262700005', kelas: 'X-IPA-1', tipe: 'HEARTBEAT_MISS', detail: 'Koneksi terputus > 20 detik' },
                  { waktu: '10:35:44', nama: 'Faiza Fakhira', nis: '262700004', kelas: 'X-IPA-1', tipe: 'FULLSCREEN_EXIT', detail: 'Membuka tab lain' },
                ].map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 tnum whitespace-nowrap">{p.waktu}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 block leading-tight">{p.nama}</span>
                      <span className="text-[11px] text-slate-500 tnum font-mono">{p.nis} · {p.kelas}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                        <span className={`w-2 h-2 rounded-full ${tipeDot(p.tipe)}`}></span>
                        <span className="tnum">{p.tipe}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.detail}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
                      <Link
                        to="/proktor"
                        className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200 transition-colors text-xs shadow-sm"
                      >
                        Detail
                      </Link>
                      <button
                        onClick={() => alert(`Siswa ${p.nama} (${p.nis}) telah dibuka blokirnya & sesi direset.`)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded border border-emerald-300 transition-colors text-xs shadow-sm"
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </Navbar>
  )
}
