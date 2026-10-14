import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { fetchAudit, AuditEntry } from '../api/client'
import { IconRefresh } from '../components/Icons'

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetchAudit()
      .then(res => setEntries(res.entries || []))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <Navbar title="Audit Log Sistem" subtitle="Rekam jejak aktivitas admin, guru, dan proktor secara real-time.">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Jejak Aktivitas & Perubahan</h1>
              <p className="text-xs text-slate-500 mt-0.5">Mencatat seluruh aksi penting seperti pembuatan ujian, perubahan soal, dan reset sesi.</p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-3">Waktu (UTC)</th>
                  <th className="px-4 py-3">Aktor / Pengguna</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-5 py-3">Target / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Memuat audit log…</td></tr>
                ) : error ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-rose-600">{error}</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">Belum ada aktivitas tercatat di audit log.</td></tr>
                ) : (
                  entries.map((a, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 text-slate-500 tnum whitespace-nowrap">{a.time}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{a.actor}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-medium">
                          {a.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-700 truncate max-w-md">{a.target}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </Navbar>
  )
}
