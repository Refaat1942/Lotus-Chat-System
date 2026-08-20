-- Idempotent migration: Fratelanza WhatsApp Flow lead qualification fields on customers
-- Safe to run on every container start.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS budget_qualified boolean;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS budget_range text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS project_type text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS project_description text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS flow_name text;
