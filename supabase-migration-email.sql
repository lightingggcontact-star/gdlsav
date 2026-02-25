-- Migration: Gorgias → Zoho IMAP/SMTP
-- Run this in Supabase SQL Editor

-- 1. email_threads (replaces "ticket" concept)
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id TEXT UNIQUE NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'open',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  message_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_customer ON email_threads(customer_email);
CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON email_threads(last_message_at DESC);

-- 2. email_messages
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE NOT NULL,
  in_reply_to TEXT,
  "references" TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  from_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  uid_imap INT,
  attachments JSONB DEFAULT '[]',
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON email_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_imap_uid ON email_messages(uid_imap);

-- 3. email_sync_state (IMAP cursor)
CREATE TABLE IF NOT EXISTS email_sync_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  last_uid INT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO email_sync_state (id, last_uid) VALUES ('main', 0) ON CONFLICT (id) DO NOTHING;

-- 4. Enable realtime on email_messages for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE email_messages;

-- 5. RLS policies (allow all for authenticated/anon since app uses password auth)
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on email_threads" ON email_threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on email_messages" ON email_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on email_sync_state" ON email_sync_state FOR ALL USING (true) WITH CHECK (true);
