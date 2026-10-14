# Backend CBT-BINAZ (Go)

## Run lokal
```bash
cp .env.example .env
go vet ./...
go run ./cmd/api
```

## Struktur
- `cmd/api/main.go` — Gin router + healthz + auth/heartbeat stub
- `migrations/` — SQL (sumber: `db/SCHEMA.sql`)
- TODO: `internal/parser/excel.go` (excelize, validasi NIS unik), `internal/parser/docx.go` (unzip document.xml, `*` = kunci), `internal/lockdown` (aturan warn 3x/auto-submit 5x), `internal/export` (PDF+ZIP per folder anak)
