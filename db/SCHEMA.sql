-- CBT-BINAZ SCHEMA v1.0 (PostgreSQL 15)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','guru','siswa','proktor')),
  nama TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kelas(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT UNIQUE NOT NULL,
  tahun_ajaran TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS siswa(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nis TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  kelas_id UUID REFERENCES kelas(id),
  jk CHAR(1) CHECK(jk IN ('L','P'))
);
CREATE TABLE IF NOT EXISTS bank_uploads(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  mapel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  total_soal INT DEFAULT 0,
  gagal INT DEFAULT 0,
  by_user UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS questions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_upload_id UUID REFERENCES bank_uploads(id),
  mapel TEXT NOT NULL,
  kelas TEXT NOT NULL DEFAULT '',
  tipe TEXT NOT NULL DEFAULT 'PG',
  teks_html TEXT NOT NULL,
  bobot INT NOT NULL DEFAULT 10,
  kesulitan TEXT DEFAULT 'sedang',
  gambar JSONB DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS question_options(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  label CHAR(1) NOT NULL,
  teks_html TEXT NOT NULL,
  is_kunci BOOLEAN DEFAULT false,
  urutan INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ujian(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  mapel TEXT NOT NULL,
  durasi_menit INT NOT NULL,
  mulai_at TIMESTAMPTZ NOT NULL,
  selesai_at TIMESTAMPTZ NOT NULL,
  jumlah_soal INT NOT NULL DEFAULT 0,
  acak_soal BOOLEAN DEFAULT true,
  acak_opsi BOOLEAN DEFAULT true,
  token TEXT,
  require_seb BOOLEAN DEFAULT false,
  max_focus_lost INT DEFAULT 5,
  status TEXT DEFAULT 'DRAFT'
);
CREATE TABLE IF NOT EXISTS ujian_kelas(
  ujian_id UUID REFERENCES ujian(id) ON DELETE CASCADE,
  kelas_id UUID REFERENCES kelas(id) ON DELETE CASCADE,
  PRIMARY KEY(ujian_id, kelas_id)
);
CREATE TABLE IF NOT EXISTS exam_packages(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ujian_id UUID REFERENCES ujian(id) ON DELETE CASCADE,
  siswa_id UUID REFERENCES siswa(id) ON DELETE CASCADE,
  urutan_soal JSONB NOT NULL DEFAULT '[]',
  seed INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE',
  UNIQUE(ujian_id, siswa_id)
);
CREATE TABLE IF NOT EXISTS exam_answers(
  exam_package_id UUID REFERENCES exam_packages(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id),
  opsi_dipilih CHAR(1)[],
  isian_text TEXT,
  skor NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(exam_package_id, question_id)
);
CREATE TABLE IF NOT EXISTS exam_results(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_package_id UUID UNIQUE REFERENCES exam_packages(id) ON DELETE CASCADE,
  nilai NUMERIC DEFAULT 0,
  benar INT DEFAULT 0,
  salah INT DEFAULT 0,
  kosong INT DEFAULT 0,
  folder_path TEXT,
  pdf_path TEXT,
  released BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS exam_violations(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_package_id UUID REFERENCES exam_packages(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  ip TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  is_locked BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS import_logs(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe TEXT NOT NULL,
  file_name TEXT NOT NULL,
  sukses INT DEFAULT 0,
  gagal INT DEFAULT 0,
  detail JSONB DEFAULT '{}',
  by_user UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siswa_nis ON siswa(nis);
CREATE INDEX IF NOT EXISTS idx_questions_mapel ON questions(mapel, kelas);
CREATE INDEX IF NOT EXISTS idx_answers_pkg ON exam_answers(exam_package_id);
CREATE INDEX IF NOT EXISTS idx_viol_pkg ON exam_violations(exam_package_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ujian_status ON ujian(status, mulai_at);
