---
version: 1
slug: "frontend-src-pages-dashboard-tsx"
primary_target: "frontend/src/pages/Dashboard.tsx"
related_targets: ["frontend/src/components/Navbar.tsx","frontend/src/pages/GuruDashboard.tsx","frontend/src/pages/SiswaBeranda.tsx"]
---

# Surface brief — Admin shell + Dashboard (canon)

Scope: app shell (sidebar + topbar) dan Dashboard admin; pola menular ke Guru/Siswa/Proktor/Hasil/Siswa/BankSoal/Ujian/ExecUjian/Login.
Mode: Operate. Seed key: 8a86d06f. Comparators: Google Classroom + Siakad akademik.

## Direction contract

THESIS: Satu shell institusi yang membuat staf merasa memegang sistem resmi sekolah: navigasi kiri berkelompok, tabel formal berbingkai, status live yang jujur. Menolak kartu-statistik generik dan dasbor gelap-gamer.
OWN-WORLD: Kertas putih, bingkai slate-200, radius 8px, tanpa bayangan kecuali topbar; primer institusi blue-700 (#1D4ED8) untuk aksi/tautan/nav aktif; teks slate-900; data tabular; header tabel slate-50 uppercase 11px; dot status + hitungan live di sidebar.
STORY: Admin/proktor/guru/siswa mengenali perannya dari sidebar, membaca keadaan dalam 3 detik, bertindak lewat satu tombol primer per kartu.
FIRST VIEWPORT: Sidebar 232px (Menu, Data, Ujian, Pengawasan) + topbar judul + chip user; konten: baris sapaan + 2 aksi, strip status ujian (dot + progress), strip metrik berdivider, grid 2 kolom (tabel pelanggaran + aksi cepat).
FORM: Canon SaaS admin familier (Classroom+Siakad), dieksekusi penuh.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
