import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { fetchHasilSaya } from '../api/client'
import { IconBookOpen, IconMonitor, IconAward, IconChevronRight, IconShieldAlert } from '../components/Icons'

interface Nilai { nilai: number; benar: number; salah: number; kosong: number }

export default function SiswaBeranda() {
  const { user } = useAuth()
  const namaSiswa = user?.nama || 'Siswa'
  const nis = user?.nis || user?.username || '—'
  const kelas = user?.kelas || '—'
  const aktif = user?.ujian_aktif && typeof user.ujian_aktif === 'object' ? user.ujian_aktif : null
  const [nilai, setNilai] = useState<Nilai[] | null>(null)

  useEffect(() => {
    fetchHasilSaya().then(r => setNilai(r.hasil || [])).catch(() => setNilai([]))
  }, [])

  return (
    <Navbar title="Portal Siswa" subtitle={`Halo, ${namaSiswa}`}>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-wide">
              Siswa Beranda
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 mt-1">Halo, {namaSiswa}</h1>
            <p className="text-[13px] text-slate-500 mt-0.5 tnum">
              NIS: {nis} · Kelas: {kelas} · Status: Siap Ujian
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-medium text-slate-700 tnum">Koneksi Stabil</span>
          </div>
        </div>

        {/* Kartu Ujian Aktif dari user.ujian_aktif */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 bg-slate-50 -mx-5 -mt-5 p-4 rounded-t-lg">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
              <IconMonitor className="w-4 h-4 text-blue-700" />
              <span>Ujian aktif</span>
            </h2>
            <span className="text-xs text-slate-500 tnum">Sistem Terkunci</span>
          </div>

          {aktif ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <p className="text-[13px] font-semibold text-slate-900">{aktif.judul}</p>
                </div>
                <p className="text-xs text-slate-500 mt-1 tnum">
                  Kode ujian: <span className="font-semibold text-slate-800">{aktif.ujian_id}</span>
                </p>
              </div>
              <Link
                to={`/ujian/${aktif.ujian_id}`}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[13px] font-medium px-4 py-2 rounded-lg shrink-0 transition-colors"
              >
                <span>Mulai / lanjutkan</span>
                <IconChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center space-y-2">
              <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center mx-auto">
                <IconBookOpen className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-semibold text-slate-800">Belum ada ujian aktif</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Saat proktor membuka sesi ujian, kartu ujian akan muncul di sini secara otomatis. Pastikan periksa jadwal berkala.
              </p>
            </div>
          )}
        </div>

        {/* Panel "Nilai saya" statis tanpa fetch baru */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 bg-slate-50 -mx-5 -mt-5 p-4 rounded-t-lg">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
              <IconAward className="w-4 h-4 text-blue-700" />
              <span>Nilai saya (rilis oleh proktor)</span>
            </h2>
            <span className="text-xs text-slate-500 tnum">Arsip Nilai</span>
          </div>

          {nilai === null ? (
            <p className="text-xs text-slate-500 text-center py-2">Memuat nilai…</p>
          ) : nilai.length === 0 ? (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-center space-y-2">
              <p className="text-[13px] font-semibold text-slate-800">Belum ada nilai masuk</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Nilai muncul di sini setelah Anda menyelesaikan ujian dan jawaban dinilai sistem.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {nilai.map((n, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
                  <div className="text-xs text-slate-600 tnum">
                    Benar <b className="text-emerald-700">{n.benar}</b> · Salah <b className="text-rose-700">{n.salah}</b> · Kosong <b>{n.kosong}</b>
                  </div>
                  <span className="text-xl font-bold text-slate-900 tnum">{n.nilai}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panduan singkat */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
          <div className="border-b border-slate-200 pb-3 bg-slate-50 -mx-5 -mt-5 p-4 rounded-t-lg">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
              <IconShieldAlert className="w-4 h-4 text-blue-700" />
              <span>Panduan singkat ujian</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-1">1. Token Ujian</span>
              Masukkan token unik dari proktor pengawas sebelum memulai pengerjaan.
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-1">2. Mode Fullscreen</span>
              Browser akan terkunci di mode layar penuh. Jangan keluar atau tab switch.
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-1">3. Larangan Curang</span>
              Sistem mencatat perpindahan fokus, deteksi pelanggaran otomatis terekam.
            </div>
          </div>
        </div>

      </main>
    </Navbar>
  )
}
