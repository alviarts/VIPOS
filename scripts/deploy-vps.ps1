# VIPOS VPS Deployment Script (PowerShell)
# Automates deployment to production VPS

$VPS_HOST = "103.74.5.44"
$VPS_USER = "root"
$APP_DIR = "/var/www/vipos"

Write-Host "🚀 VIPOS Deployment Script" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host "Target: $VPS_USER@$VPS_HOST"
Write-Host "App Dir: $APP_DIR"
Write-Host ""

# Check if we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "❌ Error: Not on main branch (current: $currentBranch)" -ForegroundColor Red
    Write-Host "Please switch to main branch before deploying"
    exit 1
}

Write-Host "✅ Git checks passed" -ForegroundColor Green
Write-Host ""

# Push to GitHub
Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
Write-Host ""

# Deploy commands
$deployCommands = @"
cd $APP_DIR && \
git pull origin main && \
cd apps/backend && \
npm install --production && \
pm2 restart vipos-backend && \
sleep 3 && \
curl -f http://localhost:3001/api/health
"@

Write-Host "🔗 Deploying to VPS..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please run these commands on VPS manually:" -ForegroundColor Cyan
Write-Host ""
Write-Host "ssh $VPS_USER@$VPS_HOST" -ForegroundColor White
Write-Host $deployCommands -ForegroundColor White
Write-Host ""
Write-Host "Or copy-paste this one-liner:" -ForegroundColor Cyan
Write-Host "ssh $VPS_USER@$VPS_HOST `"$deployCommands`"" -ForegroundColor White
