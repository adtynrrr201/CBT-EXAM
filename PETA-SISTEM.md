# Peta Sistem CBT-BINAZ (untuk orang awam)

CBT-BINAZ = aplikasi ujian sekolah lewat komputer. Buka `http://localhost/login`, masuk sesuai peran, kerjakan tugasnya. Itu saja intinya.

## 1. Empat peran, empat pintu masuk

```
                    ┌──────────────┐
                    │    LOGIN     │
                    └──────┬───────┘
           ┌─────────┬─────┴─────┬──────────┐
           ▼         ▼           ▼          ▼
        ADMIN      GURU       PROKTOR     SISWA
     (kantor)  (ruang guru) (ruang ujian) (lab)
```

| Peran | Username / password | Tugasnya (3 langkah) |
|---|---|---|
| Admin | `admin` / `admin123` | 1. Upload data siswa (CSV) → 2. Lihat dashboard → 3. Unduh hasil |
| Guru | `guru` / `guru123` | 1. Upload soal (Word) → 2. Buat jadwal ujian + token → 3. Lihat nilai |
| Proktor | `proktor` / `proktor123` | 1. Buka Live Proktor → 2. Tegur yang pindah tab / tambah waktu → 3. Paksa submit bila perlu |
| Siswa | NIS, mis. `12345` / `12345` | 1. Buka beranda → 2. Klik Mulai, kerjakan sampai kirim → 3. Lihat nilai |

Password siswa = NIS-nya sendiri. Lupa NIS? Tanya admin.

## 2. Hidup satu ujian (dibaca kiri ke kanan)

```
Admin impor siswa ──► Guru unggah soal ──► Guru buat jadwal + token
                                                        │
Siswa login ──► kerjakan (timer jalan, jawaban tersimpan otomatis)
      │                              │
      │                     pindah tab 3× = teguran, 5× = dikirim otomatis
      │                              │         (proktor melihat semuanya live)
      ▼                              ▼
   Siswa klik Kirim ──► Nilai PG keluar otomatis ──► Guru/Admin rekap
```

## 3. Istilah sulit, versi mudah

- **Token** = kode masuk ujian (seperti password ruangan, mis. `ABC123`).
- **Paket soal acak** = urutan soal tiap anak dibedakan otomatis biar tidak mencontek.
- **Lockdown / fullscreen** = layar dikunci penuh; pindah tab = ketahuan.
- **Heartbeat** = komputer siswa "melapor saya masih di sini" tiap detik ke server.
- **Focus lost** = hitungan berapa kali siswa kabur dari layar ujian (3 = teguran, 5 = ujian dikirim paksa).
- **Autosave** = jawaban tersimpan sendiri tiap memilih; refresh tidak menghilangkan jawaban.
- **ZIP per kelas** = bungkusan berkas nilai satu kelas (belum aktif — lihat batasan).

## 4. Batasan jujur (biar tidak bingung saat memakai)

1. Layar `/ujian/demo` memakai 5 soal contoh (nilai dari server, kunci tak di browser).
   Ujian UUID asli (mis. bank demo `11111111-…`) memakai bank soal + paket riil end-to-end.
2. Tombol unduh ZIP di halaman Hasil belum bisa diklik — menunggu bagian export backend (TASKS Fase 1).
3. Angka di dashboard guru ("Soal di bank", dll.) masih angka contoh, bukan dari database.
4. Upload soal masih simulasi (baru preview contoh); upload siswa CSV sudah beneran tersambung ke database.
5. Ganti sumber data? Satu-satunya yang perlu diubah: isi `backend` + `SCHEMA.sql`. Tampilan tidak menyimpan data apa pun.

## 5. Kalau ada masalah

| Gejala | Artinya | Lakuin |
|---|---|---|
| Tidak bisa login | Username/password salah | Cek tabel di atas; NIS = password siswa |
| Tombol abu-abu tak bisa diklik | Fitur belum aktif | Baca keterangannya (title/note di layar) |
| Halaman kosong setelah login | Sesi habis | Logout lalu login ulang |
| Nilai tidak keluar | Ujian belum dikirim / backend mati | Klik Kirim dulu; cek `docker compose ps` |
