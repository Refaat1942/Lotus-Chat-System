#!/usr/bin/env bash
set -euo pipefail

echo "==> Lotus API container starting"

# ----- 1. Wait for Postgres to be ready -----
echo "==> Waiting for Postgres..."
until pg_isready -h postgres -U "${POSTGRES_USER:-lotus}" -d "${POSTGRES_DB:-lotus}" >/dev/null 2>&1; do
  sleep 1
done
echo "==> Postgres is ready."

# ----- 2. Push the Drizzle schema (idempotent) -----
echo "==> Applying database schema (drizzle-kit push)..."
cd /app/lib/db
pnpm exec drizzle-kit push --config ./drizzle.config.ts || {
  echo "!!! drizzle-kit push failed"
  exit 1
}
cd /app

# ----- 2b. One-time data migration: rename status 'resolved' -> 'completed'.
# Idempotent: only updates rows where the old value is still present.
echo "==> Migrating legacy 'resolved' status to 'completed'..."
PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
  -h postgres \
  -U "${POSTGRES_USER:-lotus}" \
  -d "${POSTGRES_DB:-lotus}" \
  -c "UPDATE conversations SET status='completed' WHERE status='resolved';" \
  >/dev/null 2>&1 || echo "(skip — table may not exist yet)"

# ----- 2c. Seed default role-permission rows (idempotent).
echo "==> Seeding default role permissions..."
PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
  -h postgres \
  -U "${POSTGRES_USER:-lotus}" \
  -d "${POSTGRES_DB:-lotus}" \
  -c "INSERT INTO role_permissions (role, can_view_chats, can_send_messages, can_view_reports, can_manage_customers, can_manage_settings) VALUES ('admin', true, true, true, true, true), ('agent', true, true, false, true, false) ON CONFLICT (role) DO NOTHING;" \
  >/dev/null 2>&1 || echo "(skip — table may not exist yet)"

# ----- 2d. Seed default not-ready reasons (idempotent).
echo "==> Seeding default not-ready reasons..."
PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
  -h postgres \
  -U "${POSTGRES_USER:-lotus}" \
  -d "${POSTGRES_DB:-lotus}" \
  -c "INSERT INTO not_ready_reasons (key, value) VALUES ('BREAK', 'Break'), ('MEETING', 'Meeting'), ('COACHING', 'Coaching'), ('TRAINING', 'Training') ON CONFLICT (key) DO NOTHING;" \
  >/dev/null 2>&1 || echo "(skip — table may not exist yet)"

# ----- 2e. Seed default chat-reason categories (idempotent).
echo "==> Seeding default chat-reason categories..."
PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
  -h postgres \
  -U "${POSTGRES_USER:-lotus}" \
  -d "${POSTGRES_DB:-lotus}" \
  -c "INSERT INTO chat_reason_categories (title_en, title_ar) SELECT v.title_en, v.title_ar FROM (VALUES ('Sales', 'مبيعات'), ('Support', 'دعم فني'), ('Clinical', 'سريري'), ('Complaints', 'شكاوى')) AS v(title_en, title_ar) WHERE NOT EXISTS (SELECT 1 FROM chat_reason_categories c WHERE c.title_en = v.title_en);" \
  >/dev/null 2>&1 || echo "(skip — table may not exist yet)"

# ----- 2f. WhatsApp: external message id (Meta wamid) -----
if [ -f /app/deploy/migrations/001_messages_external_id.sql ]; then
  echo "==> Applying messages external_id migration..."
  PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
    -h postgres \
    -U "${POSTGRES_USER:-lotus}" \
    -d "${POSTGRES_DB:-lotus}" \
    -f /app/deploy/migrations/001_messages_external_id.sql \
    >/dev/null 2>&1 || echo "(skip — migration may have already applied)"
fi

# ----- 2g. WhatsApp Flow: customer lead qualification fields -----
if [ -f /app/deploy/migrations/002_customer_flow_qualification.sql ]; then
  echo "==> Applying customer flow qualification migration..."
  PGPASSWORD="${POSTGRES_PASSWORD:-lotus_dev_password_change_me}" psql \
    -h postgres \
    -U "${POSTGRES_USER:-lotus}" \
    -d "${POSTGRES_DB:-lotus}" \
    -f /app/deploy/migrations/002_customer_flow_qualification.sql \
    >/dev/null 2>&1 || echo "(skip — migration may have already applied)"
fi

# ----- 3. Seed runs automatically inside the API server on startup -----
# The api-server has a built-in idempotent bootstrap-seed that creates demo
# users + tags + customers + conversations on first boot when the DB is empty.
# No external seed step is needed.

# ----- 4. Start the API server -----
echo "==> Starting API server"
exec "$@"
