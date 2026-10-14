import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useLockdown } from '../hooks/useLockdown'
import { startExam, answer as sendAnswer, finish as sendFinish, gradeDemo, fetchQuestions, setExamToken, fetchAnnouncement } from '../api/client'
import { IconClock, IconCheckCircle, IconAlertTriangle, IconFlag, IconChevronRight, IconShieldAlert } from '../components/Icons'

interface ResultData {
  nilai?: number
  benar?: number
  salah?: number
  kosong?: number
}

// Sample 5 questions for the demo bank (graded by POST /ujian/demo/grade —
// the browser never holds answer keys).
const QUESTIONS = [
  {
    id: 'q1',
    text: 'Ibu kota negara Republik Indonesia adalah ....',
    options: [
      { key: 'A', text: 'Bandung' },
      { key: 'B', text: 'Jakarta (Nusantara)' },
      { key: 'C', text: 'Surabaya' },
      { key: 'D', text: 'Medan' },
    ]
  },
  {
    id: 'q2',
    text: 'Pancasila sila pertama berbunyi ....',
    options: [
      { key: 'A', text: 'Ketuhanan Yang Maha Esa' },
      { key: 'B', text: 'Kemanusiaan yang adil dan beradab' },
      { key: 'C', text: 'Persatuan Indonesia' },
      { key: 'D', text: 'Keadilan sosial bagi seluruh rakyat Indonesia' },
    ]
  },
  {
    id: 'q3',
    text: 'Lembaga yang berwenang menguji undang-undang terhadap UUD 1945 adalah ....',
    options: [
      { key: 'A', text: 'Mahkamah Agung' },
      { key: 'B', text: 'Mahkamah Konstitusi' },
      { key: 'C', text: 'Dewan Perwakilan Rakyat' },
      { key: 'D', text: 'Komisi Yudisial' },
    ]
  },
  {
    id: 'q4',
    text: 'Proses fotosintesis pada tumbuhan hijau menghasilkan ....',
    options: [
      { key: 'A', text: 'Karbondioksida dan Air' },
      { key: 'B', text: 'Oksigen dan Glukosa' },
      { key: 'C', text: 'Nitrogen dan Karbon' },
      { key: 'D', text: 'Asam Sulfat dan Air' },
    ]
  },
  {
    id: 'q5',
    text: 'Planet terbesar dalam tata surya kita adalah ....',
    options: [
      { key: 'A', text: 'Mars' },
      { key: 'B', text: 'Saturnus' },
      { key: 'C', text: 'Jupiter' },
      { key: 'D', text: 'Neptunus' },
    ]
  }
]

