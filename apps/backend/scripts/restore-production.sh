#!/usr/bin/env bash
# VIPOS Production Restore Script
#
# USAGE:
#   ./scripts/restore-production.sh --backup-file /var/backups/vipos/vipos-backup-2026-05-12.tar.gz
#   ./scripts/restore-production.sh --backup-file /var/backups/vipos/vipos-backup-2026-05-12.tar.gz --force
#
# OPTIONS:
#   --backup-file    Path to backup archive (.tar.gz)
#   --force          Skip confirmation prompt
#   --db-only        Restore database only
#   --files-only     Restore files only

set -euo pipefail

# ---------- Config ----------
BACKUP_FILE=""
FORCE=0
DB_ONLY=0
FILES_ONLY=0
RESTORE_DIR="/tmp/vipos-restore-$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---------- Functions ----------
log() {
    echo -e "${GREEN}[$(date -u +%FT%TZ)]${NC} $*"
}

error() {
    echo -e "${RED}[$(date -u +%FT%TZ)] ERROR:${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[$(date -u +%FT%TZ)] WARN:${NC} $*"
}

cleanup() {
    if [[ -d "$RESTORE_DIR" ]]; then
        log "Cleaning up temporary files..."
        rm -rf "$RESTORE_DIR"
    fi
}

trap cleanup EXIT

# ---------- Parse Arguments ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE=1
            shift
            ;;
        --db-only)
            DB_ONLY=1
            shift
            ;;
        --files-only)
            FILES_ONLY=1
            shift
            ;;
        -h|--help)
            sed -n '2,10p' "$0"
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            exit 2
            ;;
    esac
done

# ---------- Validation ----------
if [[ -z "$BACKUP_FILE" ]]; then
    error "Missing required argument: --backup-file"
    exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# ---------- Confirmation ----------
if [[ $FORCE -ne 1 ]]; then
    warn "⚠️  WARNING: This will OVERWRITE current data!"
    warn "Backup file: $BACKUP_FILE"
    warn ""
    read -r -p "Type 'RESTORE' to continue: " confirm
    
    if [[ "$confirm" != "RESTORE" ]]; then
        log "Restore cancelled."
        exit 0
    fi
fi

log "=== VIPOS Production Restore Started ==="
log "Backup file: $BACKUP_FILE"

# ---------- Extract Archive ----------
log "Extracting backup archive..."

mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR" --strip-components=1

if [[ ! -f "$RESTORE_DIR/BACKUP_INFO.txt" ]]; then
    error "Invalid backup archive (missing BACKUP_INFO.txt)"
    exit 1
fi

log "Backup info:"
cat "$RESTORE_DIR/BACKUP_INFO.txt"
echo ""

# ---------- Restore Database ----------
if [[ $FILES_ONLY -ne 1 ]]; then
    log "Step 1: Restoring database..."
    
    if [[ -f "$RESTORE_DIR/database/vipos.dump" ]]; then
        # PostgreSQL restore
        log "Detected PostgreSQL backup"
        
        DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
        if [[ -z "$DB_URL" ]]; then
            error "DATABASE_URL or DIRECT_URL must be set"
            exit 1
        fi
        
        warn "Dropping existing database schema..."
        pg_restore \
            --clean \
            --if-exists \
            --no-owner \
            --no-acl \
            --dbname="$DB_URL" \
            "$RESTORE_DIR/database/vipos.dump"
        
        log "PostgreSQL restore complete"
        
    elif [[ -f "$RESTORE_DIR/database/vipos.db" ]]; then
        # SQLite restore
        log "Detected SQLite backup"
        
        DB_PATH="apps/backend/data/vipos.db"
        
        # Backup current database
        if [[ -f "$DB_PATH" ]]; then
            BACKUP_CURRENT="${DB_PATH}.before-restore-$(date +%s)"
            cp "$DB_PATH" "$BACKUP_CURRENT"
            log "Current database backed up to: $BACKUP_CURRENT"
        fi
        
        # Restore
        cp "$RESTORE_DIR/database/vipos.db" "$DB_PATH"
        log "SQLite restore complete"
        
    else
        error "No database backup found in archive"
        exit 1
    fi
    
    # Verify database
    log "Verifying database..."
    if [[ -n "${DATABASE_URL:-}" ]] && [[ "$DATABASE_URL" == postgres* ]]; then
        psql "$DB_URL" -c "SELECT 'users' AS table_name, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'transactions', count(*) FROM transactions;"
    else
        sqlite3 "$DB_PATH" "SELECT 'users' AS table_name, count(*) FROM users UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'transactions', count(*) FROM transactions;"
    fi
fi

# ---------- Restore Files ----------
if [[ $DB_ONLY -ne 1 ]]; then
    log "Step 2: Restoring uploaded files..."
    
    if [[ -d "$RESTORE_DIR/uploads" ]]; then
        UPLOADS_DIR="apps/backend/uploads"
        
        # Backup current uploads
        if [[ -d "$UPLOADS_DIR" ]]; then
            BACKUP_UPLOADS="${UPLOADS_DIR}.before-restore-$(date +%s)"
            mv "$UPLOADS_DIR" "$BACKUP_UPLOADS"
            log "Current uploads backed up to: $BACKUP_UPLOADS"
        fi
        
        # Restore
        mkdir -p "$UPLOADS_DIR"
        cp -r "$RESTORE_DIR/uploads"/* "$UPLOADS_DIR/"
        
        UPLOADS_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
        log "Restored $UPLOADS_COUNT files"
    else
        warn "No uploads found in backup"
    fi
    
    # ---------- Restore Configuration (Optional) ----------
    log "Step 3: Configuration files..."
    
    if [[ -d "$RESTORE_DIR/config" ]]; then
        warn "Configuration files found in backup:"
        ls -lh "$RESTORE_DIR/config/"
        warn "⚠️  Manual review recommended before restoring config files"
        warn "Config files location: $RESTORE_DIR/config/"
    fi
fi

# ---------- Post-Restore ----------
log "Step 4: Post-restore tasks..."

# Restart services
if command -v pm2 >/dev/null 2>&1; then
    log "Restarting PM2 services..."
    pm2 restart all || warn "PM2 restart failed (may need manual restart)"
fi

# ---------- Summary ----------
log "=== Restore Summary ==="
log "Database: $(if [[ $FILES_ONLY -eq 1 ]]; then echo "SKIPPED"; else echo "RESTORED"; fi)"
log "Files: $(if [[ $DB_ONLY -eq 1 ]]; then echo "SKIPPED"; else echo "RESTORED"; fi)"
log "Status: ${GREEN}SUCCESS${NC}"
log "=== Restore Complete ==="

warn ""
warn "⚠️  IMPORTANT: Please verify the following:"
warn "1. Check application logs for errors"
warn "2. Test critical functionality (login, checkout, reports)"
warn "3. Verify data integrity (transaction counts, stock levels)"
warn "4. Review configuration files in: $RESTORE_DIR/config/"
warn ""

exit 0
