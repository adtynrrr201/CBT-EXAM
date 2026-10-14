const BASE = '/api/v1'

let token = ''
let examToken = ''

export function setToken(t: string) { token = t }
export function getToken() { return token }
export function setExamToken(t: string) { examToken = t }
export function getExamToken() { return examToken }

function handle401(): never {
  setToken('')
  setExamToken('')
  throw new Error('SESI_HABIS')
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) handle401()
  if (!res.ok) {
    // Sertakan kode error backend (mis. SEB_REQUIRED) agar UI bisa bedakan pesan.
    let code = ''
    try {
      const b = await res.clone().json() as { error?: { code?: string } }
      if (b?.error?.code) code = ` ${b.error.code}`
    } catch { /* abaikan: tetap lempar status HTTP */ }
    throw new Error(`${res.status}${code} ${res.statusText}`)
  }
  return res.json()
}

export interface UjianAktif {
  ujian_id: string
  judul: string
}

export interface UserProfile {
  user_id?: string
  username: string
  role: string
  nama: string
  nis?: string
  kelas?: string
  ujian_aktif?: UjianAktif | string
}

export function me() {
  return api<UserProfile>('GET', '/auth/me')
}

export function login(username: string, password: string, device_id: string, force?: boolean) {
  return api<{ access_token: string; role: string; ujian_aktif?: string; user?: UserProfile }>(
    'POST', '/auth/login', { username, password, device_id, force: !!force },
  )
}

export function logout() {
  return api('POST', '/auth/logout').catch(() => {})
}

export function startExam(ujianId: string) {
  return api<{ exam_token: string; ends_at: string; exam_package_id?: string }>('POST', `/ujian/${ujianId}/start`)
}

export function gradeDemo(answers: Record<string, string>) {
  return api<{ nilai: number; benar: number; salah: number; kosong: number }>(
    'POST', '/ujian/demo/grade', { answers },
  )
}

export interface QuestionItem {
  id: string
  mapel: string
  kelas: string
  tipe: string
  teks_html: string
  bobot: number
  opsi: Array<{
    label: string
    teks_html: string
    is_kunci: boolean
  }>
}

export function fetchBankSoal() {
  return api<{ questions: QuestionItem[] }>('GET', '/questions')
}

export function updateQuestion(id: string, body: { teks_html: string; mapel: string; kelas: string; tipe: string; bobot: number; opsi: Array<{ label: string; teks_html: string; is_kunci: boolean }> }) {
  return api<{ ok: boolean; id: string }>('PUT', `/questions/${id}`, body)
}

export function fetchQuestions(ujianId: string) {
  return api<{ questions: Array<{ id: string; text: string; options: Array<{ label: string; text: string }> }> }>(
    'GET', `/ujian/${ujianId}/questions`,
  )
}

export function heartbeat(ujianId: string, focusLost: number, isFullscreen: boolean, deviceId?: string) {
  return api<{ action?: 'OK' | 'WARN' | 'AUTO_SUBMIT' }>(
    'POST', `/ujian/${ujianId}/heartbeat`,
    { exam_token: examToken, focus_lost: focusLost, is_fullscreen: isFullscreen, device_id: deviceId || '' },
  )
}

export function answer(ujianId: string, questionId: string, jawaban: string, examPackageId?: string) {
  return api('POST', `/ujian/${ujianId}/answer`, { question_id: questionId, jawaban, exam_package_id: examPackageId || '' })
}

export function finish(ujianId: string, examPackageId?: string) {
  return api<{ nilai?: number; benar?: number; salah?: number; kosong?: number }>(
    'POST', `/ujian/${ujianId}/finish`, examPackageId ? { exam_package_id: examPackageId } : {},
  )
}

export function extendExam(ujianId: string, menit: number) {
  return api<{ ok: boolean; extended_menit: number }>('POST', `/ujian/${ujianId}/extend`, { menit })
}

export function forceSubmit(ujianId: string, siswaId: string) {
  return api<{ ok: boolean }>('POST', `/ujian/${ujianId}/force-submit`, { siswa_id: siswaId })
}

export function unblockSiswa(ujianId: string, nis: string) {
  return api<{ ok: boolean }>('POST', `/ujian/${ujianId}/unblock`, { nis })
}
export function fetchLive(ujianId: string) {
  return api<{ peserta: Array<{
    nis: string; nama: string; kelas: string
    status: 'online' | 'selesai' | 'offline'
    focus_lost: number; sisa_waktu: number | null
  }> }>('GET', `/ujian/${ujianId}/live`)
}

