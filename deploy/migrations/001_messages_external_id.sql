-- Idempotent migration: add external_id for Meta WhatsApp message ids (wamid)
-- Safe to run on every container start.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique
  ON messages (external_id)
  WHERE external_id IS NOT NULL;
