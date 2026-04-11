#!/bin/sh
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting container..."

# ─────────────────────────────
# Wait for DB
# ─────────────────────────────
echo "Waiting for database..."

until nc -z postgres 5432; do
  sleep 2
done

echo "✓ Database ready"

# ─────────────────────────────
# Migration lock (IMPORTANT)
# prevents double runs
# ─────────────────────────────
LOCK_FILE="/tmp/prisma_migration.lock"

if [ -f "$LOCK_FILE" ]; then
  echo "Migration already executed. Skipping."
else
  echo "Running migrations..."

  if npx prisma migrate deploy --schema prisma/schema.prisma; then
    echo "✓ migrations complete"
    touch "$LOCK_FILE"
  else
    echo "✗ migration failed"
    exit 1
  fi
fi

# ─────────────────────────────
# Start app
# ─────────────────────────────
echo "Starting NestJS..."

exec node dist/main.js