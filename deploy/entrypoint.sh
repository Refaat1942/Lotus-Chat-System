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

# ----- 3. Run the seed if requested (idempotent) -----
if [[ "${RUN_SEED:-true}" == "true" ]]; then
  echo "==> Seeding database (idempotent — skips existing rows)..."
  node /app/deploy/seed.mjs || {
    echo "!!! seed failed"
    exit 1
  }
fi

# ----- 4. Start the API server -----
echo "==> Starting API server"
exec "$@"
