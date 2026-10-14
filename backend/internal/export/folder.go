package export

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

var reNonAlnum = regexp.MustCompile(`[^a-z0-9-]+`)

// slug converts a human string to a lowercase dash-separated slug.
func slug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	s = reNonAlnum.ReplaceAllString(s, "")
	// collapse repeated dashes
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return strings.Trim(s, "-")
}

// ResultDir returns the per-student result folder path relative to the
// storage root (PRD §6.6 FR-HASIL-01).
//
// Pattern: {tahun_ajaran}/{ujian}/{kelas}/{NIS}-{slug_nama}/
func ResultDir(tahunAjaran, ujian, kelas, nis, nama string) string {
	return filepath.Join(
		slug(tahunAjaran),
		slug(ujian),
		slug(kelas),
		fmt.Sprintf("%s-%s", slug(nis), slug(nama)),
	)
}
