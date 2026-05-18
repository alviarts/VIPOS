#!/bin/bash
# VIPOS VPS Deployment Script
# Automates deployment to production VPS with health checks and rollback

set -e

VPS_HOST="103.74.5.44"
VPS_USER="root"
APP_DIR="/var/www/vipos"
BACKUP_DIR="/root/backups"

echo "🚀 VIPOS Deployment Script"
echo "=========================="
echo "Target: $VPS_USER@$VPS_HOST"
echo "App Dir: $APP_DIR"
echo ""

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Not on main branch (current: $CURRENT_BRANCH)"
    echo "Please switch to main branch before deploying"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Working directory has uncommitted changes"
    echo "Please commit or stash changes before deploying"
    exit 1
fi

echo "✅ Git checks passed"
echo ""

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main
echo "✅ Pushed to GitHub"
echo ""

# SSH to VPS and deploy
echo "🔗 Connecting to VPS..."
ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
set -e

APP_DIR="/var/www/vipos"
BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/vipos-backup-$TIMESTAMP"

echo "📦 Creating backup..."
mkdir -p $BACKUP_DIR
cp -r $APP_DIR $BACKUP_PATH
echo "✅ Backup created: $BACKUP_PATH"

cd $APP_DIR

echo "📥 Pulling latest code..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git reset --hard origin/main
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "ℹ️  No new commits, already up to date"
else
    echo "✅ Updated from $CURRENT_COMMIT to $NEW_COMMIT"
fi

echo ""
echo "🔧 Running migrations..."
cd apps/backend
npx prisma migrate deploy

echo ""
echo "🔄 Restarting services..."
pm2 restart vipos-backend
pm2 restart vipos-worker

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "🏥 Health check..."
HEALTH_URL="http://localhost:3001/api/health"
if curl -f -s $HEALTH_URL > /dev/null; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed!"
    echo "🔙 Rolling back..."
    cd $APP_DIR
    git reset --hard $CURRENT_COMMIT
    pm2 restart vipos-backend
    pm2 restart vipos-worker
    echo "❌ Deployment failed, rolled back to $CURRENT_COMMIT"
    exit 1
fi

echo ""
echo "📊 Service status:"
pm2 list

echo ""
echo "🎉 Deployment successful!"
echo "Current commit: $NEW_COMMIT"
echo "Backup location: $BACKUP_PATH"

ENDSSH

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "  - Test the application: http://$VPS_HOST:3001"
echo "  - Check logs: ssh $VPS_USER@$VPS_HOST 'pm2 logs vipos-backend'"
echo "  - Monitor: ssh $VPS_USER@$VPS_HOST 'pm2 monit'"
