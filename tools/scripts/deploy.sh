#!/usr/bin/env bash
# tools/scripts/deploy.sh
# VIPOS production deploy — VPS (Ubuntu) + nginx + pm2.
# Run on the VPS itself (e.g. `bash /var/www/vipos/tools/scripts/deploy.sh`)
# or via SSH from CI.
#
# Behaviour:
#   1. Pulls latest <branch> (default: main) into $DEPLOY_PATH
#   2. Installs all workspace deps (`npm install` at root)
#   3. Builds web (`apps/web/dist/`)
#   4. Migrates legacy backend `.env` + SQLite to apps/backend/* (one-shot)
#   5. Restarts pm2 service vipos-backend (re-creates if cwd changed)
#   6. Reloads nginx config (after re-rendering nginx.conf if needed)
#
# Idempotent — safe to re-run.
#
# Required env (with defaults):
#   DEPLOY_PATH    Path to the repo on the VPS (default: /var/www/vipos)
#   BRANCH         Git branch to deploy (default: main)
#   PM2_NAME       pm2 process name (default: vipos-backend)
#   BACKEND_PORT   Backend port (default: 3001)
#   NGINX_SITE     nginx config name (default: vipos)
#
# JWT_SECRET must already exist in apps/backend/.env (generated once at first
# deploy — see DEPLOYMENT.md). This script never regenerates JWT_SECRET to
# avoid invalidating existing user tokens.

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/var/www/vipos}"
BRANCH="${BRANCH:-main}"
PM2_NAME="${PM2_NAME:-vipos-backend}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
NGINX_SITE="${NGINX_SITE:-vipos}"

log() { printf '\n[deploy] %s\n' "$*"; }

log "DEPLOY_PATH=$DEPLOY_PATH BRANCH=$BRANCH PM2_NAME=$PM2_NAME"

cd "$DEPLOY_PATH"

log "1/6 git fetch + checkout $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

log "2/6 npm install (workspaces)"
npm install --no-audit --no-fund

log "3/6 snapshot dist + build web"
# Snapshot the current dist/ before re-building, so a one-command rollback is
# possible if a deploy bakes a broken bundle. Naming convention:
# `dist.pre-deploy-<unix-ts>`. Older `dist.pre-*` directories (from any source
# — auto-deploys, prior Devin sessions, manual ops) are pruned so disk usage
# stays bounded. Override retention with env:  DIST_SNAPSHOT_RETAIN=5 …
#
# Rollback recipe:
#   cd /var/www/vipos/apps/web
#   mv dist dist.broken-$(date +%s)
#   cp -a dist.pre-deploy-<ts> dist
#   pm2 restart vipos-backend
DIST_DIR="$DEPLOY_PATH/apps/web/dist"
DIST_PARENT="$DEPLOY_PATH/apps/web"
DIST_SNAPSHOT_RETAIN="${DIST_SNAPSHOT_RETAIN:-3}"
if [ -d "$DIST_DIR" ]; then
  SNAPSHOT_NAME="dist.pre-deploy-$(date +%s)"
  log "  snapshot apps/web/dist -> apps/web/$SNAPSHOT_NAME"
  cp -a "$DIST_DIR" "$DIST_PARENT/$SNAPSHOT_NAME"
fi
if [ -d "$DIST_PARENT" ]; then
  KEPT=0
  PRUNED=0
  while IFS= read -r snap; do
    [ -z "$snap" ] && continue
    KEPT=$((KEPT + 1))
    if [ "$KEPT" -le "$DIST_SNAPSHOT_RETAIN" ]; then
      continue
    fi
    log "  prune apps/web/$(basename "$snap") (retain=$DIST_SNAPSHOT_RETAIN)"
    rm -rf "$snap"
    PRUNED=$((PRUNED + 1))
  done < <(find "$DIST_PARENT" -maxdepth 1 -type d -name 'dist.pre-*' \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk '{print $2}')
  log "  snapshots: kept up to $DIST_SNAPSHOT_RETAIN, pruned $PRUNED older"
