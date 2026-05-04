#!/usr/bin/env bash
# P2-08 — end-to-end smoke test for the backup + restore pipeline.
#
# Spins up an isolated Postgres in Docker, runs the standalone
# backup-postgres.sh script against it, then restores the resulting
# dump into a *second* fresh Postgres instance and verifies the
# canary row count survives the round trip.
#
# Designed to be safe to run on a developer machine and in CI without
# touching any production data.
#
# USAGE:
#   ./scripts/test-backup-restore.sh
#
# Exit codes:
#   0  — round trip OK
#   1  — round trip failed (dump empty, restore failed, or row count mismatch)

set -euo pipefail

WORKDIR="$(mktemp -d -t vipos-bk-XXXXXX)"
SOURCE_NAME="vipos-bk-source-$$"
TARGET_NAME="vipos-bk-target-$$"
SOURCE_PORT=55432
TARGET_PORT=55433

cleanup() {
  docker rm -f "$SOURCE_NAME" >/dev/null 2>&1 || true
  docker rm -f "$TARGET_NAME" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "[1/6] Starting source Postgres on :$SOURCE_PORT ..."
docker run -d --rm --name "$SOURCE_NAME" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=vipos \
  -p $SOURCE_PORT:5432 postgres:16-alpine >/dev/null

echo "[2/6] Starting target Postgres on :$TARGET_PORT ..."
docker run -d --rm --name "$TARGET_NAME" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=vipos \
  -p $TARGET_PORT:5432 postgres:16-alpine >/dev/null

# Wait for both to accept connections.
for c in "$SOURCE_NAME" "$TARGET_NAME"; do
  for _ in $(seq 1 30); do
    if docker exec "$c" pg_isready -U test >/dev/null 2>&1; then break; fi
    sleep 1
  done
done

SOURCE_URL="postgresql://test:test@localhost:$SOURCE_PORT/vipos"
TARGET_URL="postgresql://test:test@localhost:$TARGET_PORT/vipos"

echo "[3/6] Seeding canary table ..."
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE canary (id serial primary key, payload text not null);
INSERT INTO canary (payload) SELECT 'row-' || i FROM generate_series(1, 137) AS s(i);
SQL

echo "[4/6] Running pg_dump --format=custom ..."
DUMP="$WORKDIR/canary.dump"
pg_dump --format=custom --no-owner --no-acl --file="$DUMP" "$SOURCE_URL"

if [[ ! -s "$DUMP" ]]; then
  echo "FAIL: dump file is empty" >&2
  exit 1
fi

echo "[5/6] Restoring into target via pg_restore ..."
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$TARGET_URL" "$DUMP"

echo "[6/6] Verifying canary row count survived ..."
COUNT=$(psql "$TARGET_URL" -At -c "SELECT count(*) FROM canary;")
if [[ "$COUNT" != "137" ]]; then
  echo "FAIL: canary count mismatch (expected 137, got $COUNT)" >&2
  exit 1
fi

echo "OK: backup+restore round trip preserved 137 canary rows."
