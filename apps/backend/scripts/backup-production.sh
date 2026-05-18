#!/usr/bin/env bash
# VIPOS Production Backup Script - Comprehensive
# 
# This script backs up:
# 1. PostgreSQL/SQLite database
# 2. Uploaded files (receipts, images, etc)
# 3. Configuration files
# 4. Logs (last 7 days)
#
# USAGE:
#   ./scripts/backup-production.sh
#
# CRON (run daily at 02:00 UTC):
#   0 2 * * * cd /var/www/vipos && ./apps/backend/scripts/backup-production.sh >> /var/log/vipos-backup.log 2>&1
#
# RESTORE:
#   ./scripts/restore-production.sh --backup-file /var/backups/vipos/vipos-backup-2026-05-12.tar.gz

set -euo pipefail

# ---------- Config ----------
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/vipos}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +%Y-%m-%d_%H%M%S)
DATE_ONLY=$(date -u +%Y-%m-%d)
HOSTNAME_SHORT=$(hostname -s 2>/dev/null || echo unknown)
BACKUP_NAME="vipos-backup-${HOSTNAME_SHORT}-${TIMESTAMP}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
BACKUP_ARCHIVE="${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz"
LOG_FILE="${BACKUP_ROOT}/backup-${DATE_ONLY}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------- Functions ----------
log() {
    echo -e "${GREEN}[$(date -u +%FT%TZ)]${NC} $*" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date -u +%FT%TZ)] ERROR:${NC} $*" | tee -a "$LOG_FILE" >&2
}

warn() {
    echo -e "${YELLOW}[$(date -u +%FT%TZ)] WARN:${NC} $*" | tee -a "$LOG_FILE"
}

check_disk_space() {
    local required_mb=$1
    local available_mb=$(df -m "$BACKUP_ROOT" | awk 'NR==2 {print $4}')
    
    if [[ $available_mb -lt $required_mb ]]; then
        error "Insufficient disk space. Required: ${required_mb}MB, Available: ${available_mb}MB"
        return 1
    fi
    log "Disk space check OK (Available: ${available_mb}MB)"
}

# ---------- Pre-flight checks ----------
log "=== VIPOS Production Backup Started ==="
log "Backup name: $BACKUP_NAME"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    warn "Not running as root. Some files may be skipped."
fi

# Create backup directory
mkdir -p "$BACKUP_ROOT"
mkdir -p "$BACKUP_DIR"

# Check disk space (require at least 1GB free)
check_disk_space 1024 || exit 1

# ---------- 1. Database Backup ----------
log "Step 1/5: Backing up database..."

DB_BACKUP_DIR="${BACKUP_DIR}/database"
mkdir -p "$DB_BACKUP_DIR"

# Check if using PostgreSQL or SQLite
if [[ -n "${DATABASE_URL:-}" ]] && [[ "$DATABASE_URL" == postgres* ]]; then
    log "Detected PostgreSQL database"
    DB_URL="${DIRECT_URL:-${DATABASE_URL}}"
    
    # Dump PostgreSQL
    pg_dump \
        --format=custom \
        --compress=9 \
        --no-owner \
        --no-acl \
        --file="${DB_BACKUP_DIR}/vipos.dump" \
        "$DB_URL" 2>&1 | tee -a "$LOG_FILE"
    
    DB_SIZE=$(du -h "${DB_BACKUP_DIR}/vipos.dump" | awk '{print $1}')
    log "PostgreSQL backup complete (${DB_SIZE})"
    
    # Also create a plain SQL backup for easier inspection
    pg_dump \
        --format=plain \
        --no-owner \
        --no-acl \
        "$DB_URL" \
        | gzip -9 > "${DB_BACKUP_DIR}/vipos.sql.gz" 2>&1 | tee -a "$LOG_FILE"
    
elif [[ -f "apps/backend/data/vipos.db" ]]; then
    log "Detected SQLite database"
    
    # Copy SQLite database
    cp "apps/backend/data/vipos.db" "${DB_BACKUP_DIR}/vipos.db"
    
    # Create SQL dump for inspection
    sqlite3 "apps/backend/data/vipos.db" .dump | gzip -9 > "${DB_BACKUP_DIR}/vipos.sql.gz"
    
    DB_SIZE=$(du -h "${DB_BACKUP_DIR}/vipos.db" | awk '{print $1}')
    log "SQLite backup complete (${DB_SIZE})"
else
    error "No database found!"
    exit 1
fi

# ---------- 2. Uploaded Files Backup ----------
log "Step 2/5: Backing up uploaded files..."

