# PRD — CBT Ujian Siswa Berbasis Web
### Stack: Backend Golang + Frontend React + PostgreSQL (Terintegrasi Satu Sistem + Lockdown Browser)

| Field | Isi |
|---|---|
| **Nama Proyek** | CBT-BINAZ — Computer Based Test Ujian Siswa |
| **Versi Dokumen** | v1.0 — Draft untuk Review |
| **Tanggal** | 2026-10-06 |
| **Status** | Draft — Belum disetujui |
| **Penulis** | Tim Produk / AI Assistant |
| **Bahasa** | Indonesia |
| **Target** | Admin, Guru, Siswa, Proktor |

---

## 1. Ringkasan Eksekutif

Membangun sistem **CBT (Computer Based Test) berbasis web dalam satu sistem terintegrasi** untuk ujian siswa dengan:

1. **Backend Golang, Frontend React, Database PostgreSQL** dalam satu repo + satu deployment (Docker Compose).
2. **Input soal hanya via upload file Word (.docx)** → otomatis ter-generate menjadi bank soal.
3. **Tambah siswa hanya via upload file Excel (.xlsx)** → otomatis ter-generate akun.
4. **Setiap hasil/jawaban siswa ditampung dalam satu folder per anak** (terpisah per nama, tidak bercecer).
5. **Lockdown / kunci website:** siswa yang sudah login ujian **terkunci di halaman ujian, tidak bisa membuka website lain**, dan baru bisa akses bebas setelah **logout / submit / waktu habis**.

> **Catatan kritis (jujur secara teknis):** Web murni (React di Chrome biasa) **tidak bisa 100% memblokir OS/browser** untuk membuka situs lain. PRD ini merancang lockdown berlapis: **enforcement frontend + enforcement backend + opsi Safe Exam Browser (SEB) / Extension Kiosk** untuk lockdown keras. MVP bisa jalan tanpa SEB (soft-lock), production ujian resmi wajib SEB/Kiosk.

---

## 2. Tujuan & Latar Belakang

### Masalah saat ini
- Soal dibuat manual satu-per-satu di web → lambat, rawan salah ketik.
- Data siswa diinput manual → lama, duplikat NIS.
- Hasil ujian bercecer (download satu-satu, nama file acak).
- Siswa mudah mencontek / buka Google / YouTube / ChatGPT saat ujian di browser biasa.

### Tujuan
1. Guru cukup upload **1 file Word** → jadi puluhan/ratusan soal otomatis.
2. Admin cukup upload **1 file Excel** → ratusan akun siswa otomatis jadi.
3. Semua hasil ujian **rapi per folder per nama anak**.
4. Saat ujian, siswa **terkunci** dan semua pelanggaran tercatat.
5. Satu sistem deploy mudah (satu `docker compose up`), tidak ada layanan terpisah yang rumit.

### Definisi Sukses (3 bulan pertama)
- Waktu input 100 soal: dari ~4 jam manual → < 15 menit (upload + koreksi).
- Waktu input 300 siswa: dari ~1 hari → < 10 menit.
- 0 file hasil tercecer (100% hasil masuk folder per siswa).
- >95% sesi ujian tanpa pelanggaran bypass yang lolos tanpa log.
- Ujian 300 siswa konkuren tanpa down.

---

## 3. Ruang Lingkup

### In Scope (MVP v1.0)
- [x] Monorepo: `/backend` (Golang), `/frontend` (React), `/db` (migrasi Postgres), `docker-compose.yml`.
- [x] Auth 3 peran: Admin, Guru, Siswa (+ Proktor opsional sebagai Admin view-only).
- [x] Import Siswa via Excel.
- [x] Import Soal via Word (Pilihan Ganda, PG Kompleks opsional, Isian Singkat, Uraian).
- [x] Manajemen Ujian: jadwal, durasi, kelas, paket soal acak, token ujian.
- [x] Pelaksanaan ujian dengan timer, autosave, submit.
- [x] **Lockdown Mode:** fullscreen wajib, blok navigasi/tab baru, deteksi pindah fokus, heartbeat backend, auto-warning + auto-submit.
- [x] Hasil per siswa + export folder ZIP per kelas / per anak.
- [x] Dashboard nilai, monitoring live (siapa online, siapa melanggar).

