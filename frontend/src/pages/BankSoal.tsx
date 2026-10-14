import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { IconFileText, IconCheckCircle, IconRefresh } from '../components/Icons'
import { fetchBankSoal, updateQuestion, getToken, QuestionItem } from '../api/client'
import { parseDocxToSoal, ParsedSoal } from '../utils/docxParser'

export default function BankSoal() {
  const [activeTab, setActiveTab] = useState<'upload' | 'list'>('upload')

  const [file, setFile] = useState<File | null>(null)
  const [soal, setSoal] = useState<ParsedSoal[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Database questions state
  const [dbQuestions, setDbQuestions] = useState<QuestionItem[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // Filter state for list tab
  const [filterKelas, setFilterKelas] = useState('Semua')
  const [filterMapel, setFilterMapel] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')

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
            'Authorization': `Bearer ${getToken()}`,
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
      setActiveTab('list')
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

  // Filter options for list tab
  const kelasList = ['Semua', ...Array.from(new Set(dbQuestions.map(q => q.kelas).filter(Boolean))).sort()]
  const mapelList = ['Semua', ...Array.from(new Set(dbQuestions.map(q => q.mapel).filter(Boolean))).sort()]

  const filteredQuestions = dbQuestions.filter(q => {
    if (filterKelas !== 'Semua' && q.kelas !== filterKelas) return false
    if (filterMapel !== 'Semua' && q.mapel !== filterMapel) return false
    if (searchQuery.trim() !== '') {
      const qText = q.teks_html.toLowerCase()
      if (!qText.includes(searchQuery.toLowerCase())) return false
    }
    return true
  })

  return (
    <Navbar title="Bank Soal" subtitle="Upload file .docx, kelola, filter, dan edit soal di database.">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Manajemen Bank Soal</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Kelola naskah soal ujian melalui upload dokumen Word (.docx) atau tinjau daftar soal tersimpan dengan filter lengkap.
            </p>
          </div>
          {/* Tab Navigation */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === 'upload' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Upload Word (.docx)
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Daftar Soal ({dbQuestions.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Upload Word */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 shadow-sm max-w-3xl mx-auto">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <IconFileText className="w-5 h-5 text-blue-700" />
                <span>Upload Naskah Soal (.docx)</span>
              </h2>
              <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-700 transition-colors text-center space-y-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-xl mx-auto flex items-center justify-center">
                  <IconFileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pilih File Word (.docx)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Format standar: 1. Soal ... dan A. Opsi ... (* untuk kunci)</p>
                </div>
                <input
                  type="file"
                  accept=".docx"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-slate-500 mx-auto block pt-2"
                />
                <div>
                  <button
                    onClick={handleUpload}
                    disabled={!file || parsing}
                    className="mt-2 bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-40"
                  >
                    {parsing ? 'Membaca Word...' : 'Parse & Pratinjau Soal'}
                  </button>
                </div>
              </div>

              {/* Preview Results */}
              {soal && !saved && (() => {
                const groupedParsed = soal.reduce((acc, s) => {
                  const m = s.mapel || 'Umum'
                  if (!acc[m]) acc[m] = []
                  acc[m].push(s)
                  return acc
                }, {} as Record<string, ParsedSoal[]>)

                return (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Pratinjau Hasil Parsing — <span className="text-blue-700">{soal.length} Soal</span> Dikelompokkan per Mata Pelajaran</h3>
                    </div>
                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1">
                      {Object.entries(groupedParsed).map(([mapelName, items]) => (
                        <div key={mapelName} className="space-y-3 bg-slate-50/80 p-4 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-700"></span>
                              <span>MAPEL: {mapelName}</span>
                              <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{items.length} Soal</span>
                            </h4>
                          </div>
                          <div className="space-y-3">
                            {items.map((s) => {
                              const originalIdx = soal.findIndex(orig => orig.nomor === s.nomor && orig.teks === s.teks)
                              return (
                                <div key={s.nomor} className="p-3.5 rounded-lg border bg-white border-slate-200 text-xs space-y-2 shadow-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 tnum">Soal #{s.nomor}</span>
                                    <span className="text-slate-500 font-medium">{s.kelas}</span>
                                  </div>
                                  <p className="font-medium text-slate-900 leading-relaxed">{s.teks}</p>

                                  <div className="space-y-1.5 pt-1">
                                    {s.opsi.map((o, oi) => (
                                      <label key={o.label} className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                          type="radio"
                                          name={`soal-${s.nomor}-${mapelName}`}
                                          checked={o.kunci}
                                          onChange={() => toggleKunci(originalIdx, oi)}
                                          className="accent-blue-700 w-3.5 h-3.5"
                                        />
                                        <span className={o.kunci ? 'font-semibold text-emerald-800' : 'text-slate-700'}>
                                          {o.label}. {o.teks}
                                        </span>
                                        {o.kunci && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 ml-auto">KUNCI</span>}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSimpan}
                      disabled={saving}
                      className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
                    >
                      {saving ? 'Menyimpan ke Database...' : `Simpan ${soal.length} Soal ke Bank Soal`}
                    </button>
                  </div>
                )
              })()}

              {saved && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Berhasil menyimpan soal ke database Bank Soal.</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('list')}
                    className="px-3 py-1 bg-emerald-700 text-white rounded font-medium text-xs hover:bg-emerald-800 transition-colors"
                  >
                    Lihat Daftar Soal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Daftar Soal & Filter */}
        {activeTab === 'list' && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Daftar Soal Tersimpan</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan <span className="font-semibold text-slate-900 tnum">{filteredQuestions.length}</span> dari total <span className="font-semibold text-slate-900 tnum">{dbQuestions.length}</span> soal di database
                </p>
              </div>
              <button
                onClick={loadDbQuestions}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors self-start md:self-auto"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Filter Kelas</label>
                <select
                  value={filterKelas}
                  onChange={e => setFilterKelas(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {kelasList.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Filter Mata Pelajaran</label>
                <select
                  value={filterMapel}
                  onChange={e => setFilterMapel(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  {mapelList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Cari Teks Soal</label>
                <input
                  type="text"
                  placeholder="Ketik kata kunci soal..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {dbLoading ? (
                <div className="py-16 text-center text-xs text-slate-400">Memuat soal dari database...</div>
              ) : dbError ? (
                <div className="py-16 text-center text-xs text-rose-600">{dbError}</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Tidak ada soal yang cocok dengan filter atau belum ada soal di database.
                </div>
              ) : (() => {
                const groupedDb = filteredQuestions.reduce((acc, q) => {
                  const m = q.mapel || 'Umum'
                  if (!acc[m]) acc[m] = []
                  acc[m].push(q)
                  return acc
                }, {} as Record<string, QuestionItem[]>)

                return (
                  <div className="space-y-6">
                    {Object.entries(groupedDb).map(([mapelName, items]) => (
                      <div key={mapelName} className="space-y-3 bg-slate-50/70 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-700"></span>
                            <span>MAPEL: {mapelName}</span>
                            <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{items.length} Soal Tersimpan</span>
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {items.map((q, index) => (
                            <div key={q.id} className="p-4 rounded-lg border border-slate-200 bg-white space-y-3 shadow-xs">
                    {editingId === q.id ? (
                      /* Edit mode form */
                      <form onSubmit={saveEdit} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold bg-blue-700 text-white px-2 py-0.5 rounded tnum text-xs">Edit Soal #{index + 1}</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">Teks Soal</label>
                          <textarea
                            value={editForm.teks_html}
                            onChange={e => setEditForm({ ...editForm, teks_html: e.target.value })}
                            rows={3}
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:outline-none bg-white text-slate-900"
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
                                className="flex-1 text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:outline-none bg-white text-slate-900"
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
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
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
                            <span className="font-semibold bg-blue-700 text-white px-2 py-0.5 rounded tnum text-xs">#{index + 1}</span>
                            <span className="font-medium bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-xs">{q.mapel}</span>
                            <span className="font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-xs">{q.kelas}</span>
                            <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">{q.tipe}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium tnum text-xs">Bobot: {q.bobot}</span>
                            <button
                              onClick={() => startEdit(q)}
                              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 font-medium rounded border border-blue-200 transition-colors shadow-sm text-[11px]"
                            >
                              Edit
                            </button>
                          </div>
                        </div>

                        <div className="font-medium text-slate-900 text-sm leading-relaxed pt-1" dangerouslySetInnerHTML={{ __html: q.teks_html }} />

                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                          {q.opsi && q.opsi.map(o => (
                            <div key={o.label} className={`flex items-start gap-2 p-1.5 rounded text-xs ${o.is_kunci ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium' : 'text-slate-700'}`}>
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
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </Navbar>
  )
}
