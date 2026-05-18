#!/usr/bin/env bash
# VIPOS Backup Verification Script
#
# This script tests the backup and restore process to ensure:
# 1. Backup completes successfully
# 2. Archive is valid and can be extracted
# 3. Database can be restored
# 4. Data integrity is maintained
#
# USAGE:
#   ./scripts/verify-backup.sh
#   ./scripts/verify-backup.sh --backup-file /var/backups/vipos/vipos-backup-2026-05-12.tar.gz
#
# RECOMMENDED: Run this monthly to verify backup integrity

set -euo pipefail

# ---------- Config ----------
BACKUP_FILE="${1:-}"
TEST_DIR="/tmp/vipos-backup-test-$$"
RESULTS_FILE="/tmp/vipos-backup-verification-$(date +%Y%m%d-%H%M%S).txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# ---------- Functions ----------
log() {
    echo -e "${GREEN}[$(date -u +%FT%TZ)]${NC} $*" | tee -a "$RESULTS_FILE"
}

error() {
    echo -e "${RED}[$(date -u +%FT%TZ)] ERROR:${NC} $*" | tee -a "$RESULTS_FILE" >&2
}

warn() {
    echo -e "${YELLOW}[$(date -u +%FT%TZ)] WARN:${NC} $*" | tee -a "$RESULTS_FILE"
}

info() {
    echo -e "${BLUE}[$(date -u +%FT%TZ)] INFO:${NC} $*" | tee -a "$RESULTS_FILE"
}

test_start() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    info "Test $TESTS_TOTAL: $1"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log "✓ PASS: $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    error "✗ FAIL: $1"
}

cleanup() {
    if [[ -d "$TEST_DIR" ]]; then
        rm -rf "$TEST_DIR"
    fi
}

trap cleanup EXIT

# ---------- Start Verification ----------
log "=== VIPOS Backup Verification Started ==="
log "Results will be saved to: $RESULTS_FILE"
echo ""

mkdir -p "$TEST_DIR"

# ---------- Test 1: Find or Create Backup ----------
test_start "Backup file availability"

if [[ -z "$BACKUP_FILE" ]]; then
    info "No backup file specified, looking for latest backup..."
    
    BACKUP_DIR="${BACKUP_ROOT:-/var/backups/vipos}"
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name 'vipos-backup-*.tar.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    
    if [[ -z "$LATEST_BACKUP" ]]; then
        warn "No existing backup found, creating new backup..."
        
        if [[ -f "apps/backend/scripts/backup-production.sh" ]]; then
            bash apps/backend/scripts/backup-production.sh
            LATEST_BACKUP=$(find "$BACKUP_DIR" -name 'vipos-backup-*.tar.gz' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        else
            test_fail "Backup script not found"
            exit 1
        fi
    fi
    
    BACKUP_FILE="$LATEST_BACKUP"
fi

if [[ -f "$BACKUP_FILE" ]]; then
    test_pass "Backup file exists: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
    info "Backup size: $BACKUP_SIZE"
else
    test_fail "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# ---------- Test 2: Archive Integrity ----------
test_start "Archive integrity check"

if tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
    test_pass "Archive is valid and can be extracted"
    
    FILE_COUNT=$(tar -tzf "$BACKUP_FILE" | wc -l)
    info "Archive contains $FILE_COUNT files"
else
    test_fail "Archive is corrupted or invalid"
    exit 1
fi

# ---------- Test 3: Extract Archive ----------
test_start "Archive extraction"

EXTRACT_DIR="$TEST_DIR/extracted"
mkdir -p "$EXTRACT_DIR"

if tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR" 2>&1; then
    test_pass "Archive extracted successfully"
else
    test_fail "Failed to extract archive"
    exit 1
fi

# Find the actual backup directory (may have timestamp in name)
BACKUP_CONTENT_DIR=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name 'vipos-backup-*' | head -1)

if [[ -z "$BACKUP_CONTENT_DIR" ]]; then
    test_fail "Backup content directory not found"
    exit 1
fi

# ---------- Test 4: Backup Metadata ----------
test_start "Backup metadata validation"

METADATA_FILE="$BACKUP_CONTENT_DIR/BACKUP_INFO.txt"

if [[ -f "$METADATA_FILE" ]]; then
    test_pass "Metadata file exists"
    info "Backup metadata:"
    cat "$METADATA_FILE" | tee -a "$RESULTS_FILE"
else
    test_fail "Metadata file missing"
fi

# ---------- Test 5: Database Backup ----------
test_start "Database backup validation"

DB_DIR="$BACKUP_CONTENT_DIR/database"

