import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { fetchSiswa, previewSiswa, confirmSiswa } from '../api/client'
import { IconUpload, IconDownload, IconCheckCircle } from '../components/Icons'

interface Row { nis: string; nama: string; kelas: string; jk: string }
interface Invalid { nama: string; line: number; alasan: string }

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const first = lines[0].toLowerCase()
  const hasHeader = first.includes('nis') && first.includes('nama')
  const body = hasHeader ? lines.slice(1) : lines
  return body.map((ln, i) => {
    const c = ln.split(',').map(s => s.trim())
    let jk = (c[3] || '').toUpperCase().replace(/[^LP]/g, '')
    if (jk !== 'L' && jk !== 'P') jk = 'L'
    return {
      Line: (hasHeader ? i + 2 : i + 1),
      NIS: c[0] || '',
      Nama: c[1] || '',
      Kelas: c[2] || '',
      JenisKelamin: jk,
      Password: c[4] || '',
      TahunAjaran: c[5] || '2025/2026',
    }
  })
}

export default function Siswa() {
  const [list, setList] = useState<Row[]>([])
  const [valid, setValid] = useState<Row[]>([])
  const [gagal, setGagal] = useState<Invalid[]>([])
  const [rawRows, setRawRows] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    try {
      const res = await fetchSiswa()
      const rows = (res.siswa || []).map(s => ({ ...s })).sort((a, b) => a.nis.localeCompare(b.nis))
      setList(rows)
    } catch { /* backend belum jalan — tabel kosong */ }
  }
  useEffect(() => { load() }, [])

  async function handleFile(f: File | undefined) {
    if (!f) return
    setErr(''); setMsg('')
    if (/\.xlsx?$/.test(f.name)) {
      setErr('File .xlsx belum diparse langsung — buka di Excel lalu Save As CSV, upload file CSV-nya.')
      return
    }
    const text = await f.text()
    const rows = parseCSV(text)
    if (rows.length === 0) { setErr('File kosong / format tidak dikenali. Unduh template dulu.'); return }
    setRawRows(rows)
    setLoading(true)
    try {
      const res = await previewSiswa(rows)
      setValid((res.valid || []).map(v => ({ nis: v.NIS, nama: v.Nama, kelas: v.Kelas, jk: v.JenisKelamin })))
      setGagal((res.invalid || []).map(g => ({ nama: g.Row?.Nama || '-', line: g.Row?.Line || 0, alasan: g.Reason })))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true); setErr(''); setMsg('')
    try {
      const res = await confirmSiswa(rawRows)
      setMsg(`Berhasil mengimpor ${res.sukses} siswa.`)
      setValid([]); setGagal([]); setRawRows([])
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Navbar title="Siswa" subtitle="Upload CSV (dari Excel) → preview validasi → konfirmasi masuk DB.">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-5 py-4 rounded-lg border border-slate-200">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Siswa</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Upload CSV (dari Excel) → preview validasi → konfirmasi masuk DB.</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/v1/siswa/template" className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 text-[13px] font-medium px-3 py-2 rounded-lg bg-white" download>
              <IconDownload className="w-3.5 h-3.5" />
              <span>Template CSV</span>
            </a>
            <label className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[13px] font-medium px-3 py-2 rounded-lg cursor-pointer">
              <IconUpload className="w-3.5 h-3.5" />
              <span>{loading ? 'Memproses…' : 'Pilih CSV'}</span>
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>

        {err && <div className="bg-white border border-rose-200 text-rose-700 text-[13px] px-4 py-3 rounded-lg">{err}</div>}
        {msg && (
          <div className="bg-white border border-emerald-200 text-emerald-800 text-[13px] px-4 py-3 rounded-lg flex items-center gap-2">
            <IconCheckCircle className="w-4 h-4" /><span>{msg}</span>
          </div>
        )}

        {(valid.length > 0 || gagal.length > 0) && (
          <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Preview — <span className="text-emerald-700">{valid.length} valid</span>, <span className="text-rose-700">{gagal.length} ditolak</span></h2>
              {valid.length > 0 && (
                <button onClick={handleConfirm} disabled={loading} className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-[13px] font-medium px-3 py-2 rounded-lg">
                  Konfirmasi import ({valid.length})
                </button>
              )}
            </div>
            {gagal.length > 0 && (
              <ul className="text-xs text-rose-700 space-y-1 tnum">
                {gagal.map((g, i) => <li key={i}>Baris {g.line}: {g.nama} — {g.alasan}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Terdaftar ({list.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-2.5 font-medium">NIS</th>
                  <th className="px-3 py-2.5 font-medium">Nama</th>
                  <th className="px-3 py-2.5 font-medium">Kelas</th>
                  <th className="px-5 py-2.5 font-medium">L/P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[13px] text-slate-900">
                {list.map(s => (
                  <tr key={s.nis} className="hover:bg-slate-50/80">
                    <td className="px-5 py-2.5 text-xs tnum text-slate-500">{s.nis}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{s.nama}</td>
                    <td className="px-3 py-2.5 text-slate-500">{s.kelas}</td>
                    <td className="px-5 py-2.5 text-slate-500">{s.jk}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-[13px] text-slate-500">Belum ada data — upload CSV dulu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Navbar>
  )
}
