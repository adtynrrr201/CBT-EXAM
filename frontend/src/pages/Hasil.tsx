import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { fetchHasil, fetchUjianList, fetchAnalisis, type AnalisisItem } from '../api/client'
import { IconDownload, IconFolder, IconAward, IconCheckCircle, IconSearch } from '../components/Icons'

interface HasilItem {
  nis: string; nama: string; kelas: string
  benar: number; salah: number; kosong: number; nilai: number
  resultId: string
}

const KELAS_ID = 'XII-IPA-1'

export default function Hasil() {
  const [items, setItems] = useState<HasilItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [ujianList, setUjianList] = useState<Array<{ id: string; judul: string; mapel: string }>>([])
  const [ujianId, setUjianId] = useState('semua')
  const [analisis, setAnalisis] = useState<{ n_siswa: number; alpha: number | null; items: AnalisisItem[] } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchHasil(ujianId === 'semua' ? '' : ujianId)
      .then(res => {
        const list = (res?.hasil || []).map(h => ({
          nis: h.nis,
          nama: h.nama,
          kelas: h.kelas,
          benar: h.benar,
          salah: h.salah,
          kosong: h.kosong,
          nilai: h.nilai,
          resultId: h.result_id,
        }))
        list.sort((a, b) => a.nis.localeCompare(b.nis))
        setItems(list)
        setError('')
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [ujianId])

  useEffect(() => {
    fetchUjianList().then(r => setUjianList(r.ujian || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (ujianId === 'semua') { setAnalisis(null); return }
    fetchAnalisis(ujianId).then(r => setAnalisis(r)).catch(() => setAnalisis(null))
  }, [ujianId])

  const filtered = items.filter(h =>
    h.nama.toLowerCase().includes(search.toLowerCase()) ||
    h.nis.includes(search) ||
    h.kelas.toLowerCase().includes(search.toLowerCase())
  )

  function eksporCSV() {
    const head = 'NIS,Nama,Kelas,Benar,Salah,Kosong,Nilai'
    const rows = filtered.map(h => [h.nis, `"${h.nama}"`, h.kelas, h.benar, h.salah, h.kosong, h.nilai].join(','))
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'rekap-nilai.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const avgScore = items.length ? Math.round(items.reduce((acc, curr) => acc + curr.nilai, 0) / items.length) : 0
  const passCount = items.filter(h => h.nilai >= 75).length

  return (
    <Navbar title="Hasil & Evaluasi" subtitle="Arsip nilai dan rekap ujian terstruktur">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Page Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Hasil &amp; Evaluasi Ujian</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Setiap hasil ujian disimpan terstruktur dalam folder per anak (PDF + JSON jawaban + log pelanggaran).
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              disabled
              title="Endpoint unduhan ZIP backend belum tersedia (TASKS Fase 1)"
              className="flex items-center gap-2 bg-slate-100 text-slate-400 font-medium text-[13px] px-4 py-2.5 rounded-lg border border-slate-200 cursor-not-allowed"
            >
              <IconFolder className="w-4 h-4" />
              <span>Unduh ZIP Kelas {KELAS_ID}</span>
            </button>
            <button
              disabled
              title="Endpoint unduhan ZIP backend belum tersedia (TASKS Fase 1)"
              className="flex items-center gap-2 bg-slate-100 text-slate-400 font-medium text-[13px] px-4 py-2.5 rounded-lg border border-slate-200 cursor-not-allowed"
            >
              <IconDownload className="w-4 h-4" />
              <span>Unduh Seluruh ZIP Ujian</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 text-slate-500 text-xs px-4 py-3 rounded-lg">
          Unduhan berkas ZIP menyusul — endpoint export backend belum tersedia. Nilai di bawah tetap bisa dibaca dan dicari.
        </div>

        {/* Kartu ringkasan jadi strip berdivider */}
        <div className="bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <IconAward className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rata-rata</p>
              <p className="text-xl font-bold text-slate-900 font-mono mt-0.5 tnum">{avgScore}</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <IconCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lulus</p>
              <p className="text-xl font-bold text-emerald-700 mt-0.5 tnum">{passCount} / {items.length} Siswa</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <IconFolder className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Folder</p>
              <p className="text-sm font-bold text-slate-800 mt-1">100% Rapi Terstruktur</p>
            </div>
          </div>
        </div>

        {/* Sebaran nilai — kurva batang CSS murni */}
        {items.length > 0 && (() => {
          const lo = items.filter(h => h.nilai <= 40).length
          const mid = items.filter(h => h.nilai >= 41 && h.nilai <= 70).length
          const hi = items.filter(h => h.nilai >= 71).length
          const max = Math.max(lo, mid, hi, 1)
          const bars: [string, number, string, string][] = [
            ['0 – 40', lo, 'bg-slate-400', 'text-slate-700'],
            ['41 – 70', mid, 'bg-blue-600', 'text-blue-700'],
            ['71 – 100', hi, 'bg-emerald-500', 'text-emerald-700'],
          ]
          return (
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Sebaran nilai</p>
              <div className="space-y-2">
                {bars.map(([label, count, bg, txt]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-16 shrink-0 text-right tnum">{label}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${bg} transition-all`}
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold tnum w-8 ${txt}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Analisis butir soal — pilih ujian dulu */}
        {analisis && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-700">
                Analisis butir soal — {analisis.n_siswa} siswa
              </p>
              <p className="text-xs text-slate-600 tnum">
                Cronbach&rsquo;s Alpha:{' '}
                <span className="font-bold text-slate-900">
                  {analisis.alpha === null ? '— (data kurang)' : analisis.alpha.toFixed(2)}
                </span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2 font-semibold">Soal</th>
                    <th className="py-2 pr-2 font-semibold text-right">Benar</th>
                    <th className="py-2 pr-2 font-semibold text-right">Kesukaran</th>
                    <th className="py-2 pr-2 font-semibold text-right">Daya beda</th>
                    <th className="py-2 font-semibold">Pengecoh (opsi: pemilih)</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis.items.map(it => (
                    <tr key={it.question_id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-2 text-slate-800 max-w-xs">{it.teks}</td>
                      <td className="py-2 pr-2 text-right tnum text-slate-600">{it.benar}/{it.n}</td>
                      <td className="py-2 pr-2 text-right tnum">
                        <span className={`font-semibold ${it.tk_label === 'Sukar' ? 'text-rose-600' : it.tk_label === 'Mudah' ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {it.tk_label} ({it.tk.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tnum">
                        <span className={`font-semibold ${it.db_label === 'Baik' ? 'text-emerald-600' : it.db_label === 'Jelek' ? 'text-rose-600' : 'text-slate-700'}`}>
                          {it.db_label} ({it.daya_beda.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-2 text-slate-500 tnum">
                        {Object.entries(it.pengecoh).map(([l, c]) => `${l}:${c}`).join('  ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main Results Table Card - Tabel Formal */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Daftar Nilai Siswa</h2>

            <select
              value={ujianId}
              onChange={e => setUjianId(e.target.value)}
              className="text-xs text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="semua">Semua ujian</option>
              {ujianList.map(u => (
                <option key={u.id} value={u.id}>{u.judul} — {u.mapel}</option>
              ))}
            </select>

            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <IconSearch className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari NIS / Nama / Kelas..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 tnum"
              />
            </div>
            <button
              onClick={eksporCSV}
              disabled={filtered.length === 0}
              title="Unduh rekap sebagai CSV (buka di Excel)"
              className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white disabled:opacity-40 text-slate-700 text-xs font-medium px-3 py-2 rounded-lg shrink-0"
            >
              <IconDownload className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>

          {loading && <p className="text-slate-500 text-sm py-4 text-center">Memuat data nilai...</p>}

          {!loading && error && (
            <p className="text-rose-700 bg-rose-50 border border-rose-200 text-sm py-3 px-4 text-center rounded-lg">Gagal memuat: {error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="text-slate-500 text-sm py-8 text-center bg-slate-50">Belum ada hasil ujian tersimpan.</p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                    <th className="px-4 py-2.5">NIS</th>
                    <th className="px-3 py-2.5">Nama Lengkap</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5 text-center">Benar</th>
                    <th className="px-3 py-2.5 text-center">Salah</th>
                    <th className="px-3 py-2.5 text-center">Kosong</th>
                    <th className="px-3 py-2.5 text-center">Nilai Akhir</th>
                    <th className="px-4 py-2.5 text-right">Berkas Artefak Ujian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                  {filtered.map(h => (
                    <tr key={h.nis} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 tnum">{h.nis}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{h.nama}</td>
                      <td className="px-3 py-3 text-slate-600 text-xs tnum">{h.kelas}</td>
                      <td className="px-3 py-3 text-center font-mono text-emerald-700 font-semibold tnum">{h.benar}</td>
                      <td className="px-3 py-3 text-center font-mono text-rose-700 tnum">{h.salah}</td>
                      <td className="px-3 py-3 text-center font-mono text-slate-500 tnum">{h.kosong}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md tnum inline-block ${
                          h.nilai >= 75
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {h.nilai}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled
                          title="Endpoint unduhan ZIP backend belum tersedia (TASKS Fase 1)"
                          className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-400 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 cursor-not-allowed"
                        >
                          <IconFolder className="w-3.5 h-3.5" />
                          <span>ZIP Folder</span>
                        </button>
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
