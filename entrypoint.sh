#!/bin/sh
set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting container..."

# ── Run Prisma migrations ────────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running Prisma migrations..."
if npx prisma migrate deploy --schema prisma/schema.prisma; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Prisma migrations completed successfully"
else
  MIGRATION_ERROR=$?
  ERROR_MSG="[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Prisma migration failed with exit code $MIGRATION_ERROR"
  echo "$ERROR_MSG"
  
  # Send alert to Slack if webhook is configured
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{
        \"text\": \"🚨 PRODUCTION ALERT: Prisma Migration Failed\",
        \"attachments\": [{
          \"color\": \"danger\",
          \"fields\": [
            {\"title\": \"Service\", \"value\": \"florence-backend\", \"short\": true},
            {\"title\": \"Environment\", \"value\": \"$NODE_ENV\", \"short\": true},
            {\"title\": \"Exit Code\", \"value\": \"$MIGRATION_ERROR\", \"short\": true},
            {\"title\": \"Timestamp\", \"value\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"short\": true}
          ]
        }]
      }" 2>/dev/null || true
  fi
  
  exit $MIGRATION_ERROR
fi

# ── Start application ───────────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting NestJS application (PID $$)..."
exec node dist/main