fi

# Source the Sentry build env file (if present) so the frontend Vite build can
# bake the DSN + release into the bundle. Without this, the GitHub Actions
# auto-deploy would race-overwrite any manually-built bundle with one that has
# `import.meta.env.VITE_SENTRY_*` empty, silently disabling Sentry in prod.
# See apps/web/vite.config.js (`define` option) and apps/web/src/lib/sentry.js
# for the matching runtime injection. File is mode 600, root-only, set up
# per docs/v3/workflow/devin_session_protocol.md §6a.
SENTRY_ENV_FILE="${SENTRY_ENV_FILE:-/root/.vipos-sentry-build.env}"
if [ -f "$SENTRY_ENV_FILE" ]; then
  log "  sourcing $SENTRY_ENV_FILE for VITE_SENTRY_* + SENTRY_AUTH_TOKEN"
  set -a
  # shellcheck disable=SC1090
  . "$SENTRY_ENV_FILE"
  set +a
else
  log "  no Sentry env file at $SENTRY_ENV_FILE — building without Sentry vars"
fi
npm run build:web

log "4a/6 migrate legacy backend/.env -> apps/backend/.env (one-shot)"
LEGACY_ENV="$DEPLOY_PATH/backend/.env"
NEW_ENV="$DEPLOY_PATH/apps/backend/.env"
if [ -f "$LEGACY_ENV" ] && [ ! -f "$NEW_ENV" ]; then
  log "  moving $LEGACY_ENV -> $NEW_ENV (preserves existing JWT_SECRET)"
  mv "$LEGACY_ENV" "$NEW_ENV"
fi

log "4b/6 bootstrap apps/backend/.env if still missing"
if [ ! -f "$NEW_ENV" ]; then
  if [ -f .env.example ]; then
    cp .env.example "$NEW_ENV"
  else
    : > "$NEW_ENV"
  fi
  GEN_JWT=$(openssl rand -hex 32)
  if grep -q '^JWT_SECRET=' "$NEW_ENV"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${GEN_JWT}|" "$NEW_ENV"
  else
    echo "JWT_SECRET=${GEN_JWT}" >> "$NEW_ENV"
  fi
  if grep -q '^NODE_ENV=' "$NEW_ENV"; then
    sed -i 's|^NODE_ENV=.*|NODE_ENV=production|' "$NEW_ENV"
  else
    echo 'NODE_ENV=production' >> "$NEW_ENV"
  fi
  if grep -q '^PORT=' "$NEW_ENV"; then
    sed -i "s|^PORT=.*|PORT=${BACKEND_PORT}|" "$NEW_ENV"
  else
    echo "PORT=${BACKEND_PORT}" >> "$NEW_ENV"
  fi
  log "  created $NEW_ENV with fresh JWT_SECRET"
fi

log "4c/6 stop pm2 before SQLite migration (if WAL is in use)"
LEGACY_DB_DIR="$DEPLOY_PATH/backend/data"
NEW_DB_DIR="$DEPLOY_PATH/apps/backend/data"
mkdir -p "$NEW_DB_DIR"
NEEDS_DB_MIGRATE=0
if [ -f "$LEGACY_DB_DIR/vipos.db" ] && [ ! -f "$NEW_DB_DIR/vipos.db" ]; then
  NEEDS_DB_MIGRATE=1
fi
if [ "$NEEDS_DB_MIGRATE" = "1" ] && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  log "  legacy DB present at $LEGACY_DB_DIR — stopping pm2 to flush WAL"
  pm2 stop "$PM2_NAME" || true
fi

log "4d/6 migrate legacy SQLite (vipos.db + WAL/SHM) -> apps/backend/data/"
for f in vipos.db vipos.db-wal vipos.db-shm vipos.db-journal database.db; do
  if [ -f "$LEGACY_DB_DIR/$f" ] && [ ! -f "$NEW_DB_DIR/$f" ]; then
    log "  moving $LEGACY_DB_DIR/$f -> $NEW_DB_DIR/$f"
    mv "$LEGACY_DB_DIR/$f" "$NEW_DB_DIR/$f"
  fi
