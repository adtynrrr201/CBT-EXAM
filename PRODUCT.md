# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Empat peran berimbang, dipakai harian saat masa ujian: admin (operasional + data siswa), guru (bank soal, jadwal ujian, koreksi), proktor (monitoring live + pelanggaran), siswa (mengerjakan ujian terkunci). Semua peran memakai dashboard web yang sama di perangkat sekolah (desktop) dan sesekali ponsel/tablet.

## Product Purpose

CBT-BINAZ menyelenggarakan ujian sekolah secara terkunci dan menilai otomatis: import siswa via CSV, bank soal dari Word, paket soal acak per siswa, lockdown fullscreen + heartbeat + batas focus-lost, nilai PG otomatis, hasil per folder siswa (ZIP per kelas). Sukses = ujian berjalan tanpa kecurangan lolos, nilai keluar cepat, data rapi.

## Positioning

Paket utuh ujian-terkunci-untuk-sekolah dalam satu deploy (frontend + backend Go + Postgres): bukan sekadar bank soal atau sekadar pengawas — rantai impor → acak → kunci → nilai → arsip folder per anak dalam satu sistem.

## Operating Context

Ritual ujian: admin impor siswa, guru unggah soal + buat jadwal + token, siswa login NIS mengerjakan dalam durasi, proktor memantau live dan memberi peringatan/perpanjangan/paksa-submit, guru merilis nilai, admin mengunduh ZIP. Lingkungan: lab komputer sekolah, koneksi fluktuatif (heartbeat 20 dtk, toleransi focus-lost 3 warn / 5 auto-submit).

## Capabilities and Constraints

Rute, endpoint API, dan data TIDAK boleh berubah dalam rombak visual (keputusan 2026-10-13). Auth JWT + peran (admin/guru/siswa/proktor) + ProtectedRoute tetap. Perilaku: timer dari server, autosave jawaban, heartbeat lockdown. Belum ada: parse .xlsx biner (CSV saja), GET /hasil list, dark mode.

## Brand Commitments

Hanya nama CBT-BINAZ (+ label v1.0). Tidak ada warna, logo, atau tipografi resmi yang mengikat. Dunia visual bebas diganti total.
Komitmen berdiri (2026-10-13): canon SaaS admin familier — bar kerapian Google Classroom + Siakad akademik Indonesia, dieksekusi penuh tanpa ironi.

## Evidence on Hand

Kode berjalan: frontend/src/pages (Dashboard, GuruDashboard, SiswaBeranda, Proktor, Hasil, Siswa, BankSoal, Ujian, ExecUjian, Login), backend/cmd/api/main.go, db/SCHEMA.sql. Akun demo: admin/admin123, guru/guru123, proktor/proktor123, siswa 12345/12346. Tidak ada testimoni, aset foto, atau logo — jangan fabrikasi.

## Product Principles

1. Ujian dulu: layar yang dipakai saat ujian live tidak boleh gagal paham dalam 3 detik.
2. Kejujuran status: angka live, timer, dan pelanggaran selalu dari server, tidak pernah ilustrasi.
3. Rapi administratif: setiap aksi berujung arsip (folder per anak, ZIP per kelas).
4. Seimbang antarperan: tak ada peran yang jadi warga kelas dua.
5. Tetap ringan: satu deploy, tanpa dependensi visual baru yang berat.
