# CBT-BINAZ

CBT ujian siswa: Golang + React + PostgreSQL, satu `docker compose up`.

Lihat `PRD.md` (sumber kebenaran), `API.md`, `TASKS.md`, `db/SCHEMA.sql`.

## Run

```bash
docker compose up --build
# frontend: http://localhost/
# backend : http://localhost:8080/api/v1/healthz
```

## Struktur

- `backend/` Go (Gin) — API + parser Excel/Word + lockdown heartbeat + export
- `frontend/` React+Vite — halaman ujian terkunci
- `db/SCHEMA.sql` — skema PostgreSQL
- `storage/hasil/` — folder per NIS-Nama (lihat `storage/README.md`)
- `seb/` — config Safe Exam Browser untuk ujian resmi
- `templates/` — contoh format Excel siswa & Word soal

## Lockdown

- Latihan: soft-lock browser (fullscreen + focus detection).
- UTS/UAS: wajib SEB (`seb/README.md`), backend tolak non-SEB jika `require_seb=true`.
- Setelah submit/logout kunci dibuka.
