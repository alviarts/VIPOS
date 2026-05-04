#!/usr/bin/env bash
# Daily Postgres backup script for VIPOS production.
#
# USAGE:
#   ./scripts/backup-postgres.sh                    # backup to /var/backups/vipos/
#   BACKUP_DIR=/data/backups ./scripts/backup-postgres.sh
#
# CRON (run daily at 02:00 UTC):
#   0 2 * * * cd /var/www/vipos && ./apps/backend/scripts/backup-postgres.sh \
#     >> /var/log/vipos-backup.log 2>&1
#
# REMOTE OFFLOAD (P2-08):
#   After local dump succeeds, upload to S3-compatible storage (Cloudflare R2,
#   Backblaze B2). Set S3_* env vars; script auto-uploads if S3_BUCKET is set.
#
# RESTORE:
#   gunzip < vipos-2026-05-04.sql.gz | psql "$DATABASE_URL"
#
# RETENTION:
#   Local retention: 14 days (auto-pruned).
#   Remote retention: configure at S3 lifecycle policy (recommend 90 days
#   daily + 12 months monthly).

set -euo pipefail

# ---------- Config ----------
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vipos}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date -u +%Y-%m-%d_%H%M%S)
HOSTNAME_SHORT=$(hostname -s 2>/dev/null || echo unknown)
DUMP_FILE="${BACKUP_DIR}/vipos-${HOSTNAME_SHORT}-${TIMESTAMP}.sql.gz"

# Database URL: use DIRECT_URL if available (skips PgBouncer for pg_dump
# compatibility), else fall back to DATABASE_URL.
DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL or DIRECT_URL must be set." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ---------- Dump ----------
echo "[$(date -u +%FT%TZ)] Backing up to $DUMP_FILE"
pg_dump \
  --format=plain \
  --no-owner \
  --no-acl \
  --no-comments \
  --quote-all-identifiers \
  "$DB_URL" \
  | gzip -9 > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | awk '{print $1}')
echo "[$(date -u +%FT%TZ)] Dump complete (${DUMP_SIZE})"

# ---------- Optional S3 offload (P2-08) ----------
if [[ -n "${S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
  S3_KEY="vipos/$(date -u +%Y/%m)/$(basename "$DUMP_FILE")"
  echo "[$(date -u +%FT%TZ)] Uploading to s3://${S3_BUCKET}/${S3_KEY}"
  if [[ -n "${S3_ENDPOINT:-}" ]]; then
    aws --endpoint-url "$S3_ENDPOINT" s3 cp "$DUMP_FILE" "s3://${S3_BUCKET}/${S3_KEY}"
  else
    aws s3 cp "$DUMP_FILE" "s3://${S3_BUCKET}/${S3_KEY}"
  fi
  echo "[$(date -u +%FT%TZ)] S3 upload complete"
fi

# ---------- Retention ----------
echo "[$(date -u +%FT%TZ)] Pruning local backups older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -name 'vipos-*.sql.gz' -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date -u +%FT%TZ)] Backup OK"