### Out of Scope (v2.0+)
- [ ] Essay auto-grading AI.
- [ ] Video proctoring AI / face recognition.
- [ ] Android/iOS native app kiosk (cukup web + SEB dulu).
- [ ] Integrasi Dapodik / EMIS otomatis.
- [ ] Bank soal gambar/audio kompleks (MVP: gambar di dalam Word didukung terbatas).

---

## 4. Stakeholder & Peran (RBAC)

| Peran | Akses | Deskripsi |
|---|---|---|
| **Admin** | Penuh | Kelola user, kelas, mapel, ujian, lihat semua hasil, export folder, atur lockdown policy, reset sesi. |
| **Guru** | Terbatas | Upload Word soal, verifikasi hasil parsing, buat/edit ujian mapelnya, koreksi uraian, lihat nilai kelasnya. |
| **Siswa** | Ujian saja | Login (NIS + password), lihat jadwal ujian, kerjakan ujian dalam Lockdown Mode, lihat nilai sendiri setelah rilis. |
| **Proktor** | Monitor | Lihat live status, beri perpanjangan waktu, unlock paksa, log pelanggaran. Bisa digabung ke Admin di MVP. |

Aturan:
- Siswa hanya bisa login di **1 device aktif**. Login kedua menendang sesi pertama (atau ditolak, configurable).
- Akun siswa default password = NIS atau dari Excel, wajib ganti saat pertama login (configurable).

---

## 5. Asumsi & Ketergantungan

1. Sekolah punya server/laptop lab (min 4 vCPU, 8GB RAM) atau VPS untuk 300 konkuren.
2. Browser standar: Chrome/Edge versi terbaru. Untuk lockdown keras butuh **Safe Exam Browser (SEB)** terinstall di lab.
3. Format Word & Excel mengikuti **template resmi** yang disediakan sistem (jika format beda, parsing ditolak dengan pesan jelas).
4. Jaringan lokal stabil; timer ujian mengacu ke **waktu server**, bukan waktu client.
5. Satu sistem = satu `docker-compose`: `frontend (Nginx+React build) + backend (Go) + postgres + storage volume`.

---

## 6. Persyaratan Fungsional

### 6.1 Autentikasi & Sesi Terkunci

**FR-AUTH-01 — Login multi-peran**
- Login dengan `username/NIS + password` → JWT access (15 mnt) + refresh (httpOnly cookie, 12 jam).
- Response berisi `role`, `kelas`, `sesi_ujian_aktif` jika ada.

**FR-AUTH-02 — Login otomatis masuk Lockdown jika ada ujian aktif**
- Jika siswa login dan ada ujian dengan status `BERJALAN` untuk kelasnya + waktu sekarang dalam window → frontend langsung redirect ke `/ujian/:id` dan masuk **Lockdown Mode**.
- Tidak bisa ke `/dashboard`, `/jadwal`, atau URL lain kecuali submit/logout.

**FR-AUTH-03 — Single active session**
- Tabel `sessions` menyimpan `device_id`, `ip`, `last_heartbeat`.
- Kebijakan default: 1 sesi. Login baru → sesi lama diinvalidasi + log `SESSION_TAKEOVER`.

**FR-AUTH-04 — Logout membuka kunci**
- Setelah `submit final / waktu habis / logout`, flag `is_locked = false`, hapus exam-token, kembalikan navigasi normal.
- Endpoint `POST /api/v1/exam/:id/finish` wajib dipanggil (dengan retry jika offline sesaat).

---

### 6.2 Manajemen Siswa via Excel Saja

**FR-SISWA-01 — Upload Excel massal**
- Admin ke `Data Siswa → Import Excel` → upload `.xlsx` (maks 5MB, maks 2000 baris).
- Template kolom wajib:
  ```
  NIS | Nama Lengkap | Kelas | Jenis Kelamin (L/P) | Password (opsional) | Tahun Ajaran
  ```
- Contoh baris: `12345 | Ahmad Bin Azis | XII-IPA-1 | L | (kosong=auto NIS) | 2025/2026`

**FR-SISWA-02 — Validasi & Preview sebelum simpan**
- Backend parse dengan `excelize`, validasi:
  - NIS unik, 4–20 digit, tidak kosong.
  - Nama tidak kosong, Kelas harus ada di master `kelas`.
  - Baris duplikat dalam file ditandai merah.
