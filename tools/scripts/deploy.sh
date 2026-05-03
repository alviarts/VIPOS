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
#   4. Migrates legacy backend SQLite to apps/backend/data/ (one-shot)
#   5. Restarts pm2 service vipos-backend (or starts if missing)
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

log "3/6 build web"
npm run build:web

log "4/6 ensure apps/backend/.env exists"
if [ ! -f apps/backend/.env ]; then
  if [ -f .env.example ]; then
    cp .env.example apps/backend/.env
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" apps/backend/.env
    sed -i "s|NODE_ENV=.*|NODE_ENV=production|" apps/backend/.env
    log "  created apps/backend/.env with new JWT_SECRET"
  else
    echo "  WARN: no .env.example, skipping .env bootstrap" >&2
  fi
fi

log "4b/6 migrate legacy DB if present"
LEGACY_DB="$DEPLOY_PATH/backend/database.db"
LEGACY_DIR="$DEPLOY_PATH/backend/data"
NEW_DIR="$DEPLOY_PATH/apps/backend/data"
mkdir -p "$NEW_DIR"
if [ -f "$LEGACY_DB" ] && [ ! -f "$NEW_DIR/vipos.db" ]; then
  log "  moving legacy $LEGACY_DB -> $NEW_DIR/vipos.db"
  mv "$LEGACY_DB" "$NEW_DIR/vipos.db"
fi
if [ -d "$LEGACY_DIR" ] && [ ! "$(ls -A "$NEW_DIR" 2>/dev/null)" ]; then
  log "  moving legacy dir $LEGACY_DIR/* -> $NEW_DIR/"
  mv "$LEGACY_DIR"/* "$NEW_DIR/" 2>/dev/null || true
fi

log "5/6 restart pm2 service $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  cd "$DEPLOY_PATH/apps/backend"
  PORT="$BACKEND_PORT" pm2 start src/index.js --name "$PM2_NAME" --update-env
  pm2 save
  cd "$DEPLOY_PATH"
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
