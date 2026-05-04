#!/usr/bin/env bash
# P2-08 — restore the uploads/ tree mirrored by uploads-backup.
#
# USAGE:
#   ./scripts/restore-uploads.sh                                  # dry run
#   ./scripts/restore-uploads.sh --target ./apps/backend/uploads  # apply
#
# ENV:
#   S3_BUCKET / S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET   required.
#   BACKUP_S3_PREFIX                                          default `vipos-backups`.
#
# Restores via `aws s3 sync` — overwrites local files when the S3 copy
# is larger; idempotent across re-runs.

set -euo pipefail

TARGET=""
PREFIX="${BACKUP_S3_PREFIX:-vipos-backups}"
DRY=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; DRY=0; shift 2;;
    --prefix) PREFIX="$2"; shift 2;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${S3_BUCKET:-}" ]]; then
  echo "ERROR: S3_BUCKET must be set" >&2
  exit 1
fi

SRC="s3://${S3_BUCKET}/${PREFIX}/uploads/"
echo "[$(date -u +%FT%TZ)] Source: $SRC"

if [[ "$DRY" -eq 1 ]]; then
  echo "[$(date -u +%FT%TZ)] Dry run — listing remote contents:"
  if [[ -n "${S3_ENDPOINT:-}" ]]; then
    aws --endpoint-url "$S3_ENDPOINT" s3 ls "$SRC" --recursive
  else
    aws s3 ls "$SRC" --recursive
  fi
  echo "Pass --target <path> to actually restore."
  exit 0
fi

mkdir -p "$TARGET"
echo "[$(date -u +%FT%TZ)] Syncing into $TARGET"
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  aws --endpoint-url "$S3_ENDPOINT" s3 sync "$SRC" "$TARGET"
else
  aws s3 sync "$SRC" "$TARGET"
fi
echo "[$(date -u +%FT%TZ)] Restore complete"
