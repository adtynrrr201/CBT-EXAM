import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { fetchHasilSaya } from '../api/client'
import { IconBookOpen, IconMonitor, IconAward, IconChevronRight, IconShieldAlert, IconRefresh, IconLock } from '../components/Icons'

interface Nilai { nilai: number; benar: number; salah: number; kosong: number }

export default function SiswaBeranda() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const namaSiswa = user?.nama || 'Siswa'
  const nis = user?.nis || user?.username || '—'
  const kelas = user?.kelas || '—'
  const aktif = user?.ujian_aktif && typeof user.ujian_aktif === 'object' ? user.ujian_aktif : null
  const [nilai, setNilai] = useState<Nilai[] | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    fetchHasilSaya().then(r => setNilai(r.hasil || [])).catch(() => setNilai([]))
  }, [])

  async function handleCheckUjian() {
    setChecking(true)
    try {
      await refreshUser()
    } catch (e) {
      // ignore
    } finally {
      setChecking(false)
    }
  }

  function handleStartUjian(e: React.FormEvent) {
    e.preventDefault()
    if (!aktif) return
    if (!tokenInput.trim()) {
      alert('Masukkan token ujian dari proktor terlebih dahulu.')
      return
    }
    navigate(`/ujian/${aktif.ujian_id}?token=${encodeURIComponent(tokenInput.trim())}`)
  }

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
          <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg ${isOnline ? 'bg-slate-50 border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-600'}`}></div>
            <span className={`text-xs font-medium tnum ${isOnline ? 'text-slate-700' : 'text-rose-700'}`}>
              {isOnline ? 'Koneksi Stabil' : 'Koneksi Terputus (Offline)'}
            </span>
          </div>
        </div>

        {/* Kartu Ujian Aktif dari user.ujian_aktif */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 bg-slate-50 -mx-5 -mt-5 p-4 rounded-t-lg">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
              <IconMonitor className="w-4 h-4 text-blue-700" />
              <span>Ujian aktif</span>
            </h2>
            <span className="text-xs text-slate-500 tnum">{aktif ? 'Siap Dikerjakan' : 'Menunggu Jadwal'}</span>
          </div>

          {aktif ? (
            <form onSubmit={handleStartUjian} className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <p className="text-[13px] font-semibold text-slate-900">{aktif.judul}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 tnum">
                    Kode ujian: <span className="font-semibold text-slate-800">{aktif.ujian_id}</span>
                  </p>
                </div>
              </div>

              {/* Form Token */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <IconLock className="w-3.5 h-3.5 text-blue-700" />
                  <span>Masukkan Token Unik Ujian</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: CBT-99A"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm uppercase tracking-widest font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    required
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-5 py-2 rounded-lg shrink-0 transition-colors shadow-sm"
                  >
                    <span>Mulai Ujian</span>
                    <IconChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Token diperoleh dari proktor pengawas ruang ujian Anda.</p>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center space-y-3">
              <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center mx-auto">
                <IconBookOpen className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-semibold text-slate-800">Belum ada ujian aktif</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Saat proktor membuka sesi ujian, kartu ujian akan muncul di sini secara otomatis.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleCheckUjian}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  <IconRefresh className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  <span>{checking ? 'Memeriksa...' : 'Cek Ujian Baru'}</span>
                </button>
              </div>
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
