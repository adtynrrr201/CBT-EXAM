import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { IconFileText, IconCheckCircle, IconRefresh } from '../components/Icons'
import { fetchBankSoal, updateQuestion, QuestionItem } from '../api/client'
import { parseDocxToSoal, ParsedSoal } from '../utils/docxParser'

export default function BankSoal() {
  const [file, setFile] = useState<File | null>(null)
  const [soal, setSoal] = useState<ParsedSoal[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Database questions state
  const [dbQuestions, setDbQuestions] = useState<QuestionItem[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // Edit question state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    mapel: string
    kelas: string
    tipe: string
    bobot: number
    teks_html: string
    opsi: Array<{ label: string; teks_html: string; is_kunci: boolean }>
  }>({ mapel: '', kelas: '', tipe: 'PG', bobot: 10, teks_html: '', opsi: [] })
  const [editSaving, setEditSaving] = useState(false)

  function loadDbQuestions() {
    setDbLoading(true)
    setDbError(null)
    fetchBankSoal()
      .then(res => setDbQuestions(res.questions || []))
      .catch(err => setDbError(err.message || 'Gagal memuat daftar soal'))
      .finally(() => setDbLoading(false))
  }

  useEffect(() => {
    loadDbQuestions()
  }, [])

  async function handleUpload() {
    if (!file) return
    setParsing(true)
    setSaved(false)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const parsedSoal = await parseDocxToSoal(arrayBuffer)
      if (parsedSoal.length === 0) {
        alert('Tidak ada soal yang dikenali dari file .docx. Pastikan format nomor (1. ...) dan opsi (A. ...) sesuai.')
      } else {
        setSoal(parsedSoal)
      }
    } catch (e) {
      alert('Gagal membaca file Word: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setParsing(false)
    }
  }

  function toggleKunci(soalIdx: number, opsiIdx: number) {
    if (!soal) return
    setSoal(prev => prev!.map((s, si) =>
      si !== soalIdx ? s : {
        ...s,
        opsi: s.opsi.map((o, oi) => ({ ...o, kunci: oi === opsiIdx ? !o.kunci : o.kunci }))
      }
    ))
  }

  async function handleSimpan() {
    if (!soal || soal.length === 0) return
    setSaving(true)
    try {
      for (const s of soal) {
        await fetch('/api/v1/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({
            mapel: s.mapel || 'Technical Support I',
            kelas: s.kelas || 'X-IPA-1',
            tipe: s.tipe || 'PG',
            bobot: s.bobot || 10,
            teks_html: s.teks,
            opsi: s.opsi.map(o => ({ label: o.label, teks_html: o.teks, is_kunci: o.kunci }))
          })
        })
      }
      setSaved(true)
      loadDbQuestions()
    } catch (e) {
      alert('Gagal menyimpan ke database')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(q: QuestionItem) {
    setEditingId(q.id)
    setEditForm({
      mapel: q.mapel,
      kelas: q.kelas,
      tipe: q.tipe || 'PG',
      bobot: q.bobot || 10,
      teks_html: q.teks_html,
      opsi: q.opsi.map(o => ({ label: o.label, teks_html: o.teks_html, is_kunci: o.is_kunci })),
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditSaving(true)
    updateQuestion(editingId, editForm)
      .then(() => {
        setEditingId(null)
        loadDbQuestions()
      })
      .catch(err => alert('Gagal menyimpan perubahan: ' + err.message))
      .finally(() => setEditSaving(false))
  }

  return (
    <Navbar title="Bank Soal" subtitle="Upload file .docx untuk membuat soal otomatis dan kelola bank soal database.">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bank Soal (Upload Word & Database)</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Buat puluhan hingga ratusan soal otomatis cukup upload file <b>.docx</b> atau pantau dan edit daftar soal di database.
            </p>
          </div>
        </div>

        {/* Grid layout for Upload section & Database Soal panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left / Top: Upload Word */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <IconFileText className="w-5 h-5 text-blue-700" />
                <span>Upload Word (.docx)</span>
              </h2>
              <div className="p-6 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-700 transition-colors text-center space-y-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-lg mx-auto flex items-center justify-center">
                  <IconFileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pilih File Word (.docx)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Format standar CBT-BINAZ • Maksimum file 10MB</p>
                </div>
                <input
                  type="file"
                  accept=".docx"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-slate-500 mx-auto block"
                />
                <div>
                  <button
                    onClick={handleUpload}
                    disabled={!file || parsing}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
                  >
                    {parsing ? 'Membaca Word...' : 'Parse File Word (.docx)'}
                  </button>
                </div>
              </div>

              {/* Preview Results */}
              {soal && !saved && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Hasil Parsing — {soal.length} Soal Berhasil Dikenali</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {soal.map((s, si) => (
                      <div key={s.nomor} className="p-3 rounded-lg border bg-slate-50 border-slate-200 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 tnum">Soal #{s.nomor}</span>
                          <span className="text-slate-500">{s.mapel} ({s.kelas})</span>
                        </div>
                        <p className="font-medium text-slate-900 mt-2">{s.teks}</p>

                        <div className="mt-2 space-y-1.5">
                          {s.opsi.map((o, oi) => (
                            <label key={o.label} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="radio"
                                name={`soal-${s.nomor}`}
                                checked={o.kunci}
                                onChange={() => toggleKunci(si, oi)}
                                className="accent-blue-700 w-3.5 h-3.5"
                              />
                              <span className={o.kunci ? 'font-semibold text-blue-900' : 'text-slate-700'}>
                                {o.label}. {o.teks}
                              </span>
                              {o.kunci && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 ml-auto">KUNCI</span>}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSimpan}
                    disabled={saving}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
                  >
                    {saving ? 'Menyimpan ke Database...' : `Simpan ${soal.length} Soal ke Bank Soal`}
                  </button>
                </div>
              )}

              {saved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium text-xs flex items-center gap-2">
                  <IconCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Berhasil menyimpan soal ke database Bank Soal.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right / Bottom: Daftar Soal di Database */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Daftar Soal di Database</h2>
                <p className="text-xs text-slate-500 mt-0.5">Total tersimpan: <span className="font-semibold text-slate-900 tnum">{dbQuestions.length}</span> soal</p>
              </div>
              <button
                onClick={loadDbQuestions}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
            </div>

            <div className="flex-1 min-h-[350px] max-h-[600px] overflow-y-auto space-y-3 pr-1">
              {dbLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Memuat soal dari database...</div>
              ) : dbError ? (
                <div className="py-12 text-center text-xs text-rose-600">{dbError}</div>
              ) : dbQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Belum ada soal tersimpan di database. Upload file .docx lalu klik Simpan.
                </div>
              ) : (
                dbQuestions.map((q, index) => (
                  <div key={q.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                    {editingId === q.id ? (
                      /* Edit mode form */
                      <form onSubmit={saveEdit} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold bg-blue-700 text-white px-2 py-0.5 rounded tnum text-xs">Edit #{index + 1}</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Teks Soal (HTML)</label>
                          <textarea
                            value={editForm.teks_html}
                            onChange={e => setEditForm({ ...editForm, teks_html: e.target.value })}
                            rows={3}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:outline-none bg-white"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[11px] font-medium text-slate-700">Opsi & Kunci Jawaban</label>
                          {editForm.opsi.map((o, oi) => (
                            <div key={o.label} className="flex items-center gap-2">
                              <span className="w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-700 rounded font-semibold text-xs flex-shrink-0">
                                {o.label}
                              </span>
                              <input
                                type="text"
                                value={o.teks_html}
                                onChange={e => {
                                  const newOpsi = [...editForm.opsi]
                                  newOpsi[oi].teks_html = e.target.value
                                  setEditForm({ ...editForm, opsi: newOpsi })
                                }}
                                className="flex-1 text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:outline-none bg-white"
                                required
                              />
                              <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={o.is_kunci}
                                  onChange={e => {
                                    const newOpsi = [...editForm.opsi]
                                    newOpsi[oi].is_kunci = e.target.checked
                                    setEditForm({ ...editForm, opsi: newOpsi })
                                  }}
                                  className="accent-blue-700 w-3.5 h-3.5"
                                />
                                Kunci
                              </label>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={editSaving}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            disabled={editSaving}
                            className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                          >
                            {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Normal view card */
                      <>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold bg-blue-700 text-white px-2 py-0.5 rounded tnum">#{index + 1}</span>
                            <span className="font-medium bg-slate-200 text-slate-800 px-2 py-0.5 rounded">{q.mapel}</span>
                            <span className="font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">{q.kelas}</span>
                            <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{q.tipe}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium tnum">Bobot: {q.bobot}</span>
                            <button
                              onClick={() => startEdit(q)}
                              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-medium rounded border border-blue-200 transition-colors shadow-sm text-[11px]"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        <div className="font-medium text-slate-900 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: q.teks_html }} />

                        <div className="space-y-1 pt-1 border-t border-slate-200/60">
                          {q.opsi && q.opsi.map(o => (
                            <div key={o.label} className={`flex items-start gap-2 p-1.5 rounded ${o.is_kunci ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium' : 'text-slate-700'}`}>
                              <span className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-semibold flex-shrink-0 ${o.is_kunci ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                {o.label}
                              </span>
                              <div className="flex-1 leading-normal" dangerouslySetInnerHTML={{ __html: o.teks_html }} />
                              {o.is_kunci && (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex-shrink-0">
                                  KUNCI
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Navbar>
  )
}