- Tampilkan preview: `X valid, Y gagal + alasan per baris` → user klik **Konfirmasi Import** baru insert (transactional).
- Import bersifat **upsert by NIS** (opsi: Lewati / Update / Tolak duplikat — pilih saat upload).

**FR-SISWA-03 — Auto-generate akun**
- Password kosong → `password_hash = bcrypt(NIS)` atau random 8 char yang bisa di-export.
- Setelah sukses: tampilkan ringkasan + tombol **Download Akun (xlsx)** berisi NIS + password plaintext sekali saja + **Download QR login** (opsional v1.1).

**Kriteria terima:** Upload 500 siswa < 30 detik, 0 duplikat NIS lolos.

---

### 6.3 Bank Soal via Word Saja (Auto-Generate)

**Prinsip: Guru TIDAK input soal manual di MVP.** Semua via Word.

**FR-SOAL-01 — Upload Word**
- Guru ke `Bank Soal → Upload Word` → `.docx` maks 10MB.
- Metadata form sebelum upload: `Mapel, Kelas, Tipe (PG/Isian/Uraian/Campuran), Kesulitan default, Pembuat`.
- Sistem menyimpan file asli di `storage/bank-soal/raw/` untuk audit.

**FR-SOAL-02 — Format Word yang didukung (Template Resmi)**

Template harus didokumentasikan + file contoh `Template_Soal_CBT.docx` disediakan untuk download.

Format MVP yang di-parse:

```
1. Ibu kota Indonesia adalah ....
   A. Bandung
   B. Jakarta *
   C. Surabaya
   D. Medan
   [Bobot: 10] [Kesulitan: mudah]

2. [GAMBAR] Perhatikan gambar di atas, organ X berfungsi ....
   A. Memompa darah *
   B. Menyaring udara
   ...
```

Aturan parsing:
- Nomor soal: `1.` / `1)` di awal paragraf.
- Opsi: `A.` / `A)` — baris dengan akhiran `*` = kunci jawaban. Untuk PG Kompleks bisa >1 `*`.
- Tag opsional dalam `[Bobot: N]`, `[Kesulitan: mudah|sedang|sukar]`, `[Kategori: ...]`, `[Uraian]`, `[Isian: jawaban|alternatif]`.
- Gambar inline dalam Word diekstrak ke `storage/bank-soal/img/` dan di-link ke soal.
- Bold/italic/underline, tabel sederhana, dan rumus (sebagai gambar/unicode) dipertahankan semampunya → disimpan sebagai HTML sanitized.

**FR-SOAL-02b — Soal Essay/Uraian (cara membuat)**
- Guru TIDAK input manual: cukup tulis essay di file Word yang sama, beri tag `[Uraian]` di awal atau akhir soal. Contoh:
  ```
  3. [Uraian] Jelaskan 3 contoh penerapan sila ke-3 di sekolah! [Bobot: 20] [Rubrik: sebutkan contoh=10, penjelasan=10]
  ```
- Tag essay yang didukung: `[Uraian]` (wajib), `[Bobot: N]`, `[Rubrik: teks bebas]` (panduan koreksi guru), `[MaxKata: N]` (opsional, batas panjang jawaban).
- Aturan parse: soal bertag `[Uraian]` → `tipe='uraian'`, **tidak butuh opsi/kunci** (wajib dilewati validasi kunci), teks disimpan sebagai `teks_html`, rubrik masuk kolom `gambar`/meta JSON soal.
- Sisi siswa: essay tampil sebagai **textarea** (bukan radio), autosave tiap 1 detik + tombol Simpan, copy-paste DALAM editor tetap boleh (khusus essay, beda dengan PG yang bisa diblokir — lihat FR-EXEC-01).
- Penilaian: essay TIDAK dinilai otomatis → status `NEED_GRADING` → guru koreksi via halaman Hasil (skor + feedback) → nilai total = PG otomatis + essay manual → PDF diregenerasi → folder per anak ikut update.

