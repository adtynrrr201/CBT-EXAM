package db

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

// Open connects to PostgreSQL using DATABASE_URL env and pings.
func Open() (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL env wajib diset")
	}
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}
	conn.SetMaxOpenConns(20)
	return conn, nil
}