export function fetchHasil(ujianId: string) {
  return api<{ hasil: Array<{
    nis: string; nama: string; kelas: string
    benar: number; salah: number; kosong: number; nilai: number
    result_id: string
  }> }>('GET', `/hasil?ujian=${ujianId}`)
}

export interface SiswaRow {
  Line?: number; NIS?: string; Nis?: string; nis?: string
  Nama?: string; nama?: string
  Kelas?: string; kelas?: string
  JenisKelamin?: string; jk?: string; JK?: string
  Password?: string; password?: string
  TahunAjaran?: string
  [k: string]: unknown
}

export function fetchSiswa() {
  return api<{ siswa: Array<{ nis: string; nama: string; kelas: string; jk: string }> }>('GET', '/siswa')
}

export function fetchUsers(role?: string) {
  return api<{ users: Array<{ id: string; username: string; role: string; nama: string }> }>(
    'GET', role ? `/users?role=${role}` : '/users',
  )
}

export function createUser(body: { username: string; password: string; nama: string; role: string }) {
  return api<{ id: string; username: string; role: string; nama: string }>('POST', '/users', body)
}

export function fetchHasilSaya() {
  return api<{ hasil: Array<{
    nis: string; nama: string; kelas: string
    benar: number; salah: number; kosong: number; nilai: number
    result_id: string
  }> }>('GET', '/hasil')
}

export function previewSiswa(rows: unknown[]) {
  return api<{
    valid_count: number; invalid_count: number
    valid: Array<{ NIS: string; Nama: string; Kelas: string; JenisKelamin: string; Line: number }>
    invalid: Array<{ Row: { NIS: string; Nama: string; Kelas: string; Line: number }; Reason: string }>
  }>('POST', '/siswa/import/preview', { rows })
}

export function confirmSiswa(rows: unknown[]) {
  return api<{ sukses: number; gagal: number }>('POST', '/siswa/import/confirm', { rows })
}

export function createUjian(body: { judul: string; mapel: string; mulai: string; selesai: string; durasi_menit: number; kelas: string[]; jumlah_soal: number; token: string; require_seb?: boolean }) {
  return api<{ ujian_id: string; packages: number; siswa: number; soal: number; require_seb: boolean; seb_config_key: string }>('POST', '/ujian', body)
}

export function fetchSebConfig(ujianId: string) {
  return api<{ ujian_id: string; require_seb: boolean; seb_config_key: string }>('GET', `/ujian/${ujianId}/seb-config`)
}

export function updateSebConfig(ujianId: string, body: { require_seb?: boolean; seb_config_key?: string }) {
  return api<{ ujian_id: string; require_seb: boolean; seb_config_key: string }>('PUT', `/ujian/${ujianId}/seb-config`, body)
}

export function fetchUjianList() {
  return api<{ ujian: Array<{ id: string; judul: string; mapel: string; status: string; require_seb: boolean }> }>('GET', '/ujian')
}

export interface AnalisisItem {
  question_id: string; teks: string; n: number; benar: number
  tk: number; tk_label: string; daya_beda: number; db_label: string
  pengecoh: Record<string, number>
}

export function fetchAnalisis(ujianId: string) {
  return api<{ ujian_id: string; n_siswa: number; alpha: number | null; items: AnalisisItem[] }>('GET', `/ujian/${ujianId}/analisis`)
}

export function fetchSyncStatus() {
  return api<{ server_now: string; siswa: number; packages_active: number; packages_total: number; answers: number; results: number; last_snapshot_at: string | null }>('GET', '/sync/status')
}

export function postSnapshot() {
  return api<{ ok: boolean; file: string; bytes: number; packages: number; answers: number }>('POST', '/sync/snapshot')
}
export function fetchHealth() {
  return api<{ mem_mb: number; goroutines: number; users: number; siswa: number }>('GET', '/health')
}

export interface AuditEntry {
  actor: string; action: string; target: string; time: string
}

export function fetchAudit() {
  return api<{ entries: AuditEntry[] }>('GET', '/audit/recent')
}

export function announce(ujianId: string, message: string) {
  return api<{ ok: boolean }>('POST', `/ujian/${ujianId}/announce`, { message })
}

export function fetchAnnouncement(ujianId: string) {
  return api<{ id: string; message: string }>('GET', `/ujian/${ujianId}/announcement`)
}