**FR-SOAL-03 — Pipeline parsing (Backend Golang)**
1. Upload → `jobs` status `QUEUED`.
2. Worker parse: unzip docx → `document.xml` → ekstrak paragraf + relasi gambar (lib: `unioffice` / `nguyenthenguyen/docx` + `mammoth`-style converter, fallback ke LibreOffice headless jika perlu).
3. Normalisasi → kandidat soal `{nomor, teks_html, tipe, opsi[], kunci[], bobot, gambar[]}`.
4. Validasi: soal PG tanpa kunci / opsi <2 / teks kosong → status `NEED_FIX` dengan pesan baris. Soal `[Uraian]` dikecualikan dari syarat kunci/opsi (cukup teks + bobot).
5. Tampilkan **Preview Hasil Generate**: daftar soal + highlight error → Guru bisa edit inline / hapus / ubah kunci sebelum **Simpan ke Bank Soal**.
6. Simpan transactional ke `questions` + `question_options`.

**FR-SOAL-04 — Batasan & Error handling**
- `.doc` lama ditolak (minta Save As `.docx`).
- Jika >20% soal gagal parse → tolak keseluruhan + sarankan perbaiki template.
- Semua hasil parsing bisa diunduh ulang sebagai Excel rekap untuk koreksi.

**Kriteria terima:** 100 soal PG dari template valid → 100% ter-generate tanpa input manual; file template contoh lolos 100%.

---

### 6.4 Manajemen Ujian

**FR-UJIAN-01 — CRUD Ujian (Admin/Guru)**
- Field: `Judul, Mapel, Kelas (multi), Tanggal mulai-selesai, Durasi (menit), Jumlah soal, Acak soal (Y/T), Acak opsi (Y/T), Nilai minimum (KKM), Token ujian, Lockdown policy, Status (DRAFT→PUBLISHED→BERJALAN→SELESAI→DINILAI)`.
- Pilih soal dari bank: `semua / by kategori / random N dari M`.

**FR-UJIAN-02 — Paket soal per siswa**
- Saat ujian dimulai, generate `exam_packages`: urutan soal + urutan opsi diacak per siswa (seed by `siswa_id`), disimpan agar refresh tidak mengubah urutan.
- Navigasi soal: grid nomor, tandai ragu-ragu, lompat soal.

**FR-UJIAN-03 — Token & Jadwal**
- Token ujian 6 karakter (opsional per ujian). Siswa masukkan token sebelum mulai.
- Validasi waktu di server: belum mulai / sudah selesai → tolak dengan pesan + sisa waktu.

---

### 6.5 Pelaksanaan Ujian (Sisi Siswa + Lockdown)

**FR-EXEC-01 — Halaman ujian terkunci**
- Setelah klik **Mulai**, panggil `POST /exam/:id/start` → terima `exam_token` (short-lived JWT 5 mnt, di-refresh via heartbeat) → masuk Lockdown Mode:
  - Fullscreen otomatis (wajib konfirmasi browser), blok klik kanan, blok Ctrl+C/V/X?, blok DevTools shortcut umum, blok navigasi back.
  - Catatan: blok copy-paste untuk ujian PG dapat diaktifkan per ujian; untuk uraian copy-paste dalam editor tetap boleh (configurable).

**FR-EXEC-02 — Soft-lock (tanpa SEB, default MVP)**
Frontend:
- `visibilitychange` + `blur` → hitung `FOCUS_LOST`.
- Deteksi `fullscreenchange` exit → warning overlay “Kembali ke fullscreen dalam X detik”.
- Blokir `contextmenu`, `copy` (jika policy), cegah buka tab baru via `beforeunload`.
- Heartbeat tiap 20 detik: `POST /exam/:id/heartbeat {exam_token, focus_lost_count, is_fullscreen}`.
Backend:
- Jika `focus_lost > batas (mis. 3x)` → status `FLAGGED`, kirim warning. Jika > batas keras (mis. 5x) atau heartbeat hilang >90 detik → `AUTO_SUBMIT` + log `VIOLATION`.
- Semua event masuk `exam_violations`.

**FR-EXEC-03 — Hard-lock (produksi, dengan SEB / Extension)**
- **Opsi utama: Safe Exam Browser.** Backend generate `config.seb` per ujian (URL + exam token + whitelist). Siswa wajib buka via SEB; User-Agent + SEB header key divalidasi di backend. Non-SEB ditolak jika policy `require_seb = true`.
- **Opsi alternatif lab Chromebook:** Managed Chrome Kiosk + extension pengunci (whitelist domain CBT saja).
- Domain whitelist: hanya `cbt.sekolah.sch.id` (+ CDN yang dibutuhkan). Selain itu diblokir di level SEB/extension/firewall lab.
- Setelah `finish/logout`, SEB ditutup → browsing normal kembali. Ini memenuhi: “bisa akses website lain ketika sudah logout/selesai”.

