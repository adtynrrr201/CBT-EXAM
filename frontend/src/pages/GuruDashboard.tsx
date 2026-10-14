import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import {
  IconBookOpen, IconPlus, IconAward, IconChevronRight
} from '../components/Icons'

const METRIKS_GURU = [
  { label: 'Soal di bank', value: '124', sub: '3 mapel' },
  { label: 'Ujian dikelola', value: '4', sub: '2 kelas aktif' },
  { label: 'Menunggu koreksi', value: '0', sub: 'esai objektif' },
  { label: 'Rata-rata kelas', value: '82.4', sub: 'semester ini' },
]

const UJIAN_SAYA = [
  { id: 'ujian-demo-01', judul: 'UAS IPA Semester 1', kelas: 'XII IPA 1 & 2', status: 'Berjalan', mapel: 'Fisika / Kimia' },
  { id: 'ujian-demo-02', judul: 'UTS Matematika Peminatan', kelas: 'XII IPA 1', status: 'Draft', mapel: 'Matematika' },
  { id: 'ujian-demo-03', judul: 'Kuis Biologi Sel', kelas: 'XI IPA 3', status: 'Draft', mapel: 'Biologi' },
]

export default function GuruDashboard() {
  const { user } = useAuth()
  const namaGuru = user?.nama || 'Guru'

  return (
    <Navbar title="Dashboard Guru" subtitle={`Halo, ${namaGuru}`}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard Guru</h1>
            <p className="text-[13px] text-slate-500 mt-1 tnum">
              Sapaan: {namaGuru} · Kelola bank soal, ujian, dan rekap nilai peserta didik.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ujian-baru"
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[13px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Buat ujian</span>
            </Link>
            <Link
              to="/soal"
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-[13px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <IconBookOpen className="w-3.5 h-3.5" />
              <span>Bank soal</span>
            </Link>
          </div>
        </div>

        {/* Kartu lanjutkan draft ujian */}
        {(() => {
          try {
            const raw = localStorage.getItem('cbt.ujian.draft')
            if (!raw) return null
            const d = JSON.parse(raw)
            const judul = d?.info?.judul
            if (!judul) return null
            return (
              <Link
                to="/ujian-baru"
                className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 hover:bg-blue-100 transition-colors"
              >
                <IconPlus className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="text-[13px] font-medium text-blue-800">Lanjutkan draft: {judul}</span>
                <IconChevronRight className="w-3.5 h-3.5 text-blue-400 ml-auto shrink-0" />
              </Link>
            )
          } catch { return null }
        })()}

        {/* Metrik strip berdivider */}
        <div className="bg-white rounded-lg border border-slate-200 grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200">
          {METRIKS_GURU.map(m => (
            <div key={m.label} className="px-4 py-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{m.label}</span>
              <p className="text-xl font-semibold tracking-tight tnum mt-1 text-slate-900">
                {m.value} <span className="text-[11px] font-normal text-slate-500">{m.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Kartu Ujian saya tabel formal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Ujian saya</h2>
              <Link to="/ujian-baru" className="text-xs font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2">
                + Ujian baru
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <th className="px-4 py-2.5">Judul</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Aksi Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                  {UJIAN_SAYA.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block leading-tight">{u.judul}</span>
                        <span className="text-xs text-slate-500 tnum">{u.mapel}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 text-xs tnum">{u.kelas}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Berjalan' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                          <span className={`tnum font-medium ${u.status === 'Berjalan' ? 'text-blue-700' : 'text-slate-600'}`}>{u.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/hasil"
                          className="inline-flex items-center gap-1 text-xs font-medium border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-lg text-slate-700 transition-colors"
                        >
                          <span>Kelola</span>
                          <IconChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-1">
            <p className="text-[11px] uppercase tracking-wider font-bold text-slate-700 px-2 py-1.5">Aksi cepat</p>
            {[
              { to: '/soal', icon: IconBookOpen, t: '/soal', d: 'Bank soal pilihan ganda & esai' },
              { to: '/ujian-baru', icon: IconPlus, t: '/ujian-baru', d: 'Setup jadwal, token, dan durasi' },
              { to: '/hasil', icon: IconAward, t: '/hasil', d: 'Unduh nilai & ekspor rekap' },
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

      </main>
    </Navbar>
  )
}