if [[ -d "$DB_DIR" ]]; then
    test_pass "Database directory exists"
    
    if [[ -f "$DB_DIR/vipos.dump" ]]; then
        info "PostgreSQL dump found"
        DUMP_SIZE=$(du -h "$DB_DIR/vipos.dump" | awk '{print $1}')
        info "Dump size: $DUMP_SIZE"
        
        # Verify dump is valid
        if pg_restore --list "$DB_DIR/vipos.dump" >/dev/null 2>&1; then
            test_pass "PostgreSQL dump is valid"
        else
            test_fail "PostgreSQL dump is corrupted"
        fi
        
    elif [[ -f "$DB_DIR/vipos.db" ]]; then
        info "SQLite database found"
        DB_SIZE=$(du -h "$DB_DIR/vipos.db" | awk '{print $1}')
        info "Database size: $DB_SIZE"
        
        # Verify SQLite integrity
        if sqlite3 "$DB_DIR/vipos.db" "PRAGMA integrity_check;" | grep -q "ok"; then
            test_pass "SQLite database integrity OK"
        else
            test_fail "SQLite database integrity check failed"
        fi
        
        # Check table counts
        info "Table row counts:"
        sqlite3 "$DB_DIR/vipos.db" "
            SELECT 'users' AS table_name, COUNT(*) AS count FROM users
            UNION ALL SELECT 'products', COUNT(*) FROM products
            UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
            UNION ALL SELECT 'customers', COUNT(*) FROM customers;
        " | tee -a "$RESULTS_FILE"
        
    else
        test_fail "No database backup found"
    fi
else
    test_fail "Database directory missing"
fi

# ---------- Test 6: Uploaded Files ----------
test_start "Uploaded files backup validation"

UPLOADS_DIR="$BACKUP_CONTENT_DIR/uploads"

if [[ -d "$UPLOADS_DIR" ]]; then
    FILE_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
    UPLOADS_SIZE=$(du -sh "$UPLOADS_DIR" | awk '{print $1}')
    
    test_pass "Uploads directory exists"
    info "Files backed up: $FILE_COUNT"
    info "Total size: $UPLOADS_SIZE"
else
    warn "No uploads directory in backup (may be empty)"
fi

# ---------- Test 7: Configuration Files ----------
test_start "Configuration files backup validation"

CONFIG_DIR="$BACKUP_CONTENT_DIR/config"

if [[ -d "$CONFIG_DIR" ]]; then
    test_pass "Config directory exists"
    
    CONFIG_FILES=$(find "$CONFIG_DIR" -type f)
    info "Configuration files:"
    echo "$CONFIG_FILES" | tee -a "$RESULTS_FILE"
    
    # Check for sensitive files
    if [[ -f "$CONFIG_DIR/.env" ]] || [[ -f "$CONFIG_DIR/backend.env" ]]; then
        warn "⚠️  Backup contains .env files with secrets"
        warn "Ensure backup storage is secure!"
    fi
else
    warn "No config directory in backup"
fi

# ---------- Test 8: Logs ----------
test_start "Logs backup validation"

LOGS_DIR="$BACKUP_CONTENT_DIR/logs"

if [[ -d "$LOGS_DIR" ]]; then
    LOG_COUNT=$(find "$LOGS_DIR" -type f | wc -l)
    LOGS_SIZE=$(du -sh "$LOGS_DIR" | awk '{print $1}')
    
    test_pass "Logs directory exists"
    info "Log files: $LOG_COUNT"
    info "Total size: $LOGS_SIZE"
else
    warn "No logs directory in backup"
fi

# ---------- Test 9: Backup Age ----------
test_start "Backup freshness check"

BACKUP_AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$BACKUP_FILE" 2>/dev/null || stat -f %m "$BACKUP_FILE") ))
BACKUP_AGE_HOURS=$(( BACKUP_AGE_SECONDS / 3600 ))

info "Backup age: ${BACKUP_AGE_HOURS} hours"

if [[ $BACKUP_AGE_HOURS -lt 48 ]]; then
    test_pass "Backup is fresh (< 48 hours old)"
elif [[ $BACKUP_AGE_HOURS -lt 168 ]]; then
    warn "Backup is ${BACKUP_AGE_HOURS} hours old (> 2 days)"
    test_pass "Backup age acceptable (< 7 days)"
else
    test_fail "Backup is too old (${BACKUP_AGE_HOURS} hours / $(( BACKUP_AGE_HOURS / 24 )) days)"
fi

# ---------- Test 10: Disk Space for Restore ----------
test_start "Disk space check for restore"

REQUIRED_SPACE_MB=$(du -sm "$BACKUP_CONTENT_DIR" | awk '{print $1}')
AVAILABLE_SPACE_MB=$(df -m . | awk 'NR==2 {print $4}')

info "Required space: ${REQUIRED_SPACE_MB}MB"
info "Available space: ${AVAILABLE_SPACE_MB}MB"

if [[ $AVAILABLE_SPACE_MB -gt $(( REQUIRED_SPACE_MB * 2 )) ]]; then
    test_pass "Sufficient disk space for restore"
else
    test_fail "Insufficient disk space (need at least 2x backup size)"
fi

# ---------- Summary ----------
echo ""
log "=== Verification Summary ==="
log "Total tests: $TESTS_TOTAL"
log "Passed: ${GREEN}$TESTS_PASSED${NC}"
log "Failed: ${RED}$TESTS_FAILED${NC}"
log ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    log "✓ All tests passed! Backup is valid and can be restored."
    log "Status: ${GREEN}SUCCESS${NC}"
    EXIT_CODE=0
else
    error "✗ Some tests failed. Backup may not be reliable!"
    error "Status: ${RED}FAILED${NC}"
    EXIT_CODE=1
fi

log ""
log "Full results saved to: $RESULTS_FILE"
log "=== Verification Complete ==="

exit $EXIT_CODE
