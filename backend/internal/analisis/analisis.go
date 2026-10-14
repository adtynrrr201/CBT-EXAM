package analisis

// Butir soal ala ExamSoft: tingkat kesukaran, daya beda, Cronbach's Alpha.
// Semua fungsi murni (tanpa DB) agar mudah diuji.

// LabelTK mengklasifikasi proporsi jawaban benar.
func LabelTK(tk float64) string {
	switch {
	case tk < 0.30:
		return "Sukar"
	case tk <= 0.70:
		return "Sedang"
	default:
		return "Mudah"
	}
}

// LabelDayaBeda mengklasifikasi indeks diskriminasi D.
func LabelDayaBeda(d float64) string {
	switch {
	case d >= 0.40:
		return "Baik"
	case d >= 0.20:
		return "Cukup"
	case d >= 0:
		return "Buruk"
	default:
		return "Jelek"
	}
}

// DayaBeda = (benar kelompok atas - benar kelompok bawah) / ukuran kelompok.
// Skor total sudah diurut menurun; kelompok = 27% atas/bawah (min 1 anak).
// benar[i] = 1 bila siswa ke-i menjawab soal ini dengan benar.
func DayaBeda(benar []int) float64 {
	n := len(benar)
	if n < 2 {
		return 0
	}
	g := n * 27 / 100
	if g < 1 {
		g = 1
	}
	atas, bawah := 0, 0
	for i := 0; i < g; i++ {
		atas += benar[i]
		bawah += benar[n-1-i]
	}
	return float64(atas-bawah) / float64(g)
}

// AlphaCronbach mengukur konsistensi internal ujian.
// skor[siswa][soal] = 1 benar / 0 salah-kosong. Kembalikan -1 bila tak terdefinisi.
func AlphaCronbach(skor [][]int) float64 {
	k := 0
	if len(skor) > 0 {
		k = len(skor[0])
	}
	if k < 2 || len(skor) < 2 {
		return -1
	}
	var sumItemVar float64
	for j := 0; j < k; j++ {
		var m float64
		for i := range skor {
			m += float64(skor[i][j])
		}
		m /= float64(len(skor))
		var v float64
		for i := range skor {
			d := float64(skor[i][j]) - m
			v += d * d
		}
		sumItemVar += v / float64(len(skor))
	}
	totals := make([]float64, len(skor))
	var mt float64
	for i := range skor {
		for j := 0; j < k; j++ {
			totals[i] += float64(skor[i][j])
		}
		mt += totals[i]
	}
	mt /= float64(len(skor))
	var vtot float64
	for i := range totals {
		d := totals[i] - mt
		vtot += d * d
	}
	vtot /= float64(len(totals))
	if vtot == 0 {
		return -1
	}
	return float64(k) / float64(k-1) * (1 - sumItemVar/vtot)
}
