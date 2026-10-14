package parser

import (
	"fmt"
	"strings"
)

// Row represents one student row from the Excel upload.
// Fields map to template: NIS | Nama Lengkap | Kelas | Jenis Kelamin | Password | Tahun Ajaran
type Row struct {
	Line         int    // 1-based row number in the spreadsheet
	NIS          string
	Nama         string
	Kelas        string
	JenisKelamin string // "L" or "P"
	Password     string // empty = auto-generate from NIS
	TahunAjaran  string
}

// ValidationResult holds the outcome of Validate.
type ValidationResult struct {
	Valid   []Row
	Invalid []InvalidRow
}

// InvalidRow pairs a row with the reason it was rejected.
type InvalidRow struct {
	Row    Row
	Reason string
}

// Validate checks a slice of Rows and splits them into valid/invalid.
// Rules (from PRD §6.2 FR-SISWA-02):
//   - NIS not empty
//   - NIS unique within the batch (first wins, later duplicates rejected)
//   - Nama not empty
//   - Kelas not empty
func Validate(rows []Row) ValidationResult {
	var res ValidationResult
	seen := make(map[string]int) // NIS → first line number

	for _, r := range rows {
		var reasons []string

		nis := strings.TrimSpace(r.NIS)
		if nis == "" {
			reasons = append(reasons, "NIS kosong")
		} else if firstLine, dup := seen[nis]; dup {
			reasons = append(reasons, fmt.Sprintf("NIS duplikat (sama dengan baris %d)", firstLine))
		} else {
			seen[nis] = r.Line
		}

		if strings.TrimSpace(r.Nama) == "" {
			reasons = append(reasons, "Nama kosong")
		}
		if strings.TrimSpace(r.Kelas) == "" {
			reasons = append(reasons, "Kelas kosong")
		}
		if jk := strings.ToUpper(strings.TrimSpace(r.JenisKelamin)); jk != "L" && jk != "P" {
			reasons = append(reasons, "JK harus L/P")
		}

		if len(reasons) > 0 {
			res.Invalid = append(res.Invalid, InvalidRow{Row: r, Reason: strings.Join(reasons, "; ")})
		} else {
			res.Valid = append(res.Valid, r)
		}
	}
	return res
}
