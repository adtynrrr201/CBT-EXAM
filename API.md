# API v1 — CBT-BINAZ

Base: `/api/v1`. Auth: `Authorization: Bearer <jwt>` kecuali login.

## Auth
- `POST /auth/login {username,password,device_id} -> {access_token, role, ujian_aktif?}`
- `POST /auth/refresh` (cookie) -> `{access_token}`
- `POST /auth/logout`

## Siswa (Excel)
- `GET /siswa/template.xlsx` — download template
- `POST /siswa/import` multipart `file,mode=skip|update` -> `{job_id}`
- `GET /siswa/import/:job_id/preview` -> `{valid[],invalid[]}`
- `POST /siswa/import/:job_id/confirm`
- `GET /siswa?kelas=&q=&page=`

## Soal (Word)
- `POST /soal/import` multipart `file,mapel,kelas` -> `{job_id}`
- `GET /soal/import/:job_id/preview` -> `{soal[],error[]}`
- `PATCH /soal/import/:job_id/soal/:idx` — edit inline
- `POST /soal/import/:job_id/confirm`
- `GET /soal?mapel=&kelas=`

## Ujian
- `CRUD /ujian`
- `POST /ujian/:id/publish`
- `POST /ujian/:id/start` -> `{exam_token,ends_at,urutan_soal}`
- `POST /ujian/:id/heartbeat {exam_token,focus_lost,is_fullscreen}`
- `POST /ujian/:id/answer {question_id,jawaban}`
- `POST /ujian/:id/finish` -> `{nilai,folder_path}`
- `GET /ujian/:id/live` (proktor)
- `POST /ujian/:id/extend {siswa_id,menit}`
- `POST /ujian/:id/force-submit {siswa_id}`

## Hasil (folder per anak)
- `GET /hasil?ujian=&kelas=`
- `GET /hasil/:id/download` — ZIP 1 folder anak
- `GET /hasil/ujian/:id/kelas/:kelas/download` — ZIP kelas
- `GET /hasil/ujian/:id/download-all`
- `POST /hasil/:id/koreksi {skor_uraian[],feedback}`
- `POST /hasil/:id/release`

Error: `{error:{code,message,details}}`. Timer selalu dari `server_now`.
