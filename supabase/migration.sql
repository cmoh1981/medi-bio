-- PaperMind Schema for Supabase
-- Run this in Supabase Dashboard > SQL Editor

-- Articles table (bilingual support)
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  source TEXT,
  topic TEXT NOT NULL,
  topic_en TEXT,
  key_messages JSONB NOT NULL DEFAULT '[]',
  key_messages_en JSONB DEFAULT '[]',
  clinical_insight TEXT,
  clinical_insight_en TEXT,
  original_url TEXT,
  published_at DATE NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  lang TEXT DEFAULT 'ko',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- Newsletter send log (tracks which articles were sent)
CREATE TABLE IF NOT EXISTS newsletter_logs (
  id SERIAL PRIMARY KEY,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  article_ids JSONB DEFAULT '[]',
  total_recipients INTEGER DEFAULT 0,
  successful INTEGER DEFAULT 0
);

-- Users table (simple auth)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_notified ON articles(notified);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Enable Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow service role full access, anon read articles
CREATE POLICY "Anyone can read articles" ON articles FOR SELECT USING (true);
CREATE POLICY "Service role full access articles" ON articles FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access subscribers" ON subscribers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anon can insert subscribers" ON subscribers FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access newsletter_logs" ON newsletter_logs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access users" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access sessions" ON sessions FOR ALL USING (true);
