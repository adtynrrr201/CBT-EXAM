package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"cbt-binaz/backend/internal/announce"
	"cbt-binaz/backend/internal/analisis"
	"cbt-binaz/backend/internal/audit"
	cbtDB "cbt-binaz/backend/internal/db"
	"cbt-binaz/backend/internal/export"
	"cbt-binaz/backend/internal/hasil"
	"cbt-binaz/backend/internal/lockdown"
	"cbt-binaz/backend/internal/middleware"
	"cbt-binaz/backend/internal/parser"
	"cbt-binaz/backend/internal/ujian"
)

func main() {
	conn, err := cbtDB.Open()
	if err != nil {
		log.Fatalf("FATAL: koneksi DB gagal: %v", err)
	}
	cbtDB.Seed(conn)
	audit.Migrate(conn)
	// SEB: kolom kunci config per ujian (require_seb sudah ada sejak awal).
	_, _ = conn.Exec(`ALTER TABLE ujian ADD COLUMN IF NOT EXISTS seb_config_key TEXT DEFAULT ''`)

	r := gin.Default()
	// Di balik nginx: percaya X-Forwarded-For dari bridge Docker agar
	// ClientIP per klien (rate-limit tidak berbagi satu bucket).
	_ = r.SetTrustedProxies([]string{"172.16.0.0/12", "10.0.0.0/8", "192.168.0.0/16"})

	r.GET("/api/v1/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true, "time": time.Now().UTC()})
	})

	// Health: rich system info (open, no auth)
	r.GET("/api/v1/health", func(c *gin.Context) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		var users, siswa, pkgActive int
		_ = conn.QueryRow("SELECT COUNT(*) FROM users").Scan(&users)
		_ = conn.QueryRow("SELECT COUNT(*) FROM siswa").Scan(&siswa)
		_ = conn.QueryRow("SELECT COUNT(*) FROM exam_packages WHERE status = 'ACTIVE'").Scan(&pkgActive)
		c.JSON(200, gin.H{
			"ok":              true,
			"mem_mb":          m.Alloc / 1024 / 1024,
			"goroutines":      runtime.NumGoroutine(),
			"users":           users,
			"siswa":           siswa,
			"packages_active": pkgActive,
		})
	})

	v1 := r.Group("/api/v1")
	v1.Use(middleware.SEBGuard())
	// Auth: DB + bcrypt validation
	v1.POST("/auth/login", middleware.RateLimitLogin(), func(c *gin.Context) {
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
			DeviceID string `json:"device_id"`
			Force    bool   `json:"force"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || in.Username == "" || in.Password == "" {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "username/password wajib"}})
			return
		}

		var (
			userID       string
			passwordHash string
			role         string
			nama         string
		)
		err := conn.QueryRow("SELECT id, password_hash, role, nama FROM users WHERE username = $1", in.Username).
			Scan(&userID, &passwordHash, &role, &nama)
		if err == sql.ErrNoRows {
			c.JSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "username atau password salah"}})
			return
		} else if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "INTERNAL", "message": err.Error()}})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)); err != nil {
			c.JSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "username atau password salah"}})
			return
		}

		// Single-device: tolak bila sesi segar di perangkat lain masih hidup,
		// kecuali pemanggil memaksa (proktor reset / pindah PC).
		var activeDevice string
		_ = conn.QueryRow(`SELECT device_id FROM sessions WHERE user_id = $1
			AND last_heartbeat > now() - interval '5 minutes'
			AND COALESCE(device_id,'') <> $2 LIMIT 1`, userID, in.DeviceID).Scan(&activeDevice)
		if activeDevice != "" && !in.Force {
			c.JSON(409, gin.H{"error": gin.H{"code": "SESSION_ACTIVE", "message": "akun sedang dipakai di perangkat lain"}})
			return
		}
		_, _ = conn.Exec("DELETE FROM sessions WHERE user_id = $1", userID)
		_, _ = conn.Exec(`INSERT INTO sessions(user_id, device_id, ip, last_heartbeat)
			VALUES($1, $2, $3, now())`, userID, in.DeviceID, c.ClientIP())

		secret := middleware.Secret()
		// Token 4 jam: cukup untuk ujian terlama + jeda proktor, tapi sesi
		// di PC bersama tak menggantung seharian. Paket yang SELESAI
		// tetap menolak lanjut (finish mengunci paket).
		t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": in.Username, "user_id": userID, "role": role, "exp": time.Now().Add(4 * time.Hour).Unix(),
		})
		s, _ := t.SignedString([]byte(secret))

		resp := gin.H{
			"access_token": s,
			"role":         role,
			"user_id":      userID,
			"nama":         nama,
		}

		if role == "siswa" {
			var siswaID string
			if err := conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", userID).Scan(&siswaID); err == nil {
				var ujianID string
				var judulUjian string
				errUjian := conn.QueryRow(`
					SELECT ep.ujian_id, u.judul 
					FROM exam_packages ep 
					JOIN ujian u ON u.id = ep.ujian_id 
					WHERE ep.siswa_id = $1 AND ep.status = 'ACTIVE' 
					LIMIT 1`, siswaID).Scan(&ujianID, &judulUjian)
				if errUjian == nil {
					resp["ujian_aktif"] = gin.H{
						"ujian_id": ujianID,
						"judul":    judulUjian,
					}
				}
			}
		}

		c.JSON(200, resp)
	})
	v1.GET("/auth/me", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenStr := ""
		if len(authHeader) >= 7 && authHeader[:7] == "Bearer " {
			tokenStr = authHeader[7:]
		}

		claims, err := middleware.ParseToken(tokenStr)
		if err != nil {
			c.JSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
			return
		}

		userID, _ := claims["user_id"].(string)
		if userID == "" {
			c.JSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "user_id tidak ditemukan di token"}})
			return
		}

		var username, role, nama string
		err = conn.QueryRow("SELECT username, role, nama FROM users WHERE id = $1", userID).
			Scan(&username, &role, &nama)
		if err != nil {
			c.JSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "user tidak ditemukan di DB"}})
			return
		}

		resp := gin.H{
			"username": username,
			"role":     role,
			"user_id":  userID,
			"nama":     nama,
		}
		if role == "siswa" {
			var nis, kelas string
			_ = conn.QueryRow(`SELECT s.nis, COALESCE(k.nama,'') FROM siswa s
				LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.user_id = $1`, userID).Scan(&nis, &kelas)
			resp["nis"] = nis
			resp["kelas"] = kelas
		}

		c.JSON(200, resp)
	})
	v1.POST("/auth/logout", middleware.RequireRole(), func(c *gin.Context) {
		userVal, _ := c.Get("user_id")
		if uid, _ := userVal.(string); uid != "" {
			_, _ = conn.Exec("DELETE FROM sessions WHERE user_id = $1", uid)
		}
		c.JSON(200, gin.H{"ok": true})
	})

	// Lockdown heartbeat: satu sumber ambang via lockdown.Evaluate (PRD §6.5)
	// Auth apa pun (siswa menggunakannya saat ujian).
	v1.POST("/ujian/:id/heartbeat", middleware.RequireRole(), func(c *gin.Context) {
		var in struct {
			ExamToken    string `json:"exam_token"`
			FocusLost    int    `json:"focus_lost"`
			IsFullscreen bool   `json:"is_fullscreen"`
			DeviceID     string `json:"device_id"`
		}
		_ = c.ShouldBindJSON(&in)
		// SEB: tolak browser biasa bila ujian mewajibkan SEB.
		if id := c.Param("id"); isUUID(id) && !sebGuard(c, conn, id) {
			return
		}
		// Sesi tetap segar selama heartbeat jalan (penentu konflik single-device).
		hbUser, _ := c.Get("user_id")
		if uid, _ := hbUser.(string); uid != "" {
			if in.DeviceID != "" {
				_, _ = conn.Exec(`UPDATE sessions SET last_heartbeat = now(), ip = $3
					WHERE user_id = $1 AND device_id = $2`, uid, in.DeviceID, c.ClientIP())
			} else {
				_, _ = conn.Exec("UPDATE sessions SET last_heartbeat = now() WHERE user_id = $1", uid)
			}
		}
		switch lockdown.Evaluate(in.FocusLost) {
		case "AUTO_SUBMIT":
			c.JSON(200, gin.H{"action": "AUTO_SUBMIT", "reason": "max_focus_lost"})
		case "WARN":
			c.JSON(200, gin.H{"action": "WARN", "server_now": time.Now().UTC()})
		default:
			c.JSON(200, gin.H{"action": "OK", "server_now": time.Now().UTC()})
		}
	})
	v1.POST("/ujian/:id/start", middleware.RequireRole(), func(c *gin.Context) {
		// Penerbitan paket + jam server resmi (source of truth waktu).
		// Demo (id non-UUID): tanpa paket, jam ikut client.
		if !isUUID(c.Param("id")) {
			c.JSON(200, gin.H{"exam_token": "exam-stub", "ends_at": time.Now().Add(90 * time.Minute).UTC()})
			return
		}
		if !sebGuard(c, conn, c.Param("id")) {
			return
		}
		siswaID := ""
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		if role == "siswa" {
			userVal, _ := c.Get("user_id")
			if uid, _ := userVal.(string); uid != "" {
				_ = conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", uid).Scan(&siswaID)
			}
		} else {
			// Pratinjau non-siswa (admin pantau): tanpa paket, tanpa tulis DB.
			c.JSON(200, gin.H{"exam_token": "preview", "ends_at": time.Now().Add(90 * time.Minute).UTC()})
			return
		}
		if siswaID == "" {
			c.JSON(403, gin.H{"error": gin.H{"code": "FORBIDDEN", "message": "hanya siswa terdaftar yang bisa mulai"}})
			return
		}
		var pkgID, status string
		var startedAt, endsAt *time.Time
		err := conn.QueryRow(`SELECT id, status, started_at, ends_at FROM exam_packages
			WHERE ujian_id = $1 AND siswa_id = $2`, c.Param("id"), siswaID).Scan(&pkgID, &status, &startedAt, &endsAt)
		if err == sql.ErrNoRows {
			var durasi int
			_ = conn.QueryRow("SELECT durasi_menit FROM ujian WHERE id = $1", c.Param("id")).Scan(&durasi)
			if durasi <= 0 {
				durasi = 90
			}
			now := time.Now().UTC()
			end := now.Add(time.Duration(durasi) * time.Minute)
			err = conn.QueryRow(`INSERT INTO exam_packages(ujian_id, siswa_id, status, started_at, ends_at)
				VALUES($1, $2, 'ACTIVE', $3, $4) RETURNING id`,
				c.Param("id"), siswaID, now, end).Scan(&pkgID)
			if err != nil {
				c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
				return
			}
			status, startedAt, endsAt = "ACTIVE", &now, &end
		} else if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		if status == "SELESAI" {
			c.JSON(403, gin.H{"error": gin.H{"code": "ALREADY_SUBMITTED", "message": "ujian sudah dikirim, sesi dikunci"}})
			return
		}
		c.JSON(200, gin.H{"exam_token": "exam-stub", "ends_at": endsAt, "exam_package_id": pkgID})
	})

	// Kunci jawaban demo hidup di SERVER (browser tak boleh tahu kunci).
	// Hanya untuk bank contoh q1..q5; ujian UUID dinilai dari question_options.
	var demoKunci = map[string]string{"q1": "B", "q2": "A", "q3": "B", "q4": "B", "q5": "C"}

	v1.POST("/ujian/demo/grade", middleware.RequireRole(), middleware.RateLimitGrade(), func(c *gin.Context) {
		var in struct {
			Answers map[string]string `json:"answers"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		benar, kosong := 0, 0
		for qid, kunci := range demoKunci {
			a := in.Answers[qid]
			if a == "" {
				kosong++
			} else if a == kunci {
				benar++
			}
		}
		total := len(demoKunci)
		c.JSON(200, gin.H{
			"nilai":  benar * 100 / total,
			"benar":  benar,
			"salah":  total - benar - kosong,
			"kosong": kosong,
		})
	})
	v1.POST("/ujian/:id/answer", middleware.RequireRole(), func(c *gin.Context) {
		var in struct {
			ExamPackageID string   `json:"exam_package_id"`
			QuestionID    string   `json:"question_id"`
			OpsiDipilih   []string `json:"opsi_dipilih"`
			Jawaban       string   `json:"jawaban"`
			IsianText     string   `json:"isian_text"`
			SiswaID       string   `json:"siswa_id"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}

		// Siswa terkunci ke dirinya sendiri (body diabaikan); peran lain boleh menyebut eksplisit (demo/admin).
		roleVal, _ := c.Get("role")
		if role, _ := roleVal.(string); role == "siswa" {
			userVal, _ := c.Get("user_id")
			if userID, _ := userVal.(string); userID != "" {
				var sid string
				if err := conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", userID).Scan(&sid); err == nil {
					in.SiswaID = sid
				} else {
					in.SiswaID = ""
				}
			} else {
				in.SiswaID = ""
			}
		}
		// Kompat: frontend mengirim {jawaban: "B"} tunggal.
		if len(in.OpsiDipilih) == 0 && in.Jawaban != "" {
			in.OpsiDipilih = []string{in.Jawaban}
		}
		// SEB: tolak jawaban browser biasa bila ujian mewajibkan SEB.
		if id := c.Param("id"); isUUID(id) && !sebGuard(c, conn, id) {
			return
		}

		// Ensure an exam_package exists (create demo package if missing and SiswaID provided)
		pkgID := in.ExamPackageID
		if pkgID != "" && !isUUID(pkgID) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "exam_package_id tidak valid"}})
			return
		}
		if in.QuestionID != "" && !isUUID(in.QuestionID) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "question_id tidak valid"}})
			return
		}
		if pkgID == "" && in.SiswaID != "" {
			_ = conn.QueryRow(`
				INSERT INTO exam_packages(ujian_id, siswa_id)
				VALUES($1, $2)
				ON CONFLICT(ujian_id, siswa_id) DO UPDATE SET status='ACTIVE'
				RETURNING id`, c.Param("id"), in.SiswaID).Scan(&pkgID)
		}

		// Gerbang waktu + status dari server: paket SELESAI/kedaluwarsa menolak jawaban baru.
		if pkgID != "" {
			var status string
			var endsAt *time.Time
			if err := conn.QueryRow("SELECT status, ends_at FROM exam_packages WHERE id = $1",
				pkgID).Scan(&status, &endsAt); err == nil {
				if status == "SELESAI" {
					c.JSON(403, gin.H{"error": gin.H{"code": "ALREADY_SUBMITTED", "message": "ujian sudah dikirim"}})
					return
				}
				if endsAt != nil && time.Now().UTC().After(*endsAt) {
					_, _ = conn.Exec("UPDATE exam_packages SET status = 'SELESAI' WHERE id = $1", pkgID)
					c.JSON(403, gin.H{"error": gin.H{"code": "TIME_EXPIRED", "message": "waktu ujian habis"}})
					return
				}
			}
		}

		if pkgID != "" && in.QuestionID != "" {
			var pqArray string
			if len(in.OpsiDipilih) > 0 {
				pqArray = "{" + fmt.Sprintf("\"%s\"", in.OpsiDipilih[0])
				for _, o := range in.OpsiDipilih[1:] {
					pqArray += fmt.Sprintf(",\"%s\"", o)
				}
				pqArray += "}"
			} else {
				pqArray = "{}"
			}

			_, err := conn.Exec(`
				INSERT INTO exam_answers(exam_package_id, question_id, opsi_dipilih, isian_text, updated_at)
				VALUES($1, $2, $3, $4, now())
				ON CONFLICT(exam_package_id, question_id)
				DO UPDATE SET opsi_dipilih = EXCLUDED.opsi_dipilih, isian_text = EXCLUDED.isian_text, updated_at = now()`,
				pkgID, in.QuestionID, pqArray, in.IsianText)
			if err != nil {
				c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
				return
			}
		}

		c.JSON(200, gin.H{"saved": true, "exam_package_id": pkgID, "server_now": time.Now().UTC()})
	})

	v1.POST("/ujian/:id/finish", middleware.RequireRole(), func(c *gin.Context) {
		var in struct {
			ExamPackageID string `json:"exam_package_id"`
		}
		_ = c.ShouldBindJSON(&in)

		ujianID := c.Param("id")

		if isUUID(ujianID) && !sebGuard(c, conn, ujianID) {
			return
		}

		if in.ExamPackageID != "" && !isUUID(in.ExamPackageID) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "exam_package_id tidak valid"}})
			return
		}

		// Paket dari konteks bila body kosong (al ur siswa normal).
		if in.ExamPackageID == "" {
			roleVal, _ := c.Get("role")
			if role, _ := roleVal.(string); role == "siswa" {
				userVal, _ := c.Get("user_id")
				if uid, _ := userVal.(string); uid != "" {
					var sid string
					if err := conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", uid).Scan(&sid); err == nil {
						_ = conn.QueryRow(`SELECT id FROM exam_packages
							WHERE ujian_id = $1 AND siswa_id = $2`, ujianID, sid).Scan(&in.ExamPackageID)
					}
				}
			}
		}

		// Gerbang paket: tolak kiriman susulan (sudah SELESAI / lewat ends_at).
		if in.ExamPackageID != "" {
			var st string
			var ea *time.Time
			if err := conn.QueryRow("SELECT status, ends_at FROM exam_packages WHERE id = $1",
				in.ExamPackageID).Scan(&st, &ea); err == nil {
				if st == "SELESAI" {
					c.JSON(403, gin.H{"error": gin.H{"code": "ALREADY_SUBMITTED", "message": "ujian sudah dikirim"}})
					return
				}
				if ea != nil && time.Now().UTC().After(*ea) {
					_, _ = conn.Exec("UPDATE exam_packages SET status = 'SELESAI' WHERE id = $1", in.ExamPackageID)
					c.JSON(403, gin.H{"error": gin.H{"code": "TIME_EXPIRED", "message": "waktu ujian habis"}})
					return
				}
			}
		}

		// Query answers + keys from DB if package exists
		kunci := make(map[string][]string)
		jawab := make(map[string][]string)
		bobot := make(map[string]int)

		if in.ExamPackageID != "" {
			rows, err := conn.Query(`
				SELECT q.id, q.bobot, qo.label, ea.opsi_dipilih
				FROM questions q
				LEFT JOIN question_options qo ON qo.question_id = q.id AND qo.is_kunci = true
				LEFT JOIN exam_answers ea ON ea.question_id = q.id AND ea.exam_package_id = $1
				WHERE q.id IN (
					SELECT jsonb_array_elements_text(urutan_soal)::uuid FROM exam_packages WHERE id = $1
				)`, in.ExamPackageID)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var qid string
					var b int
					var keyLbl sql.NullString
					var ansArr []string
					if err := rows.Scan(&qid, &b, &keyLbl, (*pqStringArray)(&ansArr)); err == nil {
						bobot[qid] = b
						if keyLbl.Valid {
							kunci[qid] = append(kunci[qid], keyLbl.String)
						}
						if len(ansArr) > 0 {
							jawab[qid] = ansArr
						}
					}
				}
			}
		}

		nilai, benar, salah, kosong := hasil.NilaiPG(kunci, jawab, bobot)

		// Get student info for folder path
		var (
			tahunAjaran = "2025/2026"
			judulUjian  = "ujian-" + ujianID
			namaKelas   = "umum"
			nis         = "00000"
			namaSiswa   = "siswa"
		)
		if in.ExamPackageID != "" {
			_ = conn.QueryRow(`
				SELECT u.judul, k.tahun_ajaran, k.nama, s.nis, s.nama
				FROM exam_packages ep
				JOIN ujian u ON u.id = ep.ujian_id
				JOIN siswa s ON s.id = ep.siswa_id
				LEFT JOIN kelas k ON k.id = s.kelas_id
				WHERE ep.id = $1`, in.ExamPackageID).Scan(&judulUjian, &tahunAjaran, &namaKelas, &nis, &namaSiswa)
		}

		folderPath := export.ResultDir(tahunAjaran, judulUjian, namaKelas, nis, namaSiswa)

		// Insert or update exam_results
		if in.ExamPackageID != "" {
			_, _ = conn.Exec(`
				INSERT INTO exam_results(exam_package_id, nilai, benar, salah, kosong, folder_path)
				VALUES($1, $2, $3, $4, $5, $6)
				ON CONFLICT(exam_package_id)
				DO UPDATE SET nilai=EXCLUDED.nilai, benar=EXCLUDED.benar, salah=EXCLUDED.salah, kosong=EXCLUDED.kosong, folder_path=EXCLUDED.folder_path`,
				in.ExamPackageID, nilai, benar, salah, kosong, folderPath)
			// Kunci paket: token/sesi tak bisa dipakai mengulang (efek blacklist per ujian).
			_, _ = conn.Exec("UPDATE exam_packages SET status = 'SELESAI' WHERE id = $1", in.ExamPackageID)
		}

		c.JSON(200, gin.H{
			"nilai":       nilai,
			"benar":       benar,
			"salah":       salah,
			"kosong":      kosong,
			"folder_path": "/storage/hasil/" + folderPath,
		})
	})

	// Preview siswa import — wired to parser.Validate (admin, guru)
	v1.POST("/siswa/import/preview", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		var in struct {
			Rows []parser.Row `json:"rows"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		res := parser.Validate(in.Rows)
		c.JSON(200, gin.H{
			"valid_count":   len(res.Valid),
			"invalid_count": len(res.Invalid),
			"valid":         res.Valid,
			"invalid":       res.Invalid,
		})
	})

	// Confirm siswa import — insert valid rows to users+siswa (idempotent) (admin, guru)
	v1.POST("/siswa/import/confirm", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		var in struct {
			Rows []parser.Row `json:"rows"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		res := parser.Validate(in.Rows)
		sukses := 0
		for _, r := range res.Valid {
			pw := r.Password
			if pw == "" {
				pw = r.NIS
			}
			h, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
			var kelasID sql.NullString
			_ = conn.QueryRow(`INSERT INTO kelas(nama,tahun_ajaran) VALUES($1,$2)
				ON CONFLICT(nama) DO UPDATE SET nama=EXCLUDED.nama RETURNING id`,
				r.Kelas, r.TahunAjaran).Scan(&kelasID)
			if !kelasID.Valid {
				_ = conn.QueryRow(`SELECT id FROM kelas WHERE nama=$1`, r.Kelas).Scan(&kelasID)
			}
			var userID string
			err := conn.QueryRow(`INSERT INTO users(username,password_hash,role,nama)
				VALUES($1,$2,'siswa',$3) ON CONFLICT(username) DO NOTHING RETURNING id`,
				r.NIS, string(h), r.Nama).Scan(&userID)
			if err != nil {
				_ = conn.QueryRow(`SELECT id FROM users WHERE username=$1`, r.NIS).Scan(&userID)
			}
			if userID == "" {
				continue
			}
			var kelasArg any
			if kelasID.Valid {
				kelasArg = kelasID.String
			} else {
				kelasArg = nil
			}
			if _, err := conn.Exec(`INSERT INTO siswa(user_id,nis,nama,kelas_id,jk)
				VALUES($1,$2,$3,$4,$5) ON CONFLICT(nis) DO NOTHING`,
				userID, r.NIS, r.Nama, kelasArg, r.JenisKelamin); err == nil {
				sukses++
			}
		}
		c.JSON(200, gin.H{
			"sukses":        sukses,
			"gagal":         len(res.Invalid),
			"invalid":       res.Invalid,
			"valid_count":   len(res.Valid),
			"invalid_count": len(res.Invalid),
		})
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "siswa_import_confirm", fmt.Sprintf("%d siswa", sukses))
	})

	// List siswa — untuk tabel frontend (admin, guru)
	v1.GET("/siswa", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		rows, err := conn.Query(`SELECT s.nis, s.nama, COALESCE(k.nama,''), COALESCE(s.jk,'')
			FROM siswa s LEFT JOIN kelas k ON k.id = s.kelas_id ORDER BY s.nis LIMIT 1000`)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()
		type item struct {
			NIS   string `json:"nis"`
			Nama  string `json:"nama"`
			Kelas string `json:"kelas"`
			JK    string `json:"jk"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.NIS, &it.Nama, &it.Kelas, &it.JK); err == nil {
				out = append(out, it)
			}
		}
		c.JSON(200, gin.H{"siswa": out})
	})

	// Template CSV — Excel bisa buka langsung, tanpa lib xlsx
	v1.GET("/siswa/template", func(c *gin.Context) {
		csv := "NIS,Nama Lengkap,Kelas,L/P,Password,Tahun Ajaran\n12345,Ahmad Bin Azis,XII-IPA-1,L,,2025/2026\n12346,Siti Aminah,XII-IPA-1,P,,2025/2026\n"
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", `attachment; filename="template-siswa.csv"`)
		c.String(200, csv)
	})
	v1.GET("/siswa/template.xlsx", func(c *gin.Context) {
		c.Redirect(302, "/api/v1/siswa/template")
	})

	// Kelola pengguna — daftar + tambah akun staf (khusus admin)
	v1.GET("/users", middleware.RequireRole("admin"), func(c *gin.Context) {
		q := c.Query("role")
		var rows *sql.Rows
		var err error
		if q == "admin" || q == "guru" || q == "proktor" || q == "siswa" {
			rows, err = conn.Query(`SELECT id, username, role, nama FROM users WHERE role = $1 ORDER BY username`, q)
		} else {
			rows, err = conn.Query(`SELECT id, username, role, nama FROM users ORDER BY role, username`)
		}
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()
		type item struct {
			ID       string `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
			Nama     string `json:"nama"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.ID, &it.Username, &it.Role, &it.Nama); err == nil {
				out = append(out, it)
			}
		}
		c.JSON(200, gin.H{"users": out})
	})
	v1.POST("/users", middleware.RequireRole("admin"), func(c *gin.Context) {
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Nama     string `json:"nama"`
			Role     string `json:"role"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || in.Username == "" || in.Password == "" || in.Nama == "" {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "username/password/nama wajib"}})
			return
		}
		if in.Role != "admin" && in.Role != "guru" && in.Role != "proktor" {
			c.JSON(422, gin.H{"error": gin.H{"code": "VALIDATION", "message": "role harus admin/guru/proktor"}})
			return
		}
		h, _ := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		var id string
		err := conn.QueryRow(`INSERT INTO users(username,password_hash,role,nama)
			VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING RETURNING id`,
			in.Username, string(h), in.Role, in.Nama).Scan(&id)
		if err != nil {
			c.JSON(409, gin.H{"error": gin.H{"code": "CONFLICT", "message": "username sudah dipakai"}})
			return
		}
		c.JSON(201, gin.H{"id": id, "username": in.Username, "role": in.Role, "nama": in.Nama})
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "create_user", in.Username)
	})

	// Ambil daftar semua soal beserta opsi dan kunci jawabannya dari DB (admin, guru)
	v1.GET("/questions", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		type optItem struct {
			Label    string `json:"label"`
			TeksHTML string `json:"teks_html"`
			IsKunci  bool   `json:"is_kunci"`
		}
		type qItem struct {
			ID       string    `json:"id"`
			Mapel    string    `json:"mapel"`
			Kelas    string    `json:"kelas"`
			Tipe     string    `json:"tipe"`
			TeksHTML string    `json:"teks_html"`
			Bobot    int       `json:"bobot"`
			Opsi     []optItem `json:"opsi"`
		}

		rows, err := conn.Query(`SELECT id, mapel, kelas, tipe, teks_html, bobot FROM questions ORDER BY mapel, teks_html`)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()

		out := []qItem{}
		for rows.Next() {
			var qi qItem
			if err := rows.Scan(&qi.ID, &qi.Mapel, &qi.Kelas, &qi.Tipe, &qi.TeksHTML, &qi.Bobot); err != nil {
				continue
			}
			qi.Opsi = []optItem{}
			orows, err := conn.Query(`SELECT label, teks_html, is_kunci FROM question_options WHERE question_id = $1 ORDER BY label`, qi.ID)
			if err == nil {
				for orows.Next() {
					var oi optItem
					if err := orows.Scan(&oi.Label, &oi.TeksHTML, &oi.IsKunci); err == nil {
						qi.Opsi = append(qi.Opsi, oi)
					}
				}
				orows.Close()
			}
			out = append(out, qi)
		}
		if out == nil {
			out = []qItem{}
		}
		c.JSON(200, gin.H{"questions": out})
	})

	// Update soal di database (admin, guru)
	v1.PUT("/questions/:id", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		qid := c.Param("id")
		if !isUUID(qid) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "ID soal tidak valid"}})
			return
		}
		var in struct {
			TeksHTML string `json:"teks_html"`
			Mapel    string `json:"mapel"`
			Kelas    string `json:"kelas"`
			Tipe     string `json:"tipe"`
			Bobot    int    `json:"bobot"`
			Opsi     []struct {
				Label    string `json:"label"`
				TeksHTML string `json:"teks_html"`
				IsKunci  bool   `json:"is_kunci"`
			} `json:"opsi"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		if in.Bobot <= 0 {
			in.Bobot = 10
		}
		if in.Tipe == "" {
			in.Tipe = "PG"
		}

		tx, err := conn.Begin()
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "INTERNAL", "message": err.Error()}})
			return
		}
		defer tx.Rollback()

		res, err := tx.Exec(`UPDATE questions SET mapel = $1, kelas = $2, tipe = $3, teks_html = $4, bobot = $5 WHERE id = $6`,
			in.Mapel, in.Kelas, in.Tipe, in.TeksHTML, in.Bobot, qid)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			c.JSON(404, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "soal tidak ditemukan"}})
			return
		}

		_, _ = tx.Exec(`DELETE FROM question_options WHERE question_id = $1`, qid)
		for idx, o := range in.Opsi {
			_, err = tx.Exec(`INSERT INTO question_options(question_id, label, teks_html, is_kunci, urutan)
				VALUES($1, $2, $3, $4, $5)`, qid, o.Label, o.TeksHTML, o.IsKunci, idx)
			if err != nil {
				c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "INTERNAL", "message": err.Error()}})
			return
		}

		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "update_question", qid)
		c.JSON(200, gin.H{"ok": true, "id": qid})
	})

	// Daftar soal untuk dikerjakan — TANPA kunci (siswa tak boleh tahu).
	// Urutan mengikuti paket siswa bila ada, else bank mapel dibatasi jumlah_soal.
	v1.GET("/ujian/:id/questions", middleware.RequireRole(), func(c *gin.Context) {
		if !isUUID(c.Param("id")) {
			c.JSON(200, gin.H{"questions": []any{}, "demo": true})
			return
		}
		if !sebGuard(c, conn, c.Param("id")) {
			return
		}
		var jumlah int
		_ = conn.QueryRow("SELECT jumlah_soal FROM ujian WHERE id = $1", c.Param("id")).Scan(&jumlah)
		if jumlah <= 0 {
			jumlah = 50
		}
		ids := []string{}
		roleVal, _ := c.Get("role")
		if role, _ := roleVal.(string); role == "siswa" {
			userVal, _ := c.Get("user_id")
			if uid, _ := userVal.(string); uid != "" {
				var sid string
				if err := conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", uid).Scan(&sid); err == nil {
					rows, err := conn.Query(`SELECT jsonb_array_elements_text(urutan_soal)
						FROM exam_packages WHERE ujian_id = $1 AND siswa_id = $2`, c.Param("id"), sid)
					if err == nil {
						defer rows.Close()
						for rows.Next() {
							var qid string
							if err := rows.Scan(&qid); err == nil && isUUID(qid) {
								ids = append(ids, qid)
							}
						}
					}
				}
			}
		}
		type opt struct {
			Label string `json:"label"`
			Text  string `json:"text"`
		}
		type item struct {
			ID      string `json:"id"`
			Text    string `json:"text"`
			Options []opt  `json:"options"`
		}
		out := []item{}
		if len(ids) > 0 {
			for _, qid := range ids {
				var it item
				if err := conn.QueryRow("SELECT id, teks_html FROM questions WHERE id = $1", qid).
					Scan(&it.ID, &it.Text); err != nil {
					continue
				}
				it.Options = []opt{}
				rows, err := conn.Query(`SELECT label, teks_html FROM question_options
					WHERE question_id = $1 ORDER BY label`, qid)
				if err == nil {
					for rows.Next() {
						var o opt
						if err := rows.Scan(&o.Label, &o.Text); err == nil {
							it.Options = append(it.Options, o)
						}
					}
					rows.Close()
				}
				out = append(out, it)
			}
		} else {
			rows, err := conn.Query(`SELECT id, teks_html FROM questions ORDER BY teks_html LIMIT $1`, jumlah)
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var it item
					if err := rows.Scan(&it.ID, &it.Text); err != nil {
						continue
					}
					it.Options = []opt{}
					orows, err := conn.Query(`SELECT label, teks_html FROM question_options
						WHERE question_id = $1 ORDER BY label`, it.ID)
					if err == nil {
						for orows.Next() {
							var o opt
							if err := orows.Scan(&o.Label, &o.Text); err == nil {
								it.Options = append(it.Options, o)
							}
						}
						orows.Close()
					}
					out = append(out, it)
				}
			}
		}
		c.JSON(200, gin.H{"questions": out})
	})

	// Daftar hasil — baris exam_results + identitas siswa (siswa hanya miliknya sendiri)
	v1.GET("/hasil", middleware.RequireRole(), func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		userVal, _ := c.Get("user_id")
		userID, _ := userVal.(string)

		q := `SELECT s.nis, s.nama, COALESCE(k.nama,''), er.benar, er.salah, er.kosong, er.nilai, er.id
			FROM exam_results er
			JOIN exam_packages ep ON ep.id = er.exam_package_id
			JOIN siswa s ON s.id = ep.siswa_id
			LEFT JOIN kelas k ON k.id = s.kelas_id`
		args := []any{}
		clauses := []string{}
		if ujian := c.Query("ujian"); ujian != "" {
			args = append(args, ujian)
			clauses = append(clauses, fmt.Sprintf("ep.ujian_id = $%d", len(args)))
		}
		if kelas := c.Query("kelas"); kelas != "" {
			args = append(args, kelas)
			clauses = append(clauses, fmt.Sprintf("k.nama = $%d", len(args)))
		}
		if role == "siswa" {
			var siswaID string
			if err := conn.QueryRow("SELECT id FROM siswa WHERE user_id = $1", userID).Scan(&siswaID); err != nil {
				c.JSON(200, gin.H{"hasil": []any{}})
				return
			}
			args = append(args, siswaID)
			clauses = append(clauses, fmt.Sprintf("s.id = $%d", len(args)))
		}
		if len(clauses) > 0 {
			q += " WHERE " + strings.Join(clauses, " AND ")
		}
		q += " ORDER BY s.nis LIMIT 1000"

		rows, err := conn.Query(q, args...)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()
		type item struct {
			NIS      string  `json:"nis"`
			Nama     string  `json:"nama"`
			Kelas    string  `json:"kelas"`
			Benar    int     `json:"benar"`
			Salah    int     `json:"salah"`
			Kosong   int     `json:"kosong"`
			Nilai    float64 `json:"nilai"`
			ResultID string  `json:"result_id"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.NIS, &it.Nama, &it.Kelas, &it.Benar, &it.Salah, &it.Kosong, &it.Nilai, &it.ResultID); err == nil {
				out = append(out, it)
			}
		}
		c.JSON(200, gin.H{"hasil": out})
	})

	// Preview soal import — wired to parser.ParseLine (admin, guru)
	v1.POST("/soal/import/preview", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		var in struct {
			Lines []string `json:"lines"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		type parsed struct {
			Line     string          `json:"line"`
			Question *parser.Question `json:"question,omitempty"`
			Option   *parser.Option   `json:"option,omitempty"`
		}
		out := make([]parsed, 0, len(in.Lines))
		for _, l := range in.Lines {
			q, o := parser.ParseLine(l)
			out = append(out, parsed{Line: l, Question: q, Option: o})
		}
		c.JSON(200, gin.H{"results": out})
	})

	// Create ujian — simpan jadwal + terbitkan paket per siswa asli (admin, guru)
	v1.POST("/ujian", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		var in struct {
			Judul       string   `json:"judul"`
			Mapel       string   `json:"mapel"`
			Mulai       string   `json:"mulai"`
			Selesai     string   `json:"selesai"`
			DurasiMenit int      `json:"durasi_menit"`
			Kelas       []string `json:"kelas"`
			JumlahSoal  int      `json:"jumlah_soal"`
			Token       string   `json:"token"`
			RequireSEB  bool     `json:"require_seb"`
			SEBKey      string   `json:"seb_config_key"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		mulai, _ := time.Parse(time.RFC3339, in.Mulai)
		selesai, _ := time.Parse(time.RFC3339, in.Selesai)
		if err := ujian.Validate(in.Judul, mulai, selesai, in.DurasiMenit); err != nil {
			c.JSON(422, gin.H{"error": gin.H{"code": "VALIDATION", "message": err.Error()}})
			return
		}
		if len(in.Kelas) == 0 {
			c.JSON(422, gin.H{"error": gin.H{"code": "VALIDATION", "message": "pilih minimal 1 kelas"}})
			return
		}

		var ujianID string
		sebKey := strings.TrimSpace(in.SEBKey)
		if in.RequireSEB && sebKey == "" {
			sebKey = sebKeyAcak()
		}
		if err := conn.QueryRow(`INSERT INTO ujian(judul, mapel, durasi_menit, mulai_at, selesai_at,
			jumlah_soal, acak_soal, acak_opsi, token, require_seb, seb_config_key, status)
			VALUES($1,$2,$3,$4,$5,$6,true,true,$7,$8,$9,'BERJALAN') RETURNING id`,
			in.Judul, in.Mapel, in.DurasiMenit, mulai, selesai, in.JumlahSoal, in.Token,
			in.RequireSEB, sebKey).Scan(&ujianID); err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}

		// Siswa asli dari kelas terpilih (bukan dummy).
		srows, err := conn.Query(`SELECT s.id FROM siswa s JOIN kelas k ON k.id = s.kelas_id
			WHERE k.nama = ANY($1) ORDER BY s.nis`, pq.Array(in.Kelas))
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		siswaIDs := []string{}
		for srows.Next() {
			var sid string
			if err := srows.Scan(&sid); err == nil {
				siswaIDs = append(siswaIDs, sid)
			}
		}
		srows.Close()
		if len(siswaIDs) == 0 {
			c.JSON(422, gin.H{"error": gin.H{"code": "VALIDATION", "message": "tidak ada siswa di kelas terpilih"}})
			return
		}

		// Bank soal asli (bobot kunci sudah di question_options).
		limit := in.JumlahSoal
		if limit <= 0 {
			limit = 50
		}
		qrows, err := conn.Query(`SELECT id FROM questions ORDER BY teks_html LIMIT $1`, limit)
		soalIDs := []string{}
		if err == nil {
			for qrows.Next() {
				var qid string
				if err := qrows.Scan(&qid); err == nil {
					soalIDs = append(soalIDs, qid)
				}
			}
			qrows.Close()
		}

		pkgs := ujian.BuildPackages(ujianID, siswaIDs, soalIDs, in.JumlahSoal, mulai.UnixNano())
		terbit := 0
		for _, p := range pkgs {
			urutan, _ := json.Marshal(p.SoalIDs)
			if urutan == nil {
				urutan = []byte("[]")
			}
			if _, err := conn.Exec(`INSERT INTO exam_packages(ujian_id, siswa_id, urutan_soal, status)
				VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(ujian_id, siswa_id) DO NOTHING`,
				ujianID, p.SiswaID, string(urutan)); err == nil {
				terbit++
			}
		}
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "create_ujian", in.Judul)
		c.JSON(201, gin.H{"ujian_id": ujianID, "packages": terbit, "siswa": len(siswaIDs),
			"soal": len(soalIDs), "require_seb": in.RequireSEB, "seb_config_key": sebKey})
	})

	// Sinkronisasi semi-daring ala ANBK (server lab + snapshot cadangan):
	// status baca + snapshot tulis JSON ke /storage/sync (volume persisten).
	v1.GET("/sync/status", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		var siswa, pkgAktif, pkgTotal, answers, results int
		_ = conn.QueryRow("SELECT COUNT(*) FROM siswa").Scan(&siswa)
		_ = conn.QueryRow("SELECT COUNT(*) FROM exam_packages WHERE status = 'ACTIVE'").Scan(&pkgAktif)
		_ = conn.QueryRow("SELECT COUNT(*) FROM exam_packages").Scan(&pkgTotal)
		_ = conn.QueryRow("SELECT COUNT(*) FROM exam_answers").Scan(&answers)
		_ = conn.QueryRow("SELECT COUNT(*) FROM exam_results").Scan(&results)
		var lastSnap any = nil
		if fi, err := os.Stat("/storage/sync/latest.json"); err == nil {
			lastSnap = fi.ModTime().UTC()
		}
		c.JSON(200, gin.H{"server_now": time.Now().UTC(), "siswa": siswa,
			"packages_active": pkgAktif, "packages_total": pkgTotal,
			"answers": answers, "results": results, "last_snapshot_at": lastSnap})
	})
	v1.POST("/sync/snapshot", middleware.RequireRole("admin"), func(c *gin.Context) {
		_ = os.MkdirAll("/storage/sync", 0o755)
		dump := func(q string) []map[string]any {
			rows, err := conn.Query(q)
			if err != nil {
				return nil
			}
			defer rows.Close()
			cols, _ := rows.Columns()
			out := []map[string]any{}
			for rows.Next() {
				vals := make([]any, len(cols))
				ptrs := make([]any, len(cols))
				for i := range vals {
					ptrs[i] = &vals[i]
				}
				if err := rows.Scan(ptrs...); err != nil {
					continue
				}
				row := map[string]any{}
				for i, col := range cols {
					if b, ok := vals[i].([]byte); ok {
						row[col] = string(b)
					} else {
						row[col] = vals[i]
					}
				}
				out = append(out, row)
			}
			return out
		}
		snap := map[string]any{
			"at":             time.Now().UTC(),
			"exam_packages":  dump("SELECT * FROM exam_packages"),
			"exam_answers":   dump("SELECT * FROM exam_answers"),
			"exam_results":   dump("SELECT * FROM exam_results"),
			"exam_violations": dump("SELECT * FROM exam_violations"),
		}
		data, _ := json.Marshal(snap)
		name := fmt.Sprintf("/storage/sync/snapshot-%s.json", time.Now().UTC().Format("20060102-150405"))
		if err := os.WriteFile(name, data, 0o644); err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "IO_ERROR", "message": err.Error()}})
			return
		}
		_ = os.WriteFile("/storage/sync/latest.json", data, 0o644)
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "sync_snapshot", name)
		c.JSON(200, gin.H{"ok": true, "file": name, "bytes": len(data),
			"packages": len(snap["exam_packages"].([]map[string]any)),
			"answers":  len(snap["exam_answers"].([]map[string]any))})
	})

	// Daftar ujian ringkas untuk dropdown (admin, guru, proktor).
	v1.GET("/ujian", middleware.RequireRole("admin", "guru", "proktor"), func(c *gin.Context) {
		rows, err := conn.Query(`SELECT id, judul, mapel, status,
			COALESCE(require_seb,false) FROM ujian ORDER BY mulai_at DESC LIMIT 100`)
		type ringkas struct {
			ID         string `json:"id"`
			Judul      string `json:"judul"`
			Mapel      string `json:"mapel"`
			Status     string `json:"status"`
			RequireSEB bool   `json:"require_seb"`
		}
		out := []ringkas{}
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var u ringkas
				if err := rows.Scan(&u.ID, &u.Judul, &u.Mapel, &u.Status, &u.RequireSEB); err == nil {
					out = append(out, u)
				}
			}
		}
		c.JSON(200, gin.H{"ujian": out})
	})

	// Analisis butir soal ala ExamSoft (admin, guru, proktor):
	// tingkat kesukaran, daya beda (27% atas-bawah), efektivitas pengecoh,
	// dan Cronbach's Alpha — murni dari jawaban + kunci di DB.
	v1.GET("/ujian/:id/analisis", middleware.RequireRole("admin", "guru", "proktor"), func(c *gin.Context) {
		ujianID := resolveUjian(c.Param("id"))
		if !isUUID(ujianID) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "id ujian tidak valid"}})
			return
		}
		// Paket + kunci + jawaban.
		pkgIDs := []string{}
		prows, err := conn.Query(`SELECT id FROM exam_packages WHERE ujian_id = $1`, ujianID)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		for prows.Next() {
			var pid string
			if err := prows.Scan(&pid); err == nil {
				pkgIDs = append(pkgIDs, pid)
			}
		}
		prows.Close()
		if len(pkgIDs) == 0 {
			c.JSON(200, gin.H{"ujian_id": ujianID, "n_siswa": 0, "alpha": nil, "items": []any{}})
			return
		}
		// Soal dalam cakupan paket (urutan unik).
		qrows, err := conn.Query(`SELECT DISTINCT q.id, q.teks_html
			FROM exam_packages ep, jsonb_array_elements_text(ep.urutan_soal) u(qid)
			JOIN questions q ON q.id = u.qid::uuid
			WHERE ep.ujian_id = $1 ORDER BY q.teks_html`, ujianID)
		type soal struct {
			ID   string
			Teks string
		}
		soals := []soal{}
		if err == nil {
			for qrows.Next() {
				var s soal
				if err := qrows.Scan(&s.ID, &s.Teks); err == nil {
					soals = append(soals, s)
				}
			}
			qrows.Close()
		}
		// Kunci + semua opsi (untuk pengecoh).
		kunci := map[string]string{}
		opsiSemua := map[string][]string{}
		krows, err := conn.Query(`SELECT question_id, label, is_kunci FROM question_options
			WHERE question_id IN (SELECT DISTINCT u.qid::uuid FROM exam_packages ep,
			jsonb_array_elements_text(ep.urutan_soal) u(qid) WHERE ep.ujian_id = $1)
			ORDER BY question_id, label`, ujianID)
		if err == nil {
			for krows.Next() {
				var qid, label string
				var isKunci bool
				if err := krows.Scan(&qid, &label, &isKunci); err == nil {
					opsiSemua[qid] = append(opsiSemua[qid], label)
					if isKunci && kunci[qid] == "" {
						kunci[qid] = label
					}
				}
			}
			krows.Close()
		}
		// Jawaban per paket: ambil opsi pertama yang dipilih.
		jawab := map[string]map[string]string{} // pkg -> qid -> label
		arows, err := conn.Query(`SELECT exam_package_id, question_id,
			opsi_dipilih[1] FROM exam_answers WHERE exam_package_id = ANY($1)`, pq.Array(pkgIDs))
		if err == nil {
			for arows.Next() {
				var pid, qid string
				var lbl sql.NullString
				if err := arows.Scan(&pid, &qid, &lbl); err == nil && lbl.Valid {
					if jawab[pid] == nil {
						jawab[pid] = map[string]string{}
					}
					jawab[pid][qid] = lbl.String
				}
			}
			arows.Close()
		}
		// Matriks skor 0/1 + total per siswa, urut menurun untuk daya beda.
		type baris struct {
			total int
			skor  []int
		}
		barisList := []baris{}
		for _, pid := range pkgIDs {
			b := baris{skor: make([]int, len(soals))}
			for j, s := range soals {
				if jawab[pid][s.ID] != "" && jawab[pid][s.ID] == kunci[s.ID] {
					b.skor[j] = 1
					b.total++
				}
			}
			barisList = append(barisList, b)
		}
		for i := 0; i < len(barisList); i++ {
			for j := i + 1; j < len(barisList); j++ {
				if barisList[j].total > barisList[i].total {
					barisList[i], barisList[j] = barisList[j], barisList[i]
				}
			}
		}
		matriks := make([][]int, len(barisList))
		for i, b := range barisList {
			matriks[i] = b.skor
		}
		alpha := analisis.AlphaCronbach(matriks)
		type itemAnalisis struct {
			QuestionID string         `json:"question_id"`
			Teks       string         `json:"teks"`
			N          int            `json:"n"`
			Benar      int            `json:"benar"`
			TK         float64        `json:"tk"`
			TKLabel    string         `json:"tk_label"`
			DayaBeda   float64        `json:"daya_beda"`
			DBLabel    string         `json:"db_label"`
			Pengecoh   map[string]int `json:"pengecoh"`
		}
		items := []itemAnalisis{}
		for j, s := range soals {
			kolom := make([]int, len(barisList))
			benar := 0
			pengecoh := map[string]int{}
			for _, l := range opsiSemua[s.ID] {
				pengecoh[l] = 0
			}
			for i, b := range barisList {
				kolom[i] = b.skor[j]
				benar += b.skor[j]
			}
			for _, pid := range pkgIDs {
				if l := jawab[pid][s.ID]; l != "" {
					pengecoh[l]++
				}
			}
			var tk float64
			if len(barisList) > 0 {
				tk = float64(benar) / float64(len(barisList))
			}
			// Bulatkan 2 desimal untuk tampilan.
			tk = float64(int(tk*100+0.5)) / 100
			db := analisis.DayaBeda(kolom)
			db = float64(int(db*100+0.5)) / 100
			if db < 0 {
				db = float64(int(db*100-0.5)) / 100
			}
			teks := s.Teks
			if len(teks) > 90 {
				teks = teks[:90] + "…"
			}
			items = append(items, itemAnalisis{
				QuestionID: s.ID, Teks: teks, N: len(barisList), Benar: benar,
				TK: tk, TKLabel: analisis.LabelTK(tk),
				DayaBeda: db, DBLabel: analisis.LabelDayaBeda(db),
				Pengecoh: pengecoh,
			})
		}
		var alphaOut any = nil
		if alpha >= 0 {
			alphaOut = float64(int(alpha*100+0.5)) / 100
		}
		c.JSON(200, gin.H{"ujian_id": ujianID, "n_siswa": len(pkgIDs), "alpha": alphaOut, "items": items})
	})

	// SEB config: baca + ubah kewajiban SEB per ujian (admin, guru).
	// PUT boleh kosongkan kunci bila require_seb=false; bila true + kunci kosong → generate.
	v1.GET("/ujian/:id/seb-config", middleware.RequireRole("admin", "guru", "proktor"), func(c *gin.Context) {
		id := resolveUjian(c.Param("id"))
		if !isUUID(id) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "id ujian tidak valid"}})
			return
		}
		var required bool
		var key string
		if err := conn.QueryRow(`SELECT COALESCE(require_seb,false), COALESCE(seb_config_key,'')
			FROM ujian WHERE id = $1`, id).Scan(&required, &key); err != nil {
			c.JSON(404, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "ujian tidak ditemukan"}})
			return
		}
		c.JSON(200, gin.H{"ujian_id": id, "require_seb": required, "seb_config_key": key})
	})
	v1.PUT("/ujian/:id/seb-config", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		id := resolveUjian(c.Param("id"))
		if !isUUID(id) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "id ujian tidak valid"}})
			return
		}
		var in struct {
			RequireSEB *bool  `json:"require_seb"`
			SEBKey     string `json:"seb_config_key"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		var required bool
		var key string
		_ = conn.QueryRow(`SELECT COALESCE(require_seb,false), COALESCE(seb_config_key,'')
			FROM ujian WHERE id = $1`, id).Scan(&required, &key)
		if in.RequireSEB != nil {
			required = *in.RequireSEB
		}
		key = strings.TrimSpace(in.SEBKey)
		if required && key == "" {
			var existing string
			_ = conn.QueryRow(`SELECT COALESCE(seb_config_key,'') FROM ujian WHERE id = $1`, id).Scan(&existing)
			key = existing
			if key == "" {
				key = sebKeyAcak()
			}
		}
		if _, err := conn.Exec(`UPDATE ujian SET require_seb = $1, seb_config_key = $2 WHERE id = $3`,
			required, key, id); err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "seb_config", id)
		c.JSON(200, gin.H{"ujian_id": id, "require_seb": required, "seb_config_key": key})
	})

	// Get hasil — wired to hasil.NilaiPG stub + export.ResultDir (admin, guru)
	v1.GET("/hasil/:id", middleware.RequireRole("admin", "guru"), func(c *gin.Context) {
		// stub contoh data
		kunci := map[string][]string{"q1": {"B"}, "q2": {"A", "C"}, "q3": {"D"}}
		jawab := map[string][]string{"q1": {"B"}, "q2": {"A"}, "q3": {"D"}}
		bobot := map[string]int{"q1": 10, "q2": 20, "q3": 10}
		nilai, benar, salah, kosong := hasil.NilaiPG(kunci, jawab, bobot)
		folder := export.ResultDir("2025-2026", "uts-matematika", "XII-IPA-1", "12345", "Ahmad Bin Azis")
		c.JSON(200, gin.H{
			"hasil_id":    c.Param("id"),
			"nilai":       nilai,
			"benar":       benar,
			"salah":       salah,
			"kosong":      kosong,
			"folder_path": "/storage/hasil/" + folder,
		})
	})

	// Proktor: live monitoring — baca exam_packages & violations dari DB (admin, proktor)
	v1.GET("/ujian/:id/live", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		ujianID := resolveUjian(c.Param("id"))

		type PesertaLive struct {
			SiswaID   string `json:"siswa_id"`
			Nama      string `json:"nama"`
			NIS       string `json:"nis"`
			Kelas     string `json:"kelas"`
			Status    string `json:"status"`
			FocusLost int    `json:"focus_lost"`
			SisaWaktu *int   `json:"sisa_waktu"`
		}

		rows, err := conn.Query(`
			SELECT s.id, s.nama, s.nis, COALESCE(k.nama,''),
			       ep.status,
			       COALESCE((SELECT COUNT(*) FROM exam_violations ev WHERE ev.exam_package_id = ep.id AND ev.tipe = 'FOCUS_LOST'), 0) as focus_lost,
			       CASE WHEN ep.ends_at IS NULL THEN NULL
			            ELSE GREATEST(0, EXTRACT(EPOCH FROM (ep.ends_at - now()))::int) END as sisa
			FROM exam_packages ep
			JOIN siswa s ON s.id = ep.siswa_id
			LEFT JOIN kelas k ON k.id = s.kelas_id
			WHERE ep.ujian_id = $1`, ujianID)

		var list []PesertaLive
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p PesertaLive
				var sisa sql.NullInt64
				if err := rows.Scan(&p.SiswaID, &p.Nama, &p.NIS, &p.Kelas, &p.Status, &p.FocusLost, &sisa); err == nil {
					if sisa.Valid {
						v := int(sisa.Int64)
						p.SisaWaktu = &v
					}
					list = append(list, p)
				}
			}
		}
		if list == nil {
			list = []PesertaLive{}
		}

		c.JSON(200, gin.H{
			"ujian_id":   ujianID,
			"peserta":    list,
			"server_now": time.Now().UTC(),
		})
	})

	// Proktor: tambah waktu (PRD §6.5 / §6.7) — geser ends_at SEMUA paket
	// ACTIVE ujian ini di DB, bukan sekadar log (admin, proktor)
	v1.POST("/ujian/:id/extend", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		var in struct {
			Menit int `json:"menit"`
		}
		_ = c.ShouldBindJSON(&in)
		if in.Menit <= 0 {
			in.Menit = 10
		}
		ujianID := resolveUjian(c.Param("id"))
		res, err := conn.Exec(`UPDATE exam_packages
			SET ends_at = COALESCE(ends_at, now()) + ($2 * interval '1 minute')
			WHERE ujian_id = $1 AND status = 'ACTIVE'`, ujianID, in.Menit)
		var n int64
		if err == nil {
			n, _ = res.RowsAffected()
		} else {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		fmt.Printf("[EXTEND] ujian=%s +%d menit (%d paket)\n", ujianID, in.Menit, n)
		c.JSON(200, gin.H{"ok": true, "ujian_id": ujianID, "extended_menit": in.Menit, "packages": n})
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "extend", fmt.Sprintf("ujian=%s +%d menit (%d paket)", ujianID, in.Menit, n))
	})

	// Proktor: buka blokir / reset sesi siswa (PC hang, salah ter-submit):
	// hapus catatan pelanggaran paketnya + kembalikan status ACTIVE.
	// Jawaban yang sudah masuk TIDAK dihapus.
	// (admin, proktor)
	v1.POST("/ujian/:id/unblock", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		var in struct {
			SiswaID string `json:"siswa_id"`
			NIS     string `json:"nis"`
		}
		_ = c.ShouldBindJSON(&in)
		if in.SiswaID == "" && in.NIS != "" {
			_ = conn.QueryRow("SELECT id FROM siswa WHERE nis = $1", in.NIS).Scan(&in.SiswaID)
		}
		if in.SiswaID == "" {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "siswa_id/nis wajib"}})
			return
		}
		var pkgID string
		err := conn.QueryRow(`SELECT id FROM exam_packages WHERE ujian_id = $1 AND siswa_id = $2`,
			resolveUjian(c.Param("id")), in.SiswaID).Scan(&pkgID)
		if err != nil {
			c.JSON(404, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "paket ujian siswa tidak ditemukan"}})
			return
		}
		_, _ = conn.Exec("DELETE FROM exam_violations WHERE exam_package_id = $1", pkgID)
		_, _ = conn.Exec("UPDATE exam_packages SET status = 'ACTIVE' WHERE id = $1", pkgID)
		fmt.Printf("[UNBLOCK] ujian=%s siswa=%s pkg=%s\n", resolveUjian(c.Param("id")), in.SiswaID, pkgID)
		c.JSON(200, gin.H{"ok": true, "ujian_id": resolveUjian(c.Param("id")), "siswa_id": in.SiswaID, "action": "UNBLOCK"})
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "unblock", in.SiswaID)
	})

	// Proktor: paksa submit siswa — nilai dari DB + kunci paket SELESAI,
	// sama seperti finish mandiri (terima siswa_id UUID maupun NIS) (admin, proktor)
	v1.POST("/ujian/:id/force-submit", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		var in struct {
			SiswaID string `json:"siswa_id"`
			NIS     string `json:"nis"`
		}
		_ = c.ShouldBindJSON(&in)
		// Frontend proktor mengirim NIS; terima keduanya.
		siswaID := in.SiswaID
		if !isUUID(siswaID) && in.NIS == "" {
			in.NIS = in.SiswaID
			siswaID = ""
		}
		if siswaID == "" && in.NIS != "" {
			_ = conn.QueryRow("SELECT id FROM siswa WHERE nis = $1", in.NIS).Scan(&siswaID)
		}
		if !isUUID(siswaID) {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": "siswa_id/nis wajib"}})
			return
		}
		ujianID := resolveUjian(c.Param("id"))
		var pkgID, st string
		if err := conn.QueryRow(`SELECT id, status FROM exam_packages
			WHERE ujian_id = $1 AND siswa_id = $2`, ujianID, siswaID).Scan(&pkgID, &st); err != nil {
			c.JSON(404, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "paket ujian siswa tidak ditemukan"}})
			return
		}
		if st == "SELESAI" {
			// Idempoten: kembalikan nilai tersimpan, bukan error.
			var nilai, benar, salah, kosong int
			_ = conn.QueryRow(`SELECT nilai, benar, salah, kosong FROM exam_results
				WHERE exam_package_id = $1`, pkgID).Scan(&nilai, &benar, &salah, &kosong)
			c.JSON(200, gin.H{"ok": true, "ujian_id": ujianID, "siswa_id": siswaID,
				"action": "FORCE_SUBMIT", "already": true,
				"nilai": nilai, "benar": benar, "salah": salah, "kosong": kosong})
			return
		}

		// Penilaian server-side dari question_options (kunci tak pernah ke browser).
		kunci := make(map[string][]string)
		jawab := make(map[string][]string)
		bobot := make(map[string]int)
		rows, err := conn.Query(`
			SELECT q.id, q.bobot, qo.label, ea.opsi_dipilih
			FROM questions q
			LEFT JOIN question_options qo ON qo.question_id = q.id AND qo.is_kunci = true
			LEFT JOIN exam_answers ea ON ea.question_id = q.id AND ea.exam_package_id = $1
			WHERE q.id IN (
				SELECT jsonb_array_elements_text(urutan_soal)::uuid FROM exam_packages WHERE id = $1
			)`, pkgID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var qid string
				var b int
				var keyLbl sql.NullString
				var ansArr []string
				if err := rows.Scan(&qid, &b, &keyLbl, (*pqStringArray)(&ansArr)); err == nil {
					bobot[qid] = b
					if keyLbl.Valid {
						kunci[qid] = append(kunci[qid], keyLbl.String)
					}
					if len(ansArr) > 0 {
						jawab[qid] = ansArr
					}
				}
			}
		}
		nilai, benar, salah, kosong := hasil.NilaiPG(kunci, jawab, bobot)

		var tahunAjaran, judulUjian, namaKelas, nis, namaSiswa string
		tahunAjaran, judulUjian, namaKelas, nis, namaSiswa = "2025/2026", "ujian-"+ujianID, "umum", "00000", "siswa"
		_ = conn.QueryRow(`
			SELECT u.judul, k.tahun_ajaran, k.nama, s.nis, s.nama
			FROM exam_packages ep
			JOIN ujian u ON u.id = ep.ujian_id
			JOIN siswa s ON s.id = ep.siswa_id
			LEFT JOIN kelas k ON k.id = s.kelas_id
			WHERE ep.id = $1`, pkgID).Scan(&judulUjian, &tahunAjaran, &namaKelas, &nis, &namaSiswa)
		folderPath := export.ResultDir(tahunAjaran, judulUjian, namaKelas, nis, namaSiswa)
		_, _ = conn.Exec(`
			INSERT INTO exam_results(exam_package_id, nilai, benar, salah, kosong, folder_path)
			VALUES($1, $2, $3, $4, $5, $6)
			ON CONFLICT(exam_package_id)
			DO UPDATE SET nilai=EXCLUDED.nilai, benar=EXCLUDED.benar, salah=EXCLUDED.salah, kosong=EXCLUDED.kosong, folder_path=EXCLUDED.folder_path`,
			pkgID, nilai, benar, salah, kosong, folderPath)
		_, _ = conn.Exec("UPDATE exam_packages SET status = 'SELESAI' WHERE id = $1", pkgID)

		fmt.Printf("[FORCE-SUBMIT] ujian=%s siswa=%s nilai=%v\n", ujianID, siswaID, nilai)
		c.JSON(200, gin.H{"ok": true, "ujian_id": ujianID, "siswa_id": siswaID,
			"action": "FORCE_SUBMIT", "nilai": nilai, "benar": benar, "salah": salah, "kosong": kosong})
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "force_submit", siswaID)
	})

	// Pengumuman polling: POST broadcast, GET poll (in-memory store)
	v1.POST("/ujian/:id/announce", middleware.RequireRole("admin", "proktor"), func(c *gin.Context) {
		var in struct {
			Message string `json:"message"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(400, gin.H{"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
			return
		}
		msg := strings.TrimSpace(in.Message)
		if msg == "" || len(msg) > 150 {
			c.JSON(422, gin.H{"error": gin.H{"code": "VALIDATION", "message": "message wajib, maks 150 karakter"}})
			return
		}
		e := announce.Set(resolveUjian(c.Param("id")), msg)
		actor, _ := c.Get("username")
		audit.Log(conn, fmt.Sprintf("%v", actor), "announce", fmt.Sprintf("ujian=%s", resolveUjian(c.Param("id"))))
		c.JSON(200, e)
	})
	v1.GET("/ujian/:id/announcement", middleware.RequireRole(), func(c *gin.Context) {
		c.JSON(200, announce.Get(resolveUjian(c.Param("id"))))
	})

	// Audit: 10 baris terakhir (admin only)
	v1.GET("/audit/recent", middleware.RequireRole("admin"), func(c *gin.Context) {
		rows, err := conn.Query(`SELECT actor, aksi, target, at FROM audit_logs ORDER BY at DESC LIMIT 10`)
		if err != nil {
			c.JSON(500, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()
		type row struct {
			Actor  string `json:"actor"`
			Aksi   string `json:"aksi"`
			Target string `json:"target"`
			At     string `json:"at"`
		}
		out := []row{}
		for rows.Next() {
			var r row
			var at time.Time
			if err := rows.Scan(&r.Actor, &r.Aksi, &r.Target, &at); err == nil {
				r.At = at.Format(time.RFC3339)
				out = append(out, r)
			}
		}
		c.JSON(200, gin.H{"logs": out})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	_ = http.ListenAndServe(":"+port, r)
}

// demoUjianID adalah ujian bank contoh dari seed (seedDemoBank).
// Frontend memakai alias "demo" agar proktor/siswa tak perlu menghafal UUID;
// resolveUjian menormalkannya sebelum query.
const demoUjianID = "11111111-1111-1111-1111-111111111111"

func resolveUjian(id string) string {
	if id == "demo" {
		return demoUjianID
	}
	return id
}

// sebKeyAcak membuat kunci config 16-byte (hex) untuk ditempel ke SEB.
func sebKeyAcak() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("seb-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b[:])
}

// sebGuard menolak browser biasa bila ujian mewajibkan SEB.
// Klien SEB asli mengirim header X-SafeExamBrowser-ConfigKeyHash.
// Mengembalikan false + 403 bila ditolak (handler harus return).
func sebGuard(c *gin.Context, conn *sql.DB, ujianID string) bool {
	var required bool
	var key string
	if err := conn.QueryRow(`SELECT COALESCE(require_seb,false), COALESCE(seb_config_key,'')
		FROM ujian WHERE id = $1`, ujianID).Scan(&required, &key); err != nil || !required {
		return true
	}
	if key != "" && c.GetHeader("X-SafeExamBrowser-ConfigKeyHash") == key {
		return true
	}
	c.JSON(403, gin.H{"error": gin.H{"code": "SEB_REQUIRED",
		"message": "ujian ini wajib dibuka melalui Safe Exam Browser (SEB)"}})
	return false
}

// pqStringArray scans text array from Postgres into []string
type pqStringArray []string

func (a *pqStringArray) Scan(src any) error {
	if src == nil {
		*a = []string{}
		return nil
	}
	var s string
	switch v := src.(type) {
	case string:
		s = v
	case []byte:
		s = string(v)
	default:
		return fmt.Errorf("pqStringArray: unsupported type %T", src)
	}
	if len(s) < 2 {
		*a = []string{}
		return nil
	}
	// trim { and }
	s = s[1 : len(s)-1]
	if s == "" {
		*a = []string{}
		return nil
	}
	parts := fmt.Sprintf("%v", s)
	*a = nil
	for _, p := range fmt.Sprintf("%v", parts) {
		_ = p
	}
	// simple CSV split for PG array format
	var result []string
	for _, item := range splitPGArray(s) {
		result = append(result, item)
	}
	*a = result
	return nil
}

// isUUID reports whether s looks like a UUID (36-char hex+dash).
// Guards SQL before Postgres rejects with a cryptic 500.
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		switch {
		case i == 8 || i == 13 || i == 18 || i == 23:
			if r != '-' {
				return false
			}
		case r >= '0' && r <= '9' || r >= 'a' && r <= 'f' || r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}

func splitPGArray(s string) []string {	if s == "" {
		return nil
	}
	var res []string
	var cur []rune
	inQuote := false
	for _, r := range s {
		switch {
		case r == '"':
			inQuote = !inQuote
		case r == ',' && !inQuote:
			res = append(res, string(cur))
			cur = nil
		default:
			cur = append(cur, r)
		}
	}
	if len(cur) > 0 {
		res = append(res, string(cur))
	}
	return res
}
