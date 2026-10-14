import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { fetchLive, extendExam, forceSubmit, unblockSiswa, announce } from '../api/client'
import { IconMonitor, IconClock, IconShieldAlert } from '../components/Icons'

interface Peserta {
  nis: string; nama: string; kelas: string
  status: 'online' | 'selesai' | 'offline'
  focusLost: number; sisaWaktu: number | null
}

function fmtTime(s: number | null | undefined) {
  if (s == null || s <= 0) return '—'
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Proktor() {
  const [peserta, setPeserta] = useState<Peserta[]>([])
  const [loading, setLoading] = useState(true)
  const [, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [filterKelas, setFilterKelas] = useState('ALL')
  const [aksiErr, setAksiErr] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [filterBermasalah, setFilterBermasalah] = useState(false)
  const [annMsg, setAnnMsg] = useState('')
  const [annOk, setAnnOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchLive('demo')
        if (cancelled) return
        if (res?.peserta && res.peserta.length > 0) {
          const list = res.peserta.map(p => ({
            nis: p.nis,
            nama: p.nama,
            kelas: p.kelas,
            status: p.status,
            focusLost: p.focus_lost,
            sisaWaktu: p.sisa_waktu,
          }))
          list.sort((a, b) => a.nis.localeCompare(b.nis))
          setPeserta(list)
        }
        setError('')
      } catch {
        if (cancelled) return
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const t = setInterval(() => {
      setTick(v => v + 1)
      load()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  function peringatkan(nis: string) {
    alert(`Peringatan khusus telah dikirim ke layar siswa ${nis}`)
  }

  async function tambahWaktu(nis: string) {
    setAksiErr('')
    try {
      await extendExam('demo', 10)
      setPeserta(prev => prev.map(p =>
        p.nis === nis ? { ...p, sisaWaktu: (p.sisaWaktu ?? 0) + 600 } : p
      ))
    } catch (e) {
      setAksiErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function paksaSubmit(nis: string) {
    if (!confirm(`Apakah Anda yakin ingin memaksa submit ujian untuk siswa ${nis}?`)) return
    setAksiErr('')
    try {
      await forceSubmit('demo', nis)
      setPeserta(prev => prev.map(p =>
        p.nis === nis ? { ...p, status: 'selesai' as const, sisaWaktu: 0 } : p
      ))
    } catch (e) {
      setAksiErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function bukaBlokir(nis: string) {
    if (!confirm(`Reset sesi ujian ${nis}? Pelanggaran dihapus, jawaban tetap tersimpan.`)) return
    setAksiErr('')
    try {
      await unblockSiswa('demo', nis)
      setPeserta(prev => prev.map(p =>
        p.nis === nis ? { ...p, status: 'online' as const, focusLost: 0 } : p
      ))
    } catch (e) {
      setAksiErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function kirimPengumuman() {
    if (!annMsg.trim()) return
    setAksiErr('')
    setAnnOk(false)
    try {
      await announce('demo', annMsg.trim())
      setAnnMsg('')
      setAnnOk(true)
      setTimeout(() => setAnnOk(false), 3000)
    } catch (e) {
      setAksiErr(e instanceof Error ? e.message : String(e))
    }
  }

  const base = filterKelas === 'ALL' ? peserta : peserta.filter(p => p.kelas === filterKelas)
  const afterBermasalah = filterBermasalah
    ? base.filter(p => p.status !== 'selesai' && (p.focusLost > 0 || p.status === 'offline'))
    : base
  // Bermasalah paling atas: selesai terakhir, lalu focusLost besar, lalu NIS.
  const filtered = [...afterBermasalah].sort((a, b) => {
    const rank = (p: Peserta) => (p.status === 'selesai' ? 2 : p.focusLost >= 3 ? 0 : 1)
    return rank(a) - rank(b) || b.focusLost - a.focusLost || a.nis.localeCompare(b.nis)
  })
  const [selected, setSelected] = useState<string[]>([])

  function toggleSelect(nis: string) {
    setSelected(prev => (prev.includes(nis) ? prev.filter(x => x !== nis) : [...prev, nis]))
  }

  async function bulkAksi(kind: 'extend' | 'submit') {
    const targets = filtered.filter(p => selected.includes(p.nis) && p.status === 'online')
    if (targets.length === 0) return
    if (!confirm(`${kind === 'extend' ? 'Tambah 10 menit' : 'Paksa submit'} untuk ${targets.length} siswa terpilih?`)) return
    setAksiErr('')
    let gagal = 0
    for (const t of targets) {
      try {
        if (kind === 'extend') {
          await extendExam('demo', 10)
          setPeserta(prev => prev.map(p => (p.nis === t.nis ? { ...p, sisaWaktu: (p.sisaWaktu ?? 0) + 600 } : p)))
        } else {
          await forceSubmit('demo', t.nis)
          setPeserta(prev => prev.map(p => (p.nis === t.nis ? { ...p, status: 'selesai' as const, sisaWaktu: 0 } : p)))
        }
      } catch {
        gagal++
      }
    }
    setSelected([])
    if (gagal > 0) setAksiErr(`${gagal} dari ${targets.length} aksi gagal.`)
  }

  const countOnline = peserta.filter(p => p.status === 'online').length
  const countWarning = peserta.filter(p => p.focusLost >= 3).length
  const countSelesai = peserta.filter(p => p.status === 'selesai').length

  function gridCardColor(p: Peserta) {
    if (p.status === 'offline') return 'bg-slate-800 text-white border-slate-700'
    if (p.status === 'selesai') return 'bg-slate-100 text-slate-600 border-slate-300'
    if (p.focusLost >= 3) return 'bg-rose-50 text-rose-900 border-rose-300'
    if (p.focusLost >= 1) return 'bg-amber-50 text-amber-900 border-amber-300'
    return 'bg-emerald-50 text-emerald-900 border-emerald-300'
  }

  function gridDotColor(p: Peserta) {
    if (p.status === 'offline') return 'bg-slate-500'
    if (p.status === 'selesai') return 'bg-slate-400'
    if (p.focusLost >= 3) return 'bg-rose-500'
    if (p.focusLost >= 1) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <Navbar title="Proktor Live" subtitle="Monitoring Ujian Realtime">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Header Title Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Live Proctoring</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight mt-1">Monitoring Ujian Realtime</h1>
            <p className="text-[13px] text-slate-500 mt-1 tnum">
              Sesi Ujian: <b className="text-slate-800">UAS IPA Semester 1</b> • Polling tiap 5 detik (Sync #{tick})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterKelas}
              onChange={e => setFilterKelas(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-medium rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-700 tnum"
            >
              <option value="ALL">Semua Kelas Peserta</option>
              <option value="XII-IPA-1">Kelas XII-IPA-1</option>
              <option value="XII-IPA-2">Kelas XII-IPA-2</option>
            </select>
          </div>
        </div>

        {aksiErr && (
          <div className="bg-white border border-rose-200 text-rose-800 text-[13px] px-4 py-3 rounded-lg">
            Aksi proktor gagal: {aksiErr}
          </div>
        )}

        {/* Announce success */}
        {annOk && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] px-4 py-2.5 rounded-lg">
            Pengumuman berhasil dikirim.
          </div>
        )}

        {/* 3 kartu ringkas sebagai strip berdivider */}
        <div className="bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <IconMonitor className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mengerjakan</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5 tnum">{countOnline} Siswa</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
              <IconShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Warning</p>
              <p className="text-xl font-bold text-amber-800 mt-0.5 tnum">{countWarning} Siswa</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <IconClock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Selesai</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5 tnum">{countSelesai} Siswa</p>
            </div>
          </div>
        </div>

        {/* Panel Pengumuman */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-2">Kirim Pengumuman ke Semua Peserta</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={annMsg}
              onChange={e => setAnnMsg(e.target.value.slice(0, 150))}
              maxLength={150}
              placeholder="Tulis pengumuman (maks 150 karakter)..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <button
              onClick={kirimPengumuman}
              disabled={!annMsg.trim()}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Kirim
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 tnum">{annMsg.length}/150</p>
        </div>

        {/* Main Monitoring Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Daftar Status Peserta Ujian</h2>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterBermasalah}
                  onChange={e => setFilterBermasalah(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-700"
                />
                Bermasalah saja
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 transition-colors ${viewMode === 'table' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Tabel
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 transition-colors ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Grid
                </button>
              </div>
              <span className="text-xs text-slate-500 tnum font-mono">Total {filtered.length} Siswa</span>
              {selected.length > 0 && (
                <>
                  <button
                    onClick={() => bulkAksi('extend')}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded-lg"
                  >
                    +10 mnt ({selected.length})
                  </button>
                  <button
                    onClick={() => bulkAksi('submit')}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800 border border-rose-200 bg-rose-50 px-2.5 py-1 rounded-lg"
                  >
                    Paksa submit ({selected.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && <p className="text-slate-500 text-sm py-4 text-center">Memuat data live peserta...</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-slate-500 text-sm py-8 text-center bg-slate-50">Belum ada peserta dalam kelas ini.</p>
          )}

          {!loading && filtered.length > 0 && viewMode === 'grid' && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map(p => (
                <button
                  key={p.nis}
                  onClick={() => toggleSelect(p.nis)}
                  className={`rounded-lg border p-3 text-left transition-colors ${gridCardColor(p)} ${
                    selected.includes(p.nis) ? 'ring-2 ring-blue-700 ring-offset-1' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${gridDotColor(p)}`}></span>
                    <span className="text-[11px] font-mono tnum opacity-70">{p.nis}</span>
                  </div>
                  <p className="text-xs font-semibold truncate">{p.nama}</p>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] tnum">
                    <span>FL:{p.focusLost}</span>
                    <span className="font-mono">{fmtTime(p.sisaWaktu)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                    <th className="px-2 py-2.5 w-8">
                      <span className="sr-only">Pilih</span>
                    </th>
                    <th className="px-4 py-2.5">NIS</th>
                    <th className="px-3 py-2.5">Nama Lengkap</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5">Status Koneksi</th>
                    <th className="px-3 py-2.5 text-center">Focus Lost</th>
                    <th className="px-3 py-2.5">Sisa Waktu</th>
                    <th className="px-4 py-2.5 text-right">Kontrol Proktor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                  {filtered.map(p => (
                    <tr key={p.nis} className="hover:bg-slate-50">
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.nis)}
                          onChange={() => toggleSelect(p.nis)}
                          disabled={p.status !== 'online'}
                          aria-label={`Pilih ${p.nama}`}
                          className="w-4 h-4 accent-blue-700 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 tnum">{p.nis}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{p.nama}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs tnum">{p.kelas}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'selesai'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                          p.focusLost >= 3
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : p.focusLost > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.focusLost} kali
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 tnum">{fmtTime(p.sisaWaktu)}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'online' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => peringatkan(p.nis)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Peringatkan
                            </button>
                            <button
                              onClick={() => tambahWaktu(p.nis)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            >
                              +10 mnt
                            </button>
                            <button
                              onClick={() => paksaSubmit(p.nis)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Paksa-submit
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-slate-400 font-medium">Selesai</span>
                            <button
                              onClick={() => bukaBlokir(p.nis)}
                              title="Hapus pelanggaran + aktifkan lagi (jawaban tetap)"
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Reset sesi
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </Navbar>
  )
}
