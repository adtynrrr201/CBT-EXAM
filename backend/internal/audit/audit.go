package audit

import (
	"database/sql"
	"log"
)

// Migrate creates the audit_logs table if not present.
func Migrate(db *sql.DB) {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS audit_logs(
		id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
		actor TEXT,
		aksi  TEXT,
		target TEXT,
		at TIMESTAMPTZ DEFAULT now()
	)`)
	if err != nil {
		log.Printf("[AUDIT] migrate error (non-fatal): %v", err)
	}
}

// Log inserts an audit row fire-and-forget.
func Log(db *sql.DB, actor, aksi, target string) {
	go func() {
		_, err := db.Exec(`INSERT INTO audit_logs(actor, aksi, target) VALUES($1,$2,$3)`, actor, aksi, target)
		if err != nil {
			log.Printf("[AUDIT] write error: %v", err)
		}
	}()
}