**FR-EXEC-04 — Ketahanan ujian**
- Autosave jawaban tiap soal (debounce 1 detik) + tombol **Simpan Sementara**.
- Refresh / mati lampu → login lagi → lanjut dari jawaban terakhir + timer lanjut (server time).
- Submit final butuh konfirmasi 2 langkah + rekap belum dijawab.
- Timer dari server (`server_now + ends_at`), bukan dari JS client.

**Kriteria terima:** Simulasi 50 siswa refresh bersamaan → 0 jawaban hilang; keluar fullscreen 3x → warning + log muncul di dashboard proktor < 3 detik.

---

### 6.6 Hasil Siswa Dijadikan Satu Folder per Anak

**Interpretasi yang dibangun:** Setiap siswa punya **satu folder hasil** berisi semua artefak ujiannya (jawaban, nilai, log pelanggaran, PDF hasil). Tidak ada file bercecer di root storage.

**FR-HASIL-01 — Struktur folder (di volume storage + bisa di-download ZIP)**
```
/storage/hasil/
  /{tahun_ajaran}/
    /{ujian_id}-{slug_judul}/
      /{kelas}/
        /{NIS}-{slug_nama}/
          jawaban.json
          hasil.pdf
          log-pelanggaran.txt
          lampiran-uraian/ (jika ada upload/gambar)
      rekap-kelas.xlsx
      rekap-kelas.pdf
```

**FR-HASIL-02 — Auto-generate saat submit**
- Saat `finish`, backend: nilai PG otomatis → simpan `exam_results` → generate `jawaban.json` + `hasil.pdf` (via `gofpdf`/`weasyprint` worker) → simpan path ke `result_folder`.
- Uraian status `NEED_GRADING` sampai guru koreksi, lalu PDF diregenerasi.

**FR-HASIL-03 — Download**
- Admin/Guru: download **per anak (ZIP 1 folder)**, **per kelas (ZIP berisi N folder + rekap)**, **per ujian (ZIP penuh)**.
- Nama ZIP rapi: `HASIL-{Ujian}-{Kelas}-{Tanggal}.zip`, di dalam tetap per folder nama anak.
- Siswa: hanya bisa download `hasil.pdf` miliknya setelah nilai dirilis.

**Kriteria terima:** 1 klik download kelas → ZIP berisi N folder sesuai jumlah peserta, 0 file di luar folder.

---

### 6.7 Dashboard & Monitoring

- **Admin:** total siswa, guru, soal, ujian aktif, grafik nilai per kelas, daftar pelanggaran terbaru.
- **Proktor Live:** tabel peserta (online/offline/selesai), sisa waktu, jumlah focus-lost, tombol `Peringatkan`, `Tambah Waktu +10 mnt`, `Paksa Submit`, `Reset Sesi`.
- **Guru:** koreksi uraian (daftar jawaban belum dinilai + skor + feedback), rilis nilai.
- **Siswa:** jadwal ujian, riwayat nilai, unduh PDF.

---

## 7. Arsitektur Sistem (Satu Sistem Terintegrasi)

### 7.1 Monorepo + Docker Compose

```
CBT-BINAZ/
  PRD.md
  docker-compose.yml
  backend/          # Go 1.22+, Gin/Fiber, GORM atau sqlc
    cmd/api/
    internal/
      handler/ service/ repo/ middleware/
      parser/       # docx parser, excel parser
      lockdown/     # heartbeat, violation rules
      export/       # pdf, zip, xlsx
    migrations/
  frontend/         # React 18 + Vite + TS + Tailwind + Router
    src/pages/ (Login, Dashboard, BankSoal, Ujian, ExecUjian, Hasil)
  db/               # init.sql (opsional, migrasi utama di backend)
  storage/          # volume: raw word, hasil per siswa
  seb/              # template config.seb
```

`docker-compose.yml` services:
- `postgres:15-alpine` (volume `pgdata`).
- `backend` (Go, port 8080, env `DATABASE_URL`, `JWT_SECRET`, `STORAGE_PATH=/storage`).
- `frontend` (build React → serve via Nginx, port 80, proxy `/api` → backend).
- `libreoffice` worker (opsional, untuk konversi docx sulit) — bisa digabung ke backend image agar tetap “satu sistem”.