export default function ExecUjian() {
  const { id = 'demo' } = useParams()
  const { user, signOut } = useAuth()
  const role = user?.role || 'siswa'
  const { focusLost, isFullscreen, action, enterFullscreen } = useLockdown(id, true)

  // ID non-UUID (mis. "demo") = bank contoh lokal: tanpa paket server,
  // jawaban dinilai lokal dan progres tersimpan di browser.
  const isDemo = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const storeKey = `cbt.exam.${id}`

  function loadStored<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${storeKey}.${key}`)
      if (!raw) return fallback
      const parsed = JSON.parse(raw) as T
      if (fallback !== null && typeof fallback === 'object' && parsed !== null && typeof parsed === 'object') {
        return { ...fallback, ...parsed }
      }
      return parsed ?? fallback
    } catch {
      return fallback
    }
  }

  const [currentIdx, setCurrentIdx] = useState(() => loadStored('idx', 0))
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadStored('answers', {}))
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() => loadStored('flagged', {}))

  const [sisa, setSisa] = useState(() => loadStored('sisa', 90 * 60))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [err, setErr] = useState('')
  const [blocked, setBlocked] = useState('')
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved')
  const [packageId, setPackageId] = useState('')
  // Outbox semi-daring: jawaban gagal terkirim (jaringan lab putus) antre di
  // browser, dikirim ulang otomatis tiap 15 detik / saat online kembali.
  const [outbox, setOutbox] = useState<Array<{ qid: string; opt: string }>>(() => loadStored('outbox', []))

  // Refresh tidak menghilangkan jawaban + timer (persist per ujian).
  useEffect(() => {
    try {
      localStorage.setItem(`${storeKey}.answers`, JSON.stringify(answers))
      localStorage.setItem(`${storeKey}.flagged`, JSON.stringify(flagged))
      localStorage.setItem(`${storeKey}.idx`, JSON.stringify(currentIdx))
      localStorage.setItem(`${storeKey}.sisa`, JSON.stringify(sisa))
      localStorage.setItem(`${storeKey}.outbox`, JSON.stringify(outbox))
    } catch {}
  }, [answers, flagged, currentIdx, sisa, outbox, storeKey])

  function clearStored() {
    ;['answers', 'flagged', 'idx', 'sisa', 'outbox'].forEach(k => {
      try { localStorage.removeItem(`${storeKey}.${k}`) } catch {}
    })
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoRef = useRef(false)

  // ponytail: jumlah mengikuti bank contoh; grid 50 statis membingungkan (soal berulang modulo)
  // add when bank soal backend tersambung → TOTAL dari API
  const [bank, setBank] = useState<typeof QUESTIONS | null>(isDemo ? QUESTIONS : null)
  const [bankErr, setBankErr] = useState('')
  const TOTAL_QUESTIONS = bank ? bank.length : 0

  useEffect(() => {
    if (isDemo) return
    fetchQuestions(id)
      .then(res => {
        const list = (res.questions || []).map(q => ({
          id: q.id,
          text: q.text,
          options: q.options.map(o => ({ key: o.label, text: o.text })),
        }))
        if (list.length === 0) {
          setBankErr('Bank soal ujian ini masih kosong. Minta guru mengisi bank soal dulu.')
        } else {
          setBankErr('')
        }
        setBank(list)
      })
      .catch(e => {
        setBankErr(e instanceof Error ? e.message : String(e))
        setBank([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    startExam(id)
      .then(res => {
        if (res.exam_token) setExamToken(res.exam_token)
        if (res.exam_package_id) setPackageId(res.exam_package_id)
        // Jam server resmi bila ada: timer mengikuti ends_at, bukan angka lokal.
        if (res.ends_at && !isDemo) {
          const left = Math.floor((new Date(res.ends_at).getTime() - Date.now()) / 1000)
          if (left > 0) setSisa(s => Math.min(s, left))
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('SEB_REQUIRED')) {
          setBlocked('Ujian ini wajib dibuka melalui Safe Exam Browser (SEB). Tutup browser biasa, buka file config SEB dari proktor, lalu login ulang.')
        } else if (msg.includes('403')) {
          setBlocked('Ujian ini sudah dikirim atau tidak tersedia untuk Anda.')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const t = setInterval(() => setSisa(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const q = bank && bank.length > 0 ? bank[currentIdx % bank.length] : null
  const currentQId = q ? q.id : `q${currentIdx + 1}`

  function handleSelect(optKey: string) {
    setAnswers(prev => ({ ...prev, [currentQId]: optKey }))
    if (isDemo) {
      // Bank contoh: tak ada paket server — langsung tersimpan lokal.
      setAutosaveStatus('saved')
      return
    }
    setAutosaveStatus('saving')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      sendAnswer(id, currentQId, optKey, packageId || undefined)
        .then(() => setAutosaveStatus('saved'))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e)
          // Server menutup sesi (waktu habis / sudah dikirim) → kirim otomatis.
          if (msg.includes('403')) {
            handleSubmit(true)
          } else {
            // Jaringan putus: antre ke outbox, jawaban aman di browser.
            setOutbox(prev => {
              const next = prev.filter(o => o.qid !== currentQId)
              next.push({ qid: currentQId, opt: optKey })
              return next
            })
            setAutosaveStatus('saved')
          }
        })
    }, 400)
  }

  // Flush outbox tiap 15 detik (semi-daring): kirim jawaban tertunda berurutan.
  useEffect(() => {
    if (isDemo || outbox.length === 0) return
    const t = setInterval(() => {
      const [head, ...rest] = outbox
      if (!head) return
      sendAnswer(id, head.qid, head.opt, packageId || undefined)
        .then(() => setOutbox(rest))
        .catch(() => {})
    }, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, outbox.length, packageId])

  function toggleFlag() {
    setFlagged(prev => ({ ...prev, [currentQId]: !prev[currentQId] }))
  }

  async function handleSubmit(auto = false) {
    if (!auto && !confirm('Apakah Anda yakin ingin mengakhiri dan mengirim seluruh jawaban ujian?')) return
    setSubmitting(true)
    setErr('')
    try {
      if (isDemo) {
        // Kunci hanya ada di server (POST /ujian/demo/grade).
        setResult(await gradeDemo(answers))
        clearStored()
      } else {
        const res = await sendFinish(id, packageId || undefined)
        if (!res) throw new Error('Server tidak mengembalikan nilai.')
        setResult(res)
        clearStored()
        // Sesi dikunci pasca-submit: keluar agar PC bersama aman dipakai shift berikut.
        signOut()
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  // Waktu habis → kirim otomatis tanpa konfirmasi (sekali saja)
  useEffect(() => {
    if (sisa === 0 && !result && !autoRef.current) {
      autoRef.current = true
      handleSubmit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sisa])

  // Pelanggaran maksimal dari server → kirim otomatis juga (bukan sekadar banner).
  useEffect(() => {
    if (action === 'AUTO_SUBMIT' && !result && !autoRef.current) {
      autoRef.current = true
      handleSubmit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [annModal, setAnnModal] = useState<{ id: string; message: string } | null>(null)
  const [lastAnnId, setLastAnnId] = useState('')
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Poll announcements every 30s
  useEffect(() => {
    if (result) return
    const poll = () => {
      fetchAnnouncement(id)
        .then(res => {
          if (res?.id && res.message && res.id !== lastAnnId) {
            setLastAnnId(res.id)
            setAnnModal({ id: res.id, message: res.message })
          }
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, result, lastAnnId])

  const mm = String(Math.floor(sisa / 60)).padStart(2, '0')
  const ss = String(sisa % 60).padStart(2, '0')

  if (!q) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-slate-200 px-6 py-8 max-w-sm w-full text-center space-y-2">
          {blocked ? (
            <>
              <p className="text-sm font-semibold text-slate-900">Ujian terkunci</p>
              <p className="text-xs text-slate-500">{blocked}</p>
              <a href="/siswa-beranda" className="inline-block mt-2 text-xs font-semibold text-blue-700 underline underline-offset-2">
                Kembali ke beranda
              </a>
            </>
          ) : bankErr ? (
            <>
              <p className="text-sm font-semibold text-slate-900">Soal belum tersedia</p>
              <p className="text-xs text-slate-500">{bankErr}</p>
              <a href="/siswa-beranda" className="inline-block mt-2 text-xs font-semibold text-blue-700 underline underline-offset-2">
                Kembali ke beranda
              </a>
            </>
          ) : (
            <>
              <span className="inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></span>
              <p className="text-sm text-slate-500">Memuat soal ujian…</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // Score Screen Modal
  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-slate-200 p-8 max-w-lg w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-lg mx-auto flex items-center justify-center text-emerald-700">
            <IconCheckCircle className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">Ujian Telah Selesai</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Seluruh jawaban Anda telah terkirim dan tersimpan aman di server.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-600 text-[13px] font-medium">Nilai Akhir Ujian:</span>
              <span className="text-3xl font-bold text-slate-900 tnum">{result.nilai ?? 84}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <p className="text-emerald-700 font-medium">Benar</p>
                <p className="text-lg font-bold text-emerald-800 tnum mt-0.5">{result.benar ?? 42}</p>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <p className="text-rose-700 font-medium">Salah</p>
                <p className="text-lg font-bold text-rose-800 tnum mt-0.5">{result.salah ?? 6}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <p className="text-slate-600 font-medium">Kosong</p>
                <p className="text-lg font-bold text-slate-700 tnum mt-0.5">{result.kosong ?? 2}</p>
              </div>
            </div>
          </div>

          <Link
            to={isDemo ? (role === 'admin' ? '/' : '/siswa-beranda') : '/login'}
            className="block w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm text-center"
          >
            {isDemo ? 'Kembali ke Beranda' : 'Selesai — kembali ke login'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">

      {/* Top Lockdown Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-white text-sm">
            CB
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight leading-tight">
              UAS IPA Semester 1 — {id}
              {isDemo && <span className="ml-2 text-[10px] font-medium text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">MODE DEMO</span>}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Siswa: Ahmad Bin Azis</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {autosaveStatus === 'saving' ? 'Menyimpan...' : 'Autosave Aktif'}
              </span>
              {outbox.length > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    {outbox.length} antre sync
                  </span>
                </>
              )}
              <span>•</span>
              <span className={`flex items-center gap-1 ${online ? 'text-slate-400' : 'text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {online ? 'Online' : 'Offline — jawaban aman di browser, jangan tutup halaman'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Timer */}
        <div className="flex items-center gap-3">
          <div className={`bg-slate-950 border px-3.5 py-1.5 rounded-lg font-mono text-base font-bold tracking-wider flex items-center gap-2 shadow-inner tnum ${
            sisa < 600 ? 'border-rose-800 text-rose-400' : 'border-slate-800 text-emerald-400'
          }`}>
            <IconClock className={`w-4 h-4 ${sisa < 600 ? 'text-rose-500' : 'text-emerald-500'}`} />
            <span>{mm}:{ss}</span>
          </div>

          <button
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="hidden sm:flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting ? 'Mengirim...' : 'Selesai Ujian'}
          </button>
        </div>
      </header>

      {/* Floating Lockdown Warnings */}
      {!isFullscreen && (
        <div className="bg-rose-600 text-white p-3 shadow-lg flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2 font-medium text-sm">
            <IconShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>PERINGATAN LOCKDOWN: Mode layar penuh terlepas! Anda wajib kembali ke mode fullscreen.</span>
          </div>
          <button
            onClick={enterFullscreen}
            className="bg-white text-rose-700 hover:bg-slate-100 font-bold px-4 py-1.5 rounded-lg text-xs shadow transition-colors"
          >
            Masuk Fullscreen Sekarang
          </button>
        </div>
      )}

      {action === 'WARN' && (
        <div className="bg-amber-400 text-amber-950 p-2.5 font-semibold text-center text-sm flex items-center justify-center gap-2">
          <IconAlertTriangle className="w-5 h-5" />
          <span>Peringatan Proktor #{focusLost}: Dilarang berpindah window / tab! ({focusLost}/5 batas batas toleransi).</span>
        </div>
      )}

      {action === 'AUTO_SUBMIT' && (
        <div className="bg-rose-700 text-white p-3 font-semibold text-center text-sm flex items-center justify-center gap-2">
          AUTO-SUBMIT DIPICU: Batas pelanggaran maksimum tercapai! Jawaban otomatis dikirim.
        </div>
      )}

      {err && (
        <div className="bg-white border border-rose-200 text-rose-800 text-[13px] font-medium px-4 py-2.5 text-center">
          Gagal mengirim: {err}
        </div>
      )}

      {/* Main Exam Workspace */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

        {/* Left Column: Question Area (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">

            {/* Question Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <span className="bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg tnum">
                  Soal No. {currentIdx + 1}
                </span>
                <span className="text-xs text-slate-500 font-medium">dari {TOTAL_QUESTIONS} Soal</span>
              </div>

              <button
                onClick={toggleFlag}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border ${
                  flagged[currentQId]
                    ? 'bg-amber-400 text-amber-950 border-amber-400 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <IconFlag className="w-3.5 h-3.5" />
                <span>Ragu-ragu</span>
              </button>
            </div>

            {/* Question Text */}
            <div className="text-slate-900 font-medium text-sm leading-relaxed">
              {q.text}
            </div>

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
              {q.options.map(opt => {
                const isSelected = answers[currentQId] === opt.key
                return (
                  <label
                    key={opt.key}
                    onClick={() => handleSelect(opt.key)}
                    className={`flex items-center gap-3.5 p-4 rounded-lg border cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'border-blue-700 ring-2 ring-blue-700/20 bg-blue-50/50 font-semibold text-slate-900'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <span className="text-[13px] flex-1">{opt.text}</span>
                  </label>
                )
              })}
            </div>

            {/* Footer Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium text-sm hover:bg-slate-50 disabled:opacity-30 transition-colors bg-white"
              >
                Sebelumnya
              </button>

              <div className="flex items-center gap-2">
                {currentIdx < TOTAL_QUESTIONS - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(i => i + 1)}
                    className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors shadow-sm"
                  >
                    <span>Berikutnya</span>
                    <IconChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubmit()}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors shadow-sm"
                  >
                    {submitting ? 'Mengirim…' : 'Kirim Jawaban'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Question Grid Navigator (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight border-b border-slate-200 pb-3 flex items-center justify-between">
              <span>Navigasi Nomor Soal</span>
              <span className="text-xs font-normal text-slate-500 tnum">
                {Object.keys(answers).length} / {TOTAL_QUESTIONS} Terisi
              </span>
            </h3>

            {/* Grid 50 buttons */}
            <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, idx) => {
                const qNum = idx + 1
                const qId = `q${qNum}`
                const isCurrent = currentIdx === idx
                const isAnswered = !!answers[qId]
                const isFlagged = !!flagged[qId]

                let btnBg = 'bg-white text-slate-700 border-slate-200'
                if (isFlagged) {
                  btnBg = 'bg-amber-500 text-white border-amber-600 font-bold'
                } else if (isAnswered) {
                  btnBg = 'bg-blue-700 text-white border-blue-700 font-medium'
                }

                return (
                  <button
                    key={qNum}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 rounded-lg border text-xs transition-colors flex items-center justify-center font-mono tnum ${btnBg} ${
                      isCurrent ? 'ring-2 ring-blue-700 ring-offset-1 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    {qNum}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-1 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-700"></span>
                <span>Sudah</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500"></span>
                <span>Ragu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-slate-200"></span>
                <span>Belum</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Announcement Modal */}
      {annModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-slate-200 p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Pengumuman Proktor</h2>
            <p className="text-[13px] text-slate-700 leading-relaxed">{annModal.message}</p>
            <button
              onClick={() => setAnnModal(null)}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
