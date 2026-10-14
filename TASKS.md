# TASKS — CBT-BINAZ Backlog

Sumber: PRD.md v1.0.

## Fase 0 — Setup [x]
- [x] PRD.md, docker-compose.yml, SCHEMA.sql, API.md
- [x] `backend/go.mod + main.go healthz` scaffold (stub, belum `go run` — no compiler di env)
- [x] `frontend` vite scaffold (tsc pass per @designer, belum `npm run build` di env)
- [x] Template Excel + Word contoh (csv + md)

## Fase 1 — Inti [~ stub/mock, belum DB]
- [x] Import Excel: Validate NIS/duplikat + route preview stub (`parser/excel.go`, `POST /siswa/import/preview`)
- [x] Import Word PG: ParseLine kunci `*` + bobot + route preview stub (`parser/docx.go`, `POST /soal/import/preview`)
- [x] CRUD ujian stub + generate exam_packages acak per siswa (`ujian/store.go`, `POST /ujian`)
- [x] Exec ujian mock: timer, autosave indicator, submit (`ExecUjian.tsx`, `POST /ujian/:id/answer|finish` stub)
- [x] Nilai PG otomatis stub + folder/ZIP builder (`hasil/nilai.go`, `export/folder.go|zip.go`, `GET /hasil/:id`)
- [ ] Essay: parse `[Uraian]` + textarea autosave + koreksi guru (skor+feedback) + PDF regenerasi (lihat PRD FR-SOAL-02b)

## Fase 2 — Lockdown [~ stub/mock]
- [x] useLockdown: fullscreen wajib, blur/visibility → focus_lost, heartbeat 20s (`useLockdown.ts`)
- [x] Backend policy: warn 3x, auto-submit 5x + heartbeat route (`lockdown/policy.go`, `POST /ujian/:id/heartbeat`)
- [x] Live proktor mock + extend/force-submit stub (`Proktor.tsx`, `GET /ujian/:id/live`)
- [x] SEB middleware stub + config template (`middleware/seb.go`, `seb/`)

## Fase 3 — Hardening [ ]
- [ ] k6 300 konkuren autosave p95 <800ms
- [ ] Backup pg dump harian, rate-limit login, sanitize HTML, bcrypt
- [ ] UAT 1 kelas: 20 soal + 20 siswa

## Acceptance (dari PRD Bab 14)
- [ ] Excel 300 siswa <30s, 0 duplikat lolos
- [ ] Word 100 PG 100% generate
- [ ] Login saat ujian → auto-lock, tak bisa ke dashboard
- [ ] Fullscreen keluar 3x warn, 5x auto-submit + log <3s di proktor
- [ ] Refresh → jawaban+timer utuh
- [ ] ZIP kelas = N folder rapi, 0 bercecer
- [ ] Submit/logout → kunci dibuka
