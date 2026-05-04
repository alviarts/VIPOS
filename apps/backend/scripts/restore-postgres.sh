#!/usr/bin/env bash
# P2-08 — restore a Postgres dump produced by the db-backup BullMQ job.
#
# USAGE:
#
#   # Restore from a local file:
#   ./scripts/restore-postgres.sh --file /var/backups/vipos/vipos-2026-05-04T020001Z.dump
#
#   # Restore the latest daily snapshot from S3:
#   ./scripts/restore-postgres.sh --s3-key vipos-backups/daily/2026/05/vipos-2026-05-04T020001Z.dump
#
#   # Skip the confirmation prompt (CI / smoke tests):
#   ./scripts/restore-postgres.sh --file ... --force
#
# ENV:
#
#   DATABASE_URL / DIRECT_URL  destination Postgres
#   S3_BUCKET / S3_ENDPOINT /
#     S3_ACCESS_KEY_ID / SECRET   needed when --s3-key is passed
#
# The script:
#   1. Drops the existing schema (with a confirmation prompt unless --force)
#   2. Re-applies the dump via pg_restore --clean --if-exists
#   3. Reports row counts on a small set of canary tables so on-call
#      can spot truncation / silent failures.

set -euo pipefail

FORCE=0
FILE=""
S3_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2;;
    --s3-key) S3_KEY="$2"; shift 2;;
    --force) FORCE=1; shift;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$FILE" && -z "$S3_KEY" ]]; then
  echo "ERROR: pass either --file <path> or --s3-key <key>" >&2
  exit 2
fi

DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "ERROR: DATABASE_URL or DIRECT_URL must be set." >&2
  exit 1
fi

# ---------- Optional S3 fetch ----------
if [[ -n "$S3_KEY" ]]; then
  if [[ -z "${S3_BUCKET:-}" ]]; then
    echo "ERROR: --s3-key passed but S3_BUCKET is unset." >&2
    exit 1
  fi
  TMP="$(mktemp -t vipos-restore-XXXXXX.dump)"
  trap 'rm -f "$TMP"' EXIT
  echo "[$(date -u +%FT%TZ)] Fetching s3://${S3_BUCKET}/${S3_KEY}"
  if [[ -n "${S3_ENDPOINT:-}" ]]; then
    aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "$TMP"
  else
    aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "$TMP"
  fi
  FILE="$TMP"
fi

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: $FILE does not exist" >&2
  exit 1
fi

# ---------- Confirm ----------
if [[ "$FORCE" -ne 1 ]]; then
  echo "This will DROP and REINITIALISE the schema in ${DB_URL%@*}@..." >&2
  read -r -p "Type 'restore' to continue: " confirm
  if [[ "$confirm" != "restore" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

# ---------- Restore ----------
echo "[$(date -u +%FT%TZ)] Restoring $FILE"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$DB_URL" \
  "$FILE"

# ---------- Sanity ----------
echo "[$(date -u +%FT%TZ)] Restore complete. Row counts:"
psql "$DB_URL" -c "SELECT 'users' AS t, count(*) FROM users UNION ALL SELECT 'tenants', count(*) FROM tenants UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;"