done
# Some older deploys put DB at backend/database.db (root of backend) — also handle that.
if [ -f "$DEPLOY_PATH/backend/database.db" ] && [ ! -f "$NEW_DB_DIR/vipos.db" ]; then
  log "  moving legacy $DEPLOY_PATH/backend/database.db -> $NEW_DB_DIR/vipos.db"
  mv "$DEPLOY_PATH/backend/database.db" "$NEW_DB_DIR/vipos.db"
fi

log "5/6 (re)start pm2 service $PM2_NAME with cwd=apps/backend"
EXPECTED_CWD="$DEPLOY_PATH/apps/backend"
start_fresh() {
  pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
  cd "$EXPECTED_CWD"
  PORT="$BACKEND_PORT" pm2 start src/index.js --name "$PM2_NAME" --update-env
  cd "$DEPLOY_PATH"
}
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  CURRENT_CWD=$(pm2 jlist 2>/dev/null \
    | python3 -c "import json,sys; data=json.load(sys.stdin); m=[p for p in data if p.get('name')=='$PM2_NAME']; print(m[0].get('pm2_env',{}).get('pm_cwd','') if m else '')" \
    2>/dev/null || true)
  if [ "$CURRENT_CWD" != "$EXPECTED_CWD" ]; then
    log "  cwd mismatch (was '$CURRENT_CWD', want '$EXPECTED_CWD') — re-creating pm2 process"
    start_fresh
  else
    pm2 restart "$PM2_NAME" --update-env
  fi
else
  start_fresh
fi

# vipos-worker — the BullMQ recurring-job processor (db-backup,
# uploads-backup, audit-retention, notification, settlement, …).
# Runs as a separate pm2 process via `npm run worker` so it doesn't
# share the request-path event loop with vipos-backend. We only
# reload when it's already present — provisioning the worker for the
# first time happens out-of-band with:
#
#   cd /var/www/vipos/apps/backend
#   pm2 start npm --name vipos-worker -- run worker --update-env
#
# Why reload here at all: pm2 caches env vars at process start. If
# `.env` rotates (Postgres / Redis / S3 creds) without restarting
# the worker, every subsequent BullMQ job authenticates with stale
# credentials and silently fails (e.g. `pg_dump: FATAL: password
# authentication failed`). Restarting the worker on every deploy
# matches what we already do for vipos-backend and keeps the two
# processes in lock-step with the on-disk `.env`.
WORKER_NAME="${WORKER_PM2_NAME:-vipos-worker}"
if pm2 describe "$WORKER_NAME" >/dev/null 2>&1; then
  log "  reload $WORKER_NAME --update-env (propagate .env rotations)"
  cd "$EXPECTED_CWD"
  pm2 restart "$WORKER_NAME" --update-env
  cd "$DEPLOY_PATH"
else
  log "  $WORKER_NAME not registered with pm2 — skipping (provision out-of-band)"
fi

pm2 save

log "6/6 nginx — verify config + reload"
if command -v nginx >/dev/null 2>&1 && [ -f "/etc/nginx/sites-enabled/$NGINX_SITE" ]; then
  if grep -q "/var/www/vipos/frontend/dist" "/etc/nginx/sites-available/$NGINX_SITE" 2>/dev/null; then
    log "  nginx config still references legacy /frontend/dist — patching to /apps/web/dist"
    sed -i 's|/var/www/vipos/frontend/dist|/var/www/vipos/apps/web/dist|g' \
      "/etc/nginx/sites-available/$NGINX_SITE"
  fi
  nginx -t && systemctl reload nginx
else
  log "  nginx not installed or site $NGINX_SITE not enabled — skipping reload"
fi

log "deploy complete — http://$(hostname -I | awk '{print $1}')/vipos/"