### 7.2 Alur Umum

```
[Siswa/Admin/Guru - React] --REST JSON--> [Golang API :8080] --SQL--> [PostgreSQL]
        | heartbeat 20s                        | write files
        +-- download ZIP/PDF <-- file serve ---+--> /storage/hasil/{...}
[SEB/Kiosk] --User-Agent+Key--> [Golang middleware require_seb]
```

Auth: JWT access + refresh httpOnly. Exam session: exam_token terpisah dari auth token.

---

## 8. Skema Database (PostgreSQL — Ringkas)

```sql
-- master
users(id UUID PK, username TEXT UNIQUE, password_hash TEXT, role TEXT, nama TEXT, created_at);
kelas(id UUID PK, nama TEXT UNIQUE, tahun_ajaran TEXT);
siswa(id UUID PK, user_id FK, nis TEXT UNIQUE, nama TEXT, kelas_id FK, jk CHAR(1));

-- bank soal
bank_uploads(id UUID PK, file_path TEXT, mapel TEXT, status TEXT, total_soal INT, gagal INT, by_user FK, created_at);
questions(id UUID PK, bank_upload_id FK, mapel TEXT, kelas TEXT, tipe TEXT, teks_html TEXT, bobot INT, kesulitan TEXT, gambar JSONB);
question_options(id UUID PK, question_id FK, label CHAR(1), teks_html TEXT, is_kunci BOOL, urutan INT);

-- ujian
ujian(id UUID PK, judul TEXT, mapel TEXT, durasi_menit INT, mulai_at TIMESTAMPTZ, selesai_at TIMESTAMPTZ,
      jumlah_soal INT, acak_soal BOOL, acak_opsi BOOL, token TEXT, require_seb BOOL, max_focus_lost INT, status TEXT);
ujian_kelas(ujian_id FK, kelas_id FK);
exam_packages(id UUID PK, ujian_id FK, siswa_id FK, urutan_soal JSONB, seed INT, started_at, ends_at, status TEXT);
exam_answers(exam_package_id FK, question_id FK, opsi_dipilih CHAR(1)[], isian_text TEXT, skor NUMERIC, updated_at, PRIMARY KEY(package,question));
exam_results(id UUID PK, exam_package_id UNIQUE FK, nilai NUMERIC, benar INT, salah INT, kosong INT, folder_path TEXT, pdf_path TEXT, released BOOL);
exam_violations(id UUID PK, exam_package_id FK, tipe TEXT, detail JSONB, created_at);
sessions(id UUID PK, user_id FK, device_id TEXT, ip TEXT, last_heartbeat TIMESTAMPTZ, is_locked BOOL);
import_logs(id UUID PK, tipe TEXT, file_name TEXT, sukses INT, gagal INT, detail JSONB, by_user FK, created_at);
```

Index penting: `siswa(nis)`, `questions(mapel, kelas)`, `exam_answers(package)`, `violations(package, created_at)`, `ujian(status, mulai_at)`.

---

## 9. Desain API (REST — v1)

Base: `/api/v1` — Auth: `Authorization: Bearer <jwt>` kecuali login/import via multipart.

```
POST /auth/login {username,password,device_id} -> {access_token, role, must_change_password?, ujian_aktif?}
POST /auth/refresh (cookie) -> {access_token}
POST /auth/logout

POST /siswa/import (multipart xlsx, mode=skip|update) -> {job_id}
GET  /siswa/import/:job_id/preview -> {valid[], invalid[]}
POST /siswa/import/:job_id/confirm
GET  /siswa?kelas=&q=&page=
GET  /siswa/template.xlsx  (download template)

POST /soal/import (multipart docx + meta) -> {job_id}
GET  /soal/import/:job_id/preview -> {soal[], error[]}
PATCH /soal/import/:job_id/soal/:idx (edit inline sebelum simpan)
POST /soal/import/:job_id/confirm -> {bank_upload_id, total}
GET  /soal?mapel=&kelas=&q=

CRUD /ujian, POST /ujian/:id/publish, POST /ujian/:id/start, POST /ujian/:id/heartbeat,
     POST /ujian/:id/answer {question_id, jawaban}, POST /ujian/:id/finish,
     GET  /ujian/:id/live (proktor), POST /ujian/:id/extend, POST /ujian/:id/force-submit

GET /hasil?ujian=&kelas= -> list
GET /hasil/:result_id/download (1 folder ZIP)
GET /hasil/ujian/:id/kelas/:kelas_id/download (ZIP kelas)
GET /hasil/ujian/:id/download-all (ZIP penuh)
POST /hasil/:id/koreksi {skor_uraian[], feedback} (guru)
POST /hasil/:id/release
```