UPLOADS_DIR="apps/backend/uploads"
if [[ -d "$UPLOADS_DIR" ]]; then
    UPLOADS_BACKUP_DIR="${BACKUP_DIR}/uploads"
    mkdir -p "$UPLOADS_BACKUP_DIR"
    
    # Use rsync for efficient copying
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --stats "$UPLOADS_DIR/" "$UPLOADS_BACKUP_DIR/" 2>&1 | tee -a "$LOG_FILE"
    else
        cp -r "$UPLOADS_DIR"/* "$UPLOADS_BACKUP_DIR/" 2>/dev/null || true
    fi
    
    UPLOADS_SIZE=$(du -sh "$UPLOADS_BACKUP_DIR" | awk '{print $1}')
    log "Uploads backup complete (${UPLOADS_SIZE})"
else
    warn "No uploads directory found, skipping"
fi

# ---------- 3. Configuration Files Backup ----------
log "Step 3/5: Backing up configuration files..."

CONFIG_BACKUP_DIR="${BACKUP_DIR}/config"
mkdir -p "$CONFIG_BACKUP_DIR"

# Backup .env files (CAREFUL: contains secrets!)
if [[ -f ".env" ]]; then
    cp ".env" "${CONFIG_BACKUP_DIR}/.env"
    log "Backed up .env file"
fi

if [[ -f "apps/backend/.env" ]]; then
    cp "apps/backend/.env" "${CONFIG_BACKUP_DIR}/backend.env"
    log "Backed up backend .env file"
fi

# Backup PM2 ecosystem file
if [[ -f "ecosystem.config.js" ]]; then
    cp "ecosystem.config.js" "${CONFIG_BACKUP_DIR}/"
    log "Backed up PM2 config"
fi

# Backup nginx config if exists
if [[ -f "/etc/nginx/sites-available/vipos" ]]; then
    sudo cp "/etc/nginx/sites-available/vipos" "${CONFIG_BACKUP_DIR}/nginx-vipos.conf" 2>/dev/null || true
    log "Backed up nginx config"
fi

# ---------- 4. Logs Backup (last 7 days) ----------
log "Step 4/5: Backing up recent logs..."

LOGS_BACKUP_DIR="${BACKUP_DIR}/logs"
mkdir -p "$LOGS_BACKUP_DIR"

# PM2 logs
if [[ -d "$HOME/.pm2/logs" ]]; then
    find "$HOME/.pm2/logs" -name "*.log" -mtime -7 -exec cp {} "$LOGS_BACKUP_DIR/" \; 2>/dev/null || true
    log "Backed up PM2 logs (last 7 days)"
fi

# Application logs
if [[ -d "apps/backend/logs" ]]; then
    find "apps/backend/logs" -name "*.log" -mtime -7 -exec cp {} "$LOGS_BACKUP_DIR/" \; 2>/dev/null || true
    log "Backed up application logs (last 7 days)"
fi

# ---------- 5. Create Metadata ----------
log "Step 5/5: Creating backup metadata..."

cat > "${BACKUP_DIR}/BACKUP_INFO.txt" <<EOF
VIPOS Production Backup
=======================

Backup Date: $(date -u +%Y-%m-%d)
Backup Time: $(date -u +%H:%M:%S) UTC
Hostname: $(hostname)
Server IP: $(hostname -I | awk '{print $1}')

Database Type: $(if [[ -n "${DATABASE_URL:-}" ]] && [[ "$DATABASE_URL" == postgres* ]]; then echo "PostgreSQL"; else echo "SQLite"; fi)
Database Size: $DB_SIZE

Git Branch: $(git branch --show-current 2>/dev/null || echo "unknown")
Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

Node Version: $(node --version 2>/dev/null || echo "unknown")
NPM Version: $(npm --version 2>/dev/null || echo "unknown")

Backup Contents:
- Database dump (custom format + SQL)
- Uploaded files (receipts, images)
- Configuration files (.env, PM2, nginx)
- Application logs (last 7 days)

Restore Instructions:
1. Extract: tar -xzf $(basename "$BACKUP_ARCHIVE")
2. Run: ./scripts/restore-production.sh --backup-dir $(basename "$BACKUP_DIR")

EOF

log "Metadata created"

# ---------- 6. Create Archive ----------
log "Creating compressed archive..."

cd "$BACKUP_ROOT"
tar -czf "$BACKUP_ARCHIVE" "$(basename "$BACKUP_DIR")" 2>&1 | tee -a "$LOG_FILE"

ARCHIVE_SIZE=$(du -h "$BACKUP_ARCHIVE" | awk '{print $1}')
log "Archive created: $BACKUP_ARCHIVE (${ARCHIVE_SIZE})"

# Remove temporary directory
rm -rf "$BACKUP_DIR"

# ---------- 7. Verify Archive ----------
log "Verifying archive integrity..."

if tar -tzf "$BACKUP_ARCHIVE" >/dev/null 2>&1; then
    log "Archive verification: ${GREEN}PASSED${NC}"
else
    error "Archive verification: ${RED}FAILED${NC}"
    exit 1
fi

# ---------- 8. Optional: Upload to Remote Storage ----------
if [[ -n "${S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
    log "Uploading to S3..."
    
    S3_KEY="vipos-backups/$(date -u +%Y/%m)/$(basename "$BACKUP_ARCHIVE")"
    
    if [[ -n "${S3_ENDPOINT:-}" ]]; then
        aws --endpoint-url "$S3_ENDPOINT" s3 cp "$BACKUP_ARCHIVE" "s3://${S3_BUCKET}/${S3_KEY}" 2>&1 | tee -a "$LOG_FILE"
    else
        aws s3 cp "$BACKUP_ARCHIVE" "s3://${S3_BUCKET}/${S3_KEY}" 2>&1 | tee -a "$LOG_FILE"
    fi
    
    log "S3 upload complete: s3://${S3_BUCKET}/${S3_KEY}"
fi

# ---------- 9. Retention Policy ----------
log "Applying retention policy (${RETENTION_DAYS} days)..."

find "$BACKUP_ROOT" -name 'vipos-backup-*.tar.gz' -type f -mtime +${RETENTION_DAYS} -delete 2>&1 | tee -a "$LOG_FILE"

REMAINING_BACKUPS=$(find "$BACKUP_ROOT" -name 'vipos-backup-*.tar.gz' -type f | wc -l)
log "Retention cleanup complete. Remaining backups: $REMAINING_BACKUPS"

# ---------- 10. Summary ----------
log "=== Backup Summary ==="
log "Backup file: $BACKUP_ARCHIVE"
log "Archive size: $ARCHIVE_SIZE"
log "Database size: $DB_SIZE"
log "Status: ${GREEN}SUCCESS${NC}"
log "=== Backup Complete ==="

# Send success notification (optional)
if command -v curl >/dev/null 2>&1 && [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    curl -fsS --retry 3 "$HEALTHCHECK_URL" >/dev/null 2>&1 || true
fi

exit 0
