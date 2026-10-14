package hasil

// NilaiPG scores multiple-choice answers against an answer key.
//
// Parameters (PRD §6.6 FR-HASIL-02, auto-grade on finish):
//   - kunci:  soalID → correct option labels (e.g. ["B"] or ["A","C"] for PG Kompleks)
//   - jawab:  soalID → student's chosen labels
//   - bobot:  soalID → point value (0 or missing = 1)
//
// Returns total score, count of correct/wrong/unanswered.
func NilaiPG(kunci map[string][]string, jawab map[string][]string, bobot map[string]int) (nilai float64, benar, salah, kosong int) {
	for soalID, keys := range kunci {
		b := bobot[soalID]
		if b <= 0 {
			b = 1
		}

		ans, ok := jawab[soalID]
		if !ok || len(ans) == 0 {
			kosong++
			continue
		}

		if match(keys, ans) {
			benar++
			nilai += float64(b)
		} else {
			salah++
		}
	}
	return
}

// match returns true when two label sets are identical (order-insensitive).
func match(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]struct{}, len(a))
	for _, v := range a {
		set[v] = struct{}{}
	}
	for _, v := range b {
		if _, ok := set[v]; !ok {
			return false
		}
	}
	return true
}
