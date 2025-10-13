import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || `postgres://postgres:postgres@localhost:5432/chat_e2e`;

export const pool = new Pool({ connectionString });

export async function migrate() {
  // Basic SQL schema (idempotent)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS key_bundles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      identity_key BYTEA NOT NULL,
      signing_key BYTEA,
      signed_prekey BYTEA NOT NULL,
      signed_prekey_sig BYTEA NOT NULL,
  -- campo removido: one_time_prekeys legacy
      published_at TIMESTAMP DEFAULT NOW()
    );

    -- Dedicated one-time prekeys table for atomic consumption
    CREATE TABLE IF NOT EXISTS one_time_prekeys (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      public_key BYTEA NOT NULL,
      consumed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_otpk_user_unconsumed ON one_time_prekeys (user_id) WHERE consumed_at IS NULL;

    -- Simple conversations with shared symmetric keys (educational)
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_a_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      enc_key BYTEA NOT NULL,
      mac_key BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_pair ON conversations (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id));

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      initiator_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      conversation_id TEXT,
      one_time_prekey_id TEXT,
      initiator_identity_key BYTEA,
      initiator_ephemeral_key BYTEA,
      finalized BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Migration: Add conversation_id to existing sessions table
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='sessions' AND column_name='conversation_id') THEN
        ALTER TABLE sessions ADD COLUMN conversation_id TEXT;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      message_id TEXT UNIQUE NOT NULL DEFAULT 'msg_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 8),
      from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      mac TEXT NOT NULL,
      iv TEXT NOT NULL,
  -- campo removido: envelope JSONB legacy
      status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
      message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'key_exchange')),
      created_at TIMESTAMP DEFAULT NOW(),
      delivered_at TIMESTAMP,
      read_at TIMESTAMP
    );

    -- Extend conversations for activity tracking
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='conversations' AND column_name='last_message_id') THEN
        ALTER TABLE conversations ADD COLUMN last_message_id TEXT;
        ALTER TABLE conversations ADD COLUMN last_activity TIMESTAMP DEFAULT NOW();
      END IF;
    END $$;

    -- User presence tracking for last seen
    CREATE TABLE IF NOT EXISTS user_presence (
      username TEXT PRIMARY KEY,
      last_seen TIMESTAMP DEFAULT NOW(),
      last_sync TIMESTAMP DEFAULT NOW(),
      is_online BOOLEAN DEFAULT FALSE
    );

    -- Notifications for real-time updates
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      recipient_username TEXT NOT NULL,
      type TEXT NOT NULL, -- 'new_conversation', 'session_initiated', 'message_received'
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      read_at TIMESTAMP NULL,
      
      FOREIGN KEY (recipient_username) REFERENCES users(username) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_messages_recipient_status ON messages(recipient, status);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations(last_activity DESC);
    CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_username, read_at);
  `);
}