Semua response error format: `{error:{code,message,details}}`. Upload dibatasi tipe MIME + ukuran + scan dasar.

---

## 10. Persyaratan Non-Fungsional

| Aspek | Target |
|---|---|
| **Konkuren** | 300 siswa submit/autosave bersamaan, p95 < 800ms. |
| **Ketersediaan** | Single-node 99% saat ujian; backup pg dump harian + sebelum ujian besar. |
| **Keamanan** | bcrypt cost 12, JWT secret via env, rate-limit login 10/mnt/IP, audit log admin, file upload whitelist ekstensi, HTML soal di-sanitize (bluemonday). |
| **Data** | Waktu server NTP, semua timestamp TIMESTAMPTZ, soft-delete untuk soal/siswa. |
| **Storage** | Kuota awal 20GB; cleanup file raw >1 tahun (arsipkan). |
| **Browser** | Chrome/Edge 110+, resolusi min 1024×768, JS wajib. |
| **Aksesibilitas** | Kontras cukup, navigasi keyboard untuk soal, font min 14px. |

---

## 11. UX/UI (React) — Daftar Halaman

1. **Login** — NIS/username + password + info ujian aktif. Grounded copy, tidak ada jargon.
2. **Dashboard** per peran (kartu statistik + tabel).
3. **Data Siswa** — tabel + tombol Import Excel + preview valid/gagal + download template.
4. **Bank Soal** — tabel + Upload Word + preview parsing + edit inline + filter mapel.
5. **Ujian (Admin/Guru)** — wizard 3 langkah: Info → Pilih Soal → Jadwal & Lockdown policy.
6. **Exec Ujian (Siswa)** — fullscreen, timer besar, grid nomor, tombol Ragu, autosave indicator, warning overlay pelanggaran.
7. **Live Proktor** — tabel realtime (polling 5s / websocket v1.1) + aksi.
8. **Hasil** — tabel nilai + tombol download folder + koreksi uraian + rilis.

Design token: Tailwind, primary indigo/blue, danger red untuk lockdown warning, tidak ada animasi berlebihan saat ujian (hemat CPU).

---

## 12. Lockdown Policy — Konfigurasi per Ujian

```json
{
  "require_seb": false,
  "require_fullscreen": true,
  "max_focus_lost_warn": 3,
  "max_focus_lost_autosubmit": 5,
  "block_copy_paste_pg": true,
  "allow_back_navigation": false,
  "heartbeat_interval_sec": 20,
  "heartbeat_timeout_sec": 90,
  "single_device": true
}
```

Rekomendasi:
- **Tryout/latihan:** `require_seb=false`, soft-lock saja.
- **UTS/UAS resmi:** `require_seb=true`, lab dikunci via SEB + firewall whitelist.

---

## 13. MVP & Fase Pengembangan

**Fase 0 — Setup (1 minggu):** monorepo, docker-compose, auth + RBAC, migrasi DB, template Excel & Word contoh.

**Fase 1 — Inti (2–3 minggu):** import Excel (preview+confirm), import Word PG (preview+edit), CRUD ujian, exec ujian + timer + autosave, penilaian PG otomatis, folder per siswa + ZIP.

**Fase 2 — Lockdown (1–2 minggu):** fullscreen+focus detection, heartbeat, violation log, live proktor, force-submit/extend, SEB config generator + middleware.

**Fase 3 — Hardening (1 minggu):** load test 300 user (k6), backup/restore, audit log, rate-limit, PDF polish, UAT 1 kelas.

**Fase 4 — Go-Live:** panduan lab (install SEB, whitelist domain), simulasi 1 angkatan, SOP proktor.

Estimasi kasar: **5–7 minggu** 1 BE + 1 FE + 1 QA/proktor (paruh waktu).

---

