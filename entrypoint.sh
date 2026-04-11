#!/bin/sh
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting container..."

# ─────────────────────────────────────────────
# 1. WAIT FOR DATABASE (ROBUST VERSION)
# ─────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for database..."

TIMEOUT=60
COUNTER=0

until pg_isready -h postgres -p 5432 -U "$DB_USER" >/dev/null 2>&1; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB not ready... retrying"
  sleep 2
  COUNTER=$((COUNTER+2))

  if [ "$COUNTER" -ge "$TIMEOUT" ]; then
    echo "❌ Database connection timeout after ${TIMEOUT}s"
    exit 1
  fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Database is ready"

# ─────────────────────────────────────────────
# 2. RUN PRISMA MIGRATIONS
# ─────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running Prisma migrations..."

if npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Prisma migrations completed successfully"
else
  MIGRATION_ERROR=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Prisma migration failed with exit code $MIGRATION_ERROR"

  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{
        \"text\": \"🚨 Prisma Migration Failed\",
        \"attachments\": [{
          \"color\": \"danger\",
          \"fields\": [
            {\"title\": \"Service\", \"value\": \"florence-backend\", \"short\": true},
            {\"title\": \"Environment\", \"value\": \"$NODE_ENV\", \"short\": true},
            {\"title\": \"Exit Code\", \"value\": \"$MIGRATION_ERROR\", \"short\": true},
            {\"title\": \"Time\", \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"short\": true}
          ]
        }]
      }" 2>/dev/null || true
  fi

  exit $MIGRATION_ERROR
fi

# ─────────────────────────────────────────────
# 3. START APPLICATION
# ─────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting NestJS..."

exec node dist/main.js