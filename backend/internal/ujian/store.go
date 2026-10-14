package ujian

import (
	"errors"
	"math/rand"
	"strings"
	"time"
)

// Status constants for Ujian lifecycle (PRD §6.4 FR-UJIAN-01).
const (
	StatusDraft     = "DRAFT"
	StatusPublished = "PUBLISHED"
	StatusBerjalan  = "BERJALAN"
	StatusSelesai   = "SELESAI"
	StatusDinilai   = "DINILAI"
)

// Ujian represents an exam entity.
type Ujian struct {
	ID           string
	Judul        string
	Mapel        string
	Kelas        []string // multi-class
	Mulai        time.Time
	Selesai      time.Time
	DurasiMenit  int
	JumlahSoal   int
	AcakSoal     bool
	AcakOpsi     bool
	KKM          float64
	Token        string // 6 char, optional
	LockdownMode string // "soft" | "seb"
	Status       string
}

// Validate checks required fields for creating/updating an Ujian (PRD §6.4 FR-UJIAN-01).
func Validate(judul string, mulai, selesai time.Time, durasiMenit int) error {
	if strings.TrimSpace(judul) == "" {
		return errors.New("judul wajib diisi")
	}
	if mulai.IsZero() {
		return errors.New("waktu mulai wajib diisi")
	}
	if selesai.IsZero() {
		return errors.New("waktu selesai wajib diisi")
	}
	if !selesai.After(mulai) {
		return errors.New("waktu selesai harus setelah waktu mulai")
	}
	if durasiMenit <= 0 {
		return errors.New("durasi harus > 0 menit")
	}
	return nil
}

// Package is the per-student shuffled question ordering (PRD §6.4 FR-UJIAN-02).
type Package struct {
	SiswaID  string
	SoalIDs  []string // shuffled question order
}

// BuildPackages generates deterministic per-student question orderings.
// The shuffle is seeded by (seed + hash(siswaID)) so each student gets a
// unique but reproducible order — refresh won't change it.
func BuildPackages(ujianID string, siswaIDs []string, soalIDs []string, jumlahSoal int, seed int64) []Package {
	if jumlahSoal <= 0 || jumlahSoal > len(soalIDs) {
		jumlahSoal = len(soalIDs)
	}

	pkgs := make([]Package, 0, len(siswaIDs))
	for _, sid := range siswaIDs {
		// deterministic per-student seed
		h := seed
		for _, b := range []byte(sid) {
			h = h*31 + int64(b)
		}
		rng := rand.New(rand.NewSource(h))

		// copy + shuffle
		order := make([]string, len(soalIDs))
		copy(order, soalIDs)
		rng.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })

		pkgs = append(pkgs, Package{
			SiswaID: sid,
			SoalIDs: order[:jumlahSoal],
		})
	}
	return pkgs
}
