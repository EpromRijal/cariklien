-- ============================================================
-- Tool CariKlien — skema database (Cloudflare D1)
-- Jalankan sekali waktu bikin database. Lihat PANDUAN-DEPLOY.md.
-- ============================================================

-- Peserta. Diisi oleh admin (Eprom) lewat halaman admin.
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE,
  nama        TEXT    NOT NULL DEFAULT '',
  pin_hash    TEXT    NOT NULL,              -- PIN di-hash, tidak pernah disimpan mentah
  is_admin    INTEGER NOT NULL DEFAULT 0,    -- 1 = Eprom

  -- Pengaturan n8n peserta. Diisi peserta sendiri di halaman Pengaturan.
  webhook_url TEXT    NOT NULL DEFAULT '',
  secret      TEXT    NOT NULL DEFAULT '',   -- password Basic Auth webhook mereka
  sheet_id    TEXT    NOT NULL DEFAULT '',
  setup_ok    INTEGER NOT NULL DEFAULT 0,    -- 1 setelah Tes Koneksi berhasil

  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Riwayat pencarian. Satu baris per klik "Mulai Cari".
CREATE TABLE IF NOT EXISTS jobs (
  id           TEXT    PRIMARY KEY,           -- uuid, dikirim ke n8n sebagai jobId
  user_id      INTEGER NOT NULL,
  source       TEXT    NOT NULL,
  keyword      TEXT    NOT NULL,
  location     TEXT    NOT NULL DEFAULT '',
  country      TEXT    NOT NULL DEFAULT 'ID',
  lim          INTEGER NOT NULL DEFAULT 25,
  status       TEXT    NOT NULL DEFAULT 'running',  -- running | done | error
  count        INTEGER,
  total        INTEGER,
  summary_text TEXT,
  sheet_url    TEXT,
  error_msg    TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  finished_at  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);
