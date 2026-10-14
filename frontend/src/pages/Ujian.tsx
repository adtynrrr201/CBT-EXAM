import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { createUjian, fetchBankSoal, fetchSiswa } from '../api/client'
import { IconCheckCircle } from '../components/Icons'

const MAPEL = ['IPA', 'IPS', 'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris']
const KELAS = ['XII-IPA-1', 'XII-IPA-2', 'XII-IPS-1']

interface Info { judul: string; mapel: string; durasi: number; kelas: string[] }
interface SoalPick { jumlah: number; acakSoal: boolean; acakOpsi: boolean }
interface Policy {
  require_seb: boolean; require_fullscreen: boolean
  max_focus_lost_warn: number; max_focus_lost_autosubmit: number
  block_copy_paste_pg: boolean; heartbeat_interval_sec: number
  token: string; mulai: string; selesai: string
}

const DRAFT_KEY = 'cbt.ujian.draft'

function loadDraft(): { info?: Info; soal?: SoalPick; policy?: Policy } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function Ujian() {
  const draft = loadDraft()
  const [step, setStep] = useState(0)
  const [hasDraft, setHasDraft] = useState(!!draft)

  const [info, setInfo] = useState<Info>(() => draft?.info ?? { judul: 'UAS IPA Semester 1', mapel: MAPEL[0], durasi: 90, kelas: ['XII-IPA-1'] })
  const [soal, setSoal] = useState<SoalPick>(() => draft?.soal ?? { jumlah: 50, acakSoal: true, acakOpsi: true })
  const [totalBankSoal, setTotalBankSoal] = useState(0)
  const [dbKelasList, setDbKelasList] = useState<string[]>(['X-IPA-1', 'XI-IPA-1', 'XII-IPA-1'])

  useEffect(() => {
    fetchBankSoal().then(r => {
      const len = (r.questions || []).length
      setTotalBankSoal(len)
      if (len > 0 && soal.jumlah === 50) {
        setSoal(prev => ({ ...prev, jumlah: len }))
      }
    }).catch(() => {})
    fetchSiswa().then(r => {
      const setK = new Set((r.siswa || []).map(s => s.kelas).filter(Boolean))
      if (setK.size > 0) {
        setDbKelasList(Array.from(setK).sort())
      }
    }).catch(() => {})
  }, [])
  const [policy, setPolicy] = useState<Policy>(() => draft?.policy ?? {
    require_seb: false, require_fullscreen: true,
    max_focus_lost_warn: 3, max_focus_lost_autosubmit: 5,
    block_copy_paste_pg: true, heartbeat_interval_sec: 20,
    token: 'ABC123', mulai: '', selesai: '',
  })

  // Persist draft on every change
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ info, soal, policy }))
    setHasDraft(true)
  }, [info, soal, policy])

  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function toggleKelas(k: string) {
    setInfo(prev => ({
      ...prev,
      kelas: prev.kelas.includes(k) ? prev.kelas.filter(x => x !== k) : [...prev.kelas, k],
    }))
  }

  function toRFC3339(local: string) {
    const d = new Date(local)
    return isNaN(d.getTime()) ? '' : d.toISOString()
  }

  async function handleSave() {
    setErr('')
    const mulai = toRFC3339(policy.mulai)
    const selesai = toRFC3339(policy.selesai)
    if (!mulai || !selesai) {
      setErr('Isi tanggal mulai dan selesai dulu (langkah Jadwal).')
      return
    }
    setSaving(true)
    try {
      const res = await createUjian({
        judul: info.judul, mapel: info.mapel, mulai, selesai,
        durasi_menit: info.durasi, kelas: info.kelas,
        jumlah_soal: soal.jumlah, token: policy.token,
        require_seb: policy.require_seb,
      })
      setSaved(`Jadwal tersimpan (ID ${res.ujian_id}) — ${res.packages} paket untuk ${res.siswa} siswa, ${res.soal} soal.` +
        (res.require_seb ? ` Wajib SEB — kunci: ${res.seb_config_key}` : ''))
      localStorage.removeItem(DRAFT_KEY)
      setHasDraft(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const titles = ['Informasi Ujian', 'Pemilihan Soal', 'Jadwal & Lockdown Policy']

  return (
    <Navbar title="Ujian" subtitle="Buat dan jadwalkan ujian baru dengan parameter lengkap.">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Wizard Pembuatan Ujian Baru</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Atur parameter ujian, paket soal, jadwal pelaksanaan, dan konfigurasi penguncian (lockdown).</p>
          </div>
          {hasDraft && (
            <button
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setHasDraft(false); location.reload() }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium border border-rose-200 px-3 py-1.5 rounded-lg shrink-0 bg-white hover:bg-rose-50 transition-colors"
            >
              Buang draft
            </button>
          )}
        </div>

        {/* Wizard Steps Header */}
        <div className="grid grid-cols-3 gap-2">
          {titles.map((t, i) => (
            <div
              key={i}
              className={`p-3 text-center text-xs font-semibold rounded-lg border transition-colors ${
                i === step
                  ? 'bg-blue-700 text-white border-blue-700'
                  : i < step
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {i + 1}. {t}
            </div>
          ))}
        </div>

        {/* Wizard Card Body */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
          {/* Step 0: Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Judul Ujian</label>
                <input
                  value={info.judul}
                  onChange={e => setInfo({ ...info, judul: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-700 text-slate-900"
                  placeholder="Contoh: UAS IPA Semester 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mata Pelajaran</label>
                  <select
                    value={info.mapel}
                    onChange={e => setInfo({ ...info, mapel: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-700 text-slate-900"
                  >
                    {MAPEL.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    value={info.durasi}
                    onChange={e => setInfo({ ...info, durasi: +e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-700 font-mono text-slate-900 tnum"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Pilih Kelas Peserta</label>
                <div className="flex gap-3 flex-wrap">
                  {dbKelasList.map(k => (
                    <label key={k} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer text-slate-900">
                      <input
                        type="checkbox"
                        checked={info.kelas.includes(k)}
                        onChange={() => toggleKelas(k)}
                        className="accent-blue-700 w-4 h-4"
                      />
                      <span>{k}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Soal */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs flex items-center justify-between">
                <span>Total soal tersedia di Bank Soal database:</span>
                <span className="font-bold text-sm tnum">{totalBankSoal} soal</span>
              </div>
              <p className="text-[13px] text-slate-600">
                Soal akan di-generate otomatis dari Bank Soal (tersedia {totalBankSoal} butir soal).
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah Soal Dipilih</label>
                <input
                  type="number"
                  max={totalBankSoal}
                  min={1}
                  value={soal.jumlah}
                  onChange={e => setSoal({ ...soal, jumlah: +e.target.value })}
                  className="w-32 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-blue-700 text-slate-900 tnum"
                />
                <p className="text-[11px] text-slate-400 mt-1">Maksimal {totalBankSoal} soal sesuai yang diunggah di Bank Soal.</p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-[13px] text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soal.acakSoal}
                    onChange={e => setSoal({ ...soal, acakSoal: e.target.checked })}
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span>Acak urutan soal per siswa</span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soal.acakOpsi}
                    onChange={e => setSoal({ ...soal, acakOpsi: e.target.checked })}
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span>Acak pilihan jawaban (A, B, C, D)</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Policy */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Token Masuk Ujian</label>
                  <input
                    value={policy.token}
                    onChange={e => setPolicy({ ...policy, token: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-blue-700 text-slate-900"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mulai</label>
                  <input
                    type="datetime-local"
                    value={policy.mulai}
                    onChange={e => setPolicy({ ...policy, mulai: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-700 text-slate-900 tnum"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Selesai</label>
                  <input
                    type="datetime-local"
                    value={policy.selesai}
                    onChange={e => setPolicy({ ...policy, selesai: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-700 text-slate-900 tnum"
                  />
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 text-sm border-t border-slate-200 pt-4">Konfigurasi Penguncian (Lockdown Policy)</h3>

              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.require_fullscreen}
                    onChange={e => setPolicy({ ...policy, require_fullscreen: e.target.checked })}
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span>Wajib Layar Penuh (Fullscreen Required)</span>
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.require_seb}
                    onChange={e => setPolicy({ ...policy, require_seb: e.target.checked })}
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span>Wajib Safe Exam Browser (SEB Mode)</span>
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.block_copy_paste_pg}
                    onChange={e => setPolicy({ ...policy, block_copy_paste_pg: e.target.checked })}
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span>Blokir Copy-Paste & Klik Kanan</span>
                </label>
              </div>

              <h3 className="font-semibold text-slate-900 text-sm border-t border-slate-200 pt-4">Ringkasan sebelum rilis</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  ['Judul', info.judul || '—'],
                  ['Soal', `${soal.jumlah} butir${soal.acakSoal ? ' · acak' : ''}`],
                  ['Durasi', `${info.durasi} mnt · ${info.kelas.join(', ') || '—'}`],
                  ['Mulai → Selesai', `${policy.mulai || '?'} → ${policy.selesai || '?'}`],
                ].map(([k, v]) => (
                  <div key={k} className="border border-slate-200 rounded-lg px-2 py-2.5 bg-slate-50">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
                    <dd className="text-xs font-semibold text-slate-900 mt-0.5 break-words">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="bg-slate-900 text-slate-200 rounded-lg p-4 text-xs font-mono">
                <p className="text-slate-400 font-bold mb-1">// Policy JSON Output</p>
                <pre>{JSON.stringify(policy, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Nav Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium text-sm hover:bg-slate-50 disabled:opacity-30 transition-colors bg-white"
            >
              Sebelumnya
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors shadow-sm"
              >
                Langkah Berikutnya
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors shadow-sm"
              >
                {saving ? 'Menyimpan…' : 'Simpan & Rilis Jadwal Ujian'}
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className="p-4 bg-white border border-rose-200 text-rose-900 rounded-lg font-medium text-sm">
            Gagal menyimpan: {err}
          </div>
        )}

        {saved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium text-sm flex items-center gap-2">
            <IconCheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{saved}</span>
          </div>
        )}
      </div>
    </Navbar>
  )
}
