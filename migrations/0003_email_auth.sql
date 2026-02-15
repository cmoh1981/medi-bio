-- Migration: Convert from Kakao OAuth to Email/Password authentication
-- Also removes subscription tiers (all content now free)

-- Create new users table with email/password auth
CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  profile_image TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing users (if any) - they'll need to reset password
INSERT OR IGNORE INTO users_new (id, email, password_hash, nickname, profile_image, created_at, updated_at)
SELECT id, COALESCE(email, kakao_id || '@kakao.migrated'), '', nickname, profile_image, created_at, updated_at
FROM users WHERE email IS NOT NULL;

-- Drop old table and rename new one
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;

-- Update articles table - remove tier restriction (all free now)
-- We keep the tier column but it's just for display purposes

-- Recreate indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