## 14. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Admin upload Excel 300 siswa → semua akun login dengan NIS, preview error jelas.
- [ ] Guru upload Word 100 PG template → 100 soal ter-generate, kunci benar, gambar ikut.
- [ ] Siswa login saat ujian berjalan → otomatis masuk halaman terkunci, tidak bisa akses dashboard.
- [ ] Siswa keluar fullscreen / pindah tab 3x → warning; 5x → auto-submit + log di proktor.
- [ ] Refresh di tengah ujian → jawaban & timer tidak hilang.
- [ ] Submit → folder `/storage/hasil/.../{NIS}-{Nama}/` berisi `jawaban.json + hasil.pdf`, download ZIP per kelas rapi.
- [ ] Setelah submit/logout → navigasi normal kembali, bisa buka situs lain (SEB tertutup / fullscreen keluar).
- [ ] 300 konkuren autosave p95 < 800ms, 0 data loss.
- [ ] Non-SEB ditolak saat `require_seb=true` dengan pesan jelas.

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Web murni tidak bisa blokir 100% situs lain | Siswa contek via HP/tab lain | Wajib SEB untuk ujian resmi + pengawas ruang + log pelanggaran + acak soal/opsi. |
| Format Word guru berantakan | Parsing gagal massal | Template resmi + validasi + preview + pesan baris error + video panduan 3 menit. |
| NIS duplikat / kelas salah di Excel | Akun kacau | Preview + mode upsert + tolak duplikat + template download. |
| Server down saat ujian | Ujian gagal | UPS + backup, timer server-side, autosave, SOP lanjutkan sesi, dump sebelum ujian. |
| Jam client tidak akurat | Timer curang | Selalu hitung sisa waktu dari `server_now`. |
| File gambar besar di Word | Storage bengkak | Kompres otomatis (max 800px, 300KB), tolak file >10MB. |

---

## 16. Pertanyaan Terbuka (Butuh Keputusan Sekolah)

1. Lockdown resmi pakai **SEB** (install di tiap PC lab) atau cukup **soft-lock browser**? (Rekomendasi: SEB untuk UAS.)
2. Password awal siswa = NIS atau random? Apakah wajib ganti saat pertama login?
3. Tipe soal selain PG (isian, uraian, menjodohkan) — mana yang wajib di MVP?
4. KKM & pembobotan: apakah semua soal bobot sama atau per soal?
5. Apakah HP boleh untuk ujian atau hanya PC lab? (Berpengaruh ke strategi kiosk.)
6. Retensi file: hasil disimpan berapa tahun? Siapa boleh hapus?
7. Domain production: `cbt.sekolah.sch.id`? Siapa sediakan SSL & firewall whitelist?

---

## 17. Lampiran: Contoh Template

### Template Excel Siswa (header)
`NIS | Nama Lengkap | Kelas | L/P | Password (opsional) | Tahun Ajaran`

### Template Word Soal (cuplikan)
```
1. Pancasila sila pertama berbunyi ....
   A. Ketuhanan Yang Maha Esa *
   B. Kemanusiaan yang adil dan beradab
   C. Persatuan Indonesia
   D. Keadilan sosial bagi seluruh rakyat Indonesia
   [Bobot: 10] [Kesulitan: mudah]

2. [Uraian] Jelaskan 3 contoh penerapan sila ke-3 di sekolah! [Bobot: 20]
```

### Contoh struktur ZIP per kelas
```
HASIL-UAS-IPA-XII-IPA-1-2026-05-20.zip
  XII-IPA-1/
    12345-ahmad-bin-azis/jawaban.json, hasil.pdf, log-pelanggaran.txt
    12346-siti-aminah/jawaban.json, hasil.pdf
  rekap-kelas.xlsx
```

---

## 18. Langkah Selanjutnya

1. Setujui Bab 7 (strategi lockdown) & Bab 16 (7 pertanyaan).
2. Sediakan contoh nyata: 1 file Word 20 soal + 1 file Excel 20 siswa untuk UAT parsing.
3. Kickoff Fase 0: inisialisasi repo + docker-compose + template.
4. UAT parsing → UAT lockdown 1 lab → simulasi angkatan.

> Dokumen ini adalah PRD v1.0. Setelah disetujui, turunkan menjadi `TASKS.md` (backlog sprint) + `API.md` + `SCHEMA.sql`.
