package db

import (
	"database/sql"
	"log"

	"golang.org/x/crypto/bcrypt"
)

// Seed inserts starter data. Idempotent — safe to run on every startup
// (each insert is ON CONFLICT-safe; no early return so new seed rows
// backfill databases created before they existed).
func Seed(conn *sql.DB) {
	var count int
	if err := conn.QueryRow("SELECT count(*) FROM users").Scan(&count); err != nil {
		log.Printf("[seed] skip — cannot count users: %v", err)
		return
	}
	log.Println("[seed] upsert data awal...")

	hash := func(plain string) string {
		h, _ := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
		return string(h)
	}

	// admin
	mustExec(conn, `INSERT INTO users(username,password_hash,role,nama) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
		"admin", hash("admin123"), "admin", "Administrator")

	// guru
	mustExec(conn, `INSERT INTO users(username,password_hash,role,nama) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
		"guru", hash("guru123"), "guru", "Guru Demo")

	// proktor
	mustExec(conn, `INSERT INTO users(username,password_hash,role,nama) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
		"proktor", hash("proktor123"), "proktor", "Proktor Demo")

	// kelas XII-IPA-1
	var kelasID string
	err := conn.QueryRow(`INSERT INTO kelas(nama,tahun_ajaran) VALUES($1,$2) ON CONFLICT(nama) DO UPDATE SET nama=EXCLUDED.nama RETURNING id`,
		"XII-IPA-1", "2025/2026").Scan(&kelasID)
	if err != nil {
		log.Printf("[seed] kelas insert: %v", err)
		return
	}

	// siswa user + siswa record (12345)
	var siswaUserID string
	err = conn.QueryRow(`INSERT INTO users(username,password_hash,role,nama) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
		"12345", hash("12345"), "siswa", "Ahmad Bin Azis").Scan(&siswaUserID)
	if err != nil {
		err = conn.QueryRow(`SELECT id FROM users WHERE username=$1`, "12345").Scan(&siswaUserID)
		if err != nil {
			log.Printf("[seed] siswa user lookup: %v", err)
			return
		}
	}

	mustExec(conn, `INSERT INTO siswa(user_id,nis,nama,kelas_id,jk) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
		siswaUserID, "12345", "Ahmad Bin Azis", kelasID, "L")

	// siswa kedua (12346 Siti Aminah)
	var siswa2UserID string
	err = conn.QueryRow(`INSERT INTO users(username,password_hash,role,nama) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
		"12346", hash("12346"), "siswa", "Siti Aminah").Scan(&siswa2UserID)
	if err != nil {
		err = conn.QueryRow(`SELECT id FROM users WHERE username=$1`, "12346").Scan(&siswa2UserID)
		if err != nil {
			log.Printf("[seed] siswa2 user lookup: %v", err)
			return
		}
	}

	mustExec(conn, `INSERT INTO siswa(user_id,nis,nama,kelas_id,jk) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
		siswa2UserID, "12346", "Siti Aminah", kelasID, "P")

	seedDemoBank(conn)

	log.Println("[seed] done: admin, guru, proktor, siswa 12345 & 12346")
}

// seedDemoBank memastikan satu ujian demo berbank soal riil + paket ACTIVE
// untuk kedua siswa seed, sehingga loop ujian UUID beneran bisa jalan
// end-to-end (start → questions → answer → finish → nilai).
// Idempoten penuh via ON CONFLICT DO NOTHING.
func seedDemoBank(conn *sql.DB) {
	const ujianID = "11111111-1111-1111-1111-111111111111"
	mustExec(conn, `INSERT INTO ujian(id, judul, mapel, durasi_menit, mulai_at, selesai_at,
		jumlah_soal, acak_soal, acak_opsi, token, status)
		VALUES($1,'UAS IPA Semester 1 (Bank Demo)','IPA',90,now(),now()+interval '30 days',
		5,true,true,'DEMO01','BERJALAN') ON CONFLICT(id) DO NOTHING`, ujianID)

	type opsi struct {
		label, teks string
		kunci       bool
	}
	bank := []struct {
		id, teks string
		opsi     []opsi
	}{
		{"22222222-2222-2222-2222-222222222221", "Ibu kota negara Republik Indonesia adalah ....",
			[]opsi{{"A", "Bandung", false}, {"B", "Jakarta", true}, {"C", "Surabaya", false}, {"D", "Medan", false}}},
		{"22222222-2222-2222-2222-222222222222", "Pancasila sila pertama berbunyi ....",
			[]opsi{{"A", "Ketuhanan Yang Maha Esa", true}, {"B", "Kemanusiaan yang adil dan beradab", false}, {"C", "Persatuan Indonesia", false}, {"D", "Keadilan sosial bagi seluruh rakyat Indonesia", false}}},
		{"22222222-2222-2222-2222-222222222223", "Lembaga yang berwenang menguji undang-undang terhadap UUD 1945 adalah ....",
			[]opsi{{"A", "Mahkamah Agung", false}, {"B", "Mahkamah Konstitusi", true}, {"C", "Dewan Perwakilan Rakyat", false}, {"D", "Komisi Yudisial", false}}},
		{"22222222-2222-2222-2222-222222222224", "Proses fotosintesis pada tumbuhan hijau menghasilkan ....",
			[]opsi{{"A", "Karbondioksida dan Air", false}, {"B", "Oksigen dan Glukosa", true}, {"C", "Nitrogen dan Karbon", false}, {"D", "Asam Sulfat dan Air", false}}},
		{"22222222-2222-2222-2222-222222222225", "Planet terbesar dalam tata surya kita adalah ....",
			[]opsi{{"A", "Mars", false}, {"B", "Saturnus", false}, {"C", "Jupiter", true}, {"D", "Neptunus", false}}},
	}
	urutan := "["
	for i, q := range bank {
		mustExec(conn, `INSERT INTO questions(id, mapel, kelas, tipe, teks_html, bobot)
			VALUES($1,'IPA','XII-IPA-1','PG',$2,20) ON CONFLICT(id) DO NOTHING`, q.id, q.teks)
		for j, o := range q.opsi {
			mustExec(conn, `INSERT INTO question_options(question_id, label, teks_html, is_kunci, urutan)
				SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS
				(SELECT 1 FROM question_options WHERE question_id = $1 AND label = $2)`,
				q.id, o.label, o.teks, o.kunci, j)
		}
		if i > 0 {
			urutan += ","
		}
		urutan += `"` + q.id + `"`
	}
	urutan += "]"

	for _, nis := range []string{"12345", "12346"} {
		var sid string
		if err := conn.QueryRow("SELECT id FROM siswa WHERE nis = $1", nis).Scan(&sid); err != nil {
			continue
		}
		mustExec(conn, `INSERT INTO exam_packages(ujian_id, siswa_id, urutan_soal, status)
			VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(ujian_id, siswa_id) DO NOTHING`,
			ujianID, sid, urutan)
	}
}

func mustExec(conn *sql.DB, q string, args ...any) {
	if _, err := conn.Exec(q, args...); err != nil {
		log.Printf("[seed] exec error: %v  query: %s", err, q)
	}
}
