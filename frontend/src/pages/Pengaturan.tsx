import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { IconCheckCircle } from '../components/Icons'

export default function Pengaturan() {
  const [tolerance, setTolerance] = useState({
    max_focus_lost: 5,
    heartbeat_sec: 20,
    rate_limit_login: 30,
    strict_seb: true,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cbt.config.tolerance')
      if (raw) setTolerance(JSON.parse(raw))
    } catch {}
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      localStorage.setItem('cbt.config.tolerance', JSON.stringify(tolerance))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
  }

  return (
    <Navbar title="Pengaturan Sistem" subtitle="Atur batas toleransi anti-cheat, heartbeat, dan policy ujian.">
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Batas Toleransi Anti-Cheat & Sesi</h1>
            <p className="text-xs text-slate-500 mt-0.5">Konfigurasi berlaku global untuk seluruh sesi ujian aktif di server.</p>
          </div>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <IconCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Pengaturan berhasil disimpan.</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Maksimum Pindah Fokus (Focus Lost Limit)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={tolerance.max_focus_lost}
                onChange={e => setTolerance({ ...tolerance, max_focus_lost: parseInt(e.target.value) || 5 })}
                className="w-full max-w-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono tnum focus:ring-2 focus:ring-blue-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Siswa akan otomatis disubmit jika keluar dari layar ujian melebihi batas ini.</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Interval Heartbeat (Detik)</label>
              <input
                type="number"
                min={5}
                max={60}
                value={tolerance.heartbeat_sec}
                onChange={e => setTolerance({ ...tolerance, heartbeat_sec: parseInt(e.target.value) || 20 })}
                className="w-full max-w-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono tnum focus:ring-2 focus:ring-blue-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Seberapa sering browser siswa melapor ke server untuk status proktor live.</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Rate Limit Login (Per Menit)</label>
              <input
                type="number"
                min={10}
                max={100}
                value={tolerance.rate_limit_login}
                onChange={e => setTolerance({ ...tolerance, rate_limit_login: parseInt(e.target.value) || 30 })}
                className="w-full max-w-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono tnum focus:ring-2 focus:ring-blue-700 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Toleransi login bersamaan untuk NAT lab sekolah.</p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={tolerance.strict_seb}
                  onChange={e => setTolerance({ ...tolerance, strict_seb: e.target.checked })}
                  className="accent-blue-700 w-4 h-4 rounded"
                />
                <span>Wajibkan Safe Exam Browser (SEB) secara ketat untuk ujian resmi</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                type="submit"
                className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2.5 rounded-lg text-xs transition-colors shadow-sm"
              >
                Simpan Pengaturan
              </button>
            </div>
          </form>
        </div>
      </main>
    </Navbar>
  )
}
