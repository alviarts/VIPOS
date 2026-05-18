# VIPOS Backup & Disaster Recovery Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Quick Start](#quick-start)
4. [Automated Backups](#automated-backups)
5. [Manual Backup](#manual-backup)
6. [Restore Process](#restore-process)
7. [Backup Verification](#backup-verification)
8. [Monitoring](#monitoring)
9. [Disaster Recovery Plan](#disaster-recovery-plan)
10. [Troubleshooting](#troubleshooting)

---

## Overview

VIPOS implements a comprehensive backup and disaster recovery system to protect your business data:

- **Automated daily backups** (02:00 UTC)
- **30-day retention** (configurable)
- **Off-site backup** to S3-compatible storage (optional)
- **Automated verification** (weekly)
- **Point-in-time recovery**
- **< 1 hour RTO** (Recovery Time Objective)
- **< 24 hours RPO** (Recovery Point Objective)

### What Gets Backed Up

✅ **Database** (PostgreSQL/SQLite)

- All tables and data
- Indexes and constraints
- Custom format + SQL dump

✅ **Uploaded Files**

- Receipt images
- Product photos
- Customer documents

✅ **Configuration**

- Environment variables (.env)
- PM2 configuration
- Nginx configuration

✅ **Logs** (last 7 days)

- Application logs
- PM2 logs
- Error logs

---

## Backup Strategy

### 3-2-1 Backup Rule

We follow the industry-standard 3-2-1 rule:

- **3** copies of data (production + local backup + remote backup)
- **2** different storage types (disk + S3)
- **1** off-site copy (S3/cloud storage)

### Retention Policy

| Backup Type | Retention | Location      |
| ----------- | --------- | ------------- |
| Daily       | 30 days   | Local disk    |
| Weekly      | 90 days   | S3 (optional) |
| Monthly     | 12 months | S3 (optional) |

### Backup Schedule

```
02:00 UTC - Daily full backup
03:00 UTC - Weekly verification (Sunday)
04:00 UTC - Monthly cleanup (1st day)
```

---

## Quick Start

### 1. Setup Automated Backups

```bash
# On VPS (as root)
cd /var/www/vipos
sudo bash apps/backend/scripts/setup-cron.sh
```

This will:

- Create backup directories
- Setup cron jobs
- Configure log rotation
- Run initial backup test

### 2. Configure Remote Backup (Optional but Recommended)

Add to `.env`:

```bash
# S3-compatible storage (Cloudflare R2, Backblaze B2, AWS S3)
S3_BUCKET=vipos-backups
S3_ENDPOINT=https://your-endpoint.com  # Optional for non-AWS
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

### 3. Test Backup

```bash
# Run manual backup
sudo bash apps/backend/scripts/backup-production.sh

# Verify backup
sudo bash apps/backend/scripts/verify-backup.sh
```

---

## Automated Backups

### Cron Jobs

Automated backups run via cron. View schedule:

```bash
sudo cat /etc/cron.d/vipos-backup
```

### Backup Logs

Monitor backup status:

```bash
# View backup log
tail -f /var/log/vipos/backup.log

# View verification log
tail -f /var/log/vipos/backup-verify.log

# Check for errors
grep -i error /var/log/vipos/backup.log
```

### Backup Location

```
/var/backups/vipos/
├── vipos-backup-server-2026-05-12_020001.tar.gz
├── vipos-backup-server-2026-05-11_020001.tar.gz
├── vipos-backup-server-2026-05-10_020001.tar.gz
└── ...
```

---

## Manual Backup

### Full Backup

```bash
cd /var/www/vipos
sudo bash apps/backend/scripts/backup-production.sh
```

### Database Only

```bash
# PostgreSQL
pg_dump -Fc -f /tmp/vipos-db-$(date +%Y%m%d).dump "$DATABASE_URL"

# SQLite
cp apps/backend/data/vipos.db /tmp/vipos-db-$(date +%Y%m%d).db
```

### Files Only

```bash
tar -czf /tmp/vipos-files-$(date +%Y%m%d).tar.gz apps/backend/uploads/
```

---

## Restore Process

### ⚠️ WARNING

**Restoring will OVERWRITE current data!**

Always:

1. Stop the application first
2. Backup current state before restore
3. Test in staging environment if possible

### Full Restore

```bash
# 1. Stop application
pm2 stop all

# 2. Restore from backup
sudo bash apps/backend/scripts/restore-production.sh \
  --backup-file /var/backups/vipos/vipos-backup-2026-05-12.tar.gz

# 3. Verify data
# Check database tables, file counts, etc.

# 4. Start application
pm2 start all

# 5. Test critical functionality
# Login, checkout, reports, etc.
```

### Database Only Restore

```bash
# PostgreSQL
pg_restore --clean --if-exists --dbname="$DATABASE_URL" /path/to/backup.dump

# SQLite
cp /path/to/backup.db apps/backend/data/vipos.db
```

### Files Only Restore

```bash
tar -xzf /path/to/backup.tar.gz -C apps/backend/uploads/
```

### Restore from S3

```bash
# Download from S3
aws s3 cp s3://vipos-backups/vipos/2026/05/vipos-backup-2026-05-12.tar.gz /tmp/

# Restore
sudo bash apps/backend/scripts/restore-production.sh \
  --backup-file /tmp/vipos-backup-2026-05-12.tar.gz
```

---

## Backup Verification

### Automated Verification

Runs every Sunday at 03:00 UTC. Checks:

- ✅ Archive integrity
- ✅ Database validity
- ✅ File completeness
- ✅ Backup freshness
- ✅ Disk space

### Manual Verification

```bash
sudo bash apps/backend/scripts/verify-backup.sh

# Or verify specific backup
sudo bash apps/backend/scripts/verify-backup.sh \
  /var/backups/vipos/vipos-backup-2026-05-12.tar.gz
```

### Verification Report

Results saved to: `/tmp/vipos-backup-verification-YYYYMMDD-HHMMSS.txt`

---

## Monitoring

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3001/health

# Detailed system status
curl http://localhost:3001/health/detailed

# Backup status
curl http://localhost:3001/health/backup
```

### Response Example

```json
{
  "status": "healthy",
  "timestamp": "2026-05-12T10:30:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": "5ms",
      "size": "245.3 MB"
    },
    "disk": {
      "status": "healthy",
      "total": "50 GB",
      "used": "15.2 GB",
      "available": "34.8 GB",
      "usagePercent": "30.4%"
    },
    "memory": {
      "status": "healthy",
      "process": {
        "rss": "128 MB",
        "heapUsed": "85 MB"
      }
    }
  }
}
```

### Alerts

Setup monitoring alerts for:

- ❌ Backup failed
- ❌ Backup older than 48 hours
- ❌ Disk usage > 80%
- ❌ Database connection failed

**Recommended tools:**

- UptimeRobot (free)
- Healthchecks.io (free)
- Cronitor
- Better Uptime

---

## Disaster Recovery Plan

### Scenario 1: Database Corruption

**Symptoms:** Application errors, data inconsistency

**Recovery Steps:**

```bash
# 1. Stop application
pm2 stop all

# 2. Backup corrupted database (for forensics)
cp apps/backend/data/vipos.db /tmp/vipos-corrupted-$(date +%s).db

# 3. Restore from latest backup
sudo bash apps/backend/scripts/restore-production.sh \
  --backup-file /var/backups/vipos/vipos-backup-latest.tar.gz \
  --db-only

# 4. Verify data integrity
sqlite3 apps/backend/data/vipos.db "PRAGMA integrity_check;"

# 5. Start application
pm2 start all

# 6. Test functionality
```

**RTO:** 15-30 minutes  
**RPO:** < 24 hours (last backup)

---

### Scenario 2: Server Crash / Hardware Failure

**Symptoms:** Server unreachable, disk failure

**Recovery Steps:**

```bash
# 1. Provision new server
# - Same OS (Ubuntu 20.04+)
# - Same specs or better

# 2. Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql nginx

# 3. Clone VIPOS repository
git clone https://github.com/alviarts/VIPOS.git /var/www/vipos
cd /var/www/vipos

# 4. Install packages
npm install

# 5. Download latest backup from S3
aws s3 cp s3://vipos-backups/vipos/latest.tar.gz /tmp/

# 6. Restore backup
sudo bash apps/backend/scripts/restore-production.sh \
  --backup-file /tmp/latest.tar.gz \
  --force

# 7. Configure environment
# Copy .env from backup or recreate

# 8. Start services
pm2 start ecosystem.config.js
sudo systemctl restart nginx

# 9. Update DNS (if IP changed)

# 10. Verify functionality
```

**RTO:** 1-2 hours  
**RPO:** < 24 hours

---

### Scenario 3: Accidental Data Deletion

**Symptoms:** Missing transactions, products, or customers

**Recovery Steps:**

```bash
# 1. Identify what was deleted and when
# Check audit logs, application logs

# 2. Find backup before deletion
ls -lh /var/backups/vipos/

# 3. Extract specific data from backup
mkdir /tmp/restore-temp
tar -xzf /var/backups/vipos/vipos-backup-2026-05-11.tar.gz -C /tmp/restore-temp

# 4. Query deleted data from backup database
sqlite3 /tmp/restore-temp/database/vipos.db "SELECT * FROM transactions WHERE id = 12345;"

# 5. Export deleted data
sqlite3 /tmp/restore-temp/database/vipos.db ".mode insert transactions" "SELECT * FROM transactions WHERE id = 12345;" > /tmp/restore-data.sql

# 6. Import to production (carefully!)
sqlite3 apps/backend/data/vipos.db < /tmp/restore-data.sql

# 7. Verify data restored correctly
```

**RTO:** 30-60 minutes  
**RPO:** Depends on backup timing

---

### Scenario 4: Ransomware / Security Breach

**Symptoms:** Files encrypted, unauthorized access

**Recovery Steps:**

```bash
# 1. IMMEDIATELY disconnect from network
sudo ifconfig eth0 down

# 2. Preserve evidence (for forensics)
# Do NOT modify any files

# 3. Provision clean server (new IP)

# 4. Restore from OLDEST clean backup (before breach)
# Ransomware may have encrypted recent backups

# 5. Change ALL passwords and secrets
# Database passwords, API keys, SSH keys, etc.

# 6. Audit security
# Check for backdoors, malware, vulnerabilities

# 7. Restore service on new server

# 8. Monitor for suspicious activity
```

**RTO:** 2-4 hours  
**RPO:** Depends on breach timing

---

## Troubleshooting

### Backup Failed

**Check logs:**

```bash
tail -100 /var/log/vipos/backup.log
```

**Common issues:**

1. **Disk full**

   ```bash
   df -h
   # Clean up old backups or increase disk
   ```

2. **Permission denied**

   ```bash
   sudo chown -R root:root /var/backups/vipos
   sudo chmod 755 /var/backups/vipos
   ```

3. **Database connection failed**
   ```bash
   # Check DATABASE_URL in .env
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

---

### Restore Failed

**Check:**

1. **Backup file corrupted**

   ```bash
   tar -tzf /path/to/backup.tar.gz
   ```

2. **Insufficient disk space**

   ```bash
   df -h
   ```

3. **Database conflicts**
   ```bash
   # Use --force flag to skip confirmation
   # Use --db-only or --files-only for partial restore
   ```

---

### Backup Too Large

**Optimize:**

1. **Exclude old logs**

   ```bash
   # Edit backup-production.sh
   # Change: -mtime -7 (last 7 days)
   # To: -mtime -3 (last 3 days)
   ```

2. **Compress uploads**

   ```bash
   # Optimize images before backup
   find apps/backend/uploads -name "*.jpg" -exec jpegoptim --max=85 {} \;
   ```

3. **Use incremental backups** (advanced)

---

## Best Practices

### ✅ DO

- ✅ Test restore process monthly
- ✅ Store backups off-site (S3)
- ✅ Monitor backup status daily
- ✅ Document recovery procedures
- ✅ Encrypt backups (contains secrets!)
- ✅ Rotate backup encryption keys annually

### ❌ DON'T

- ❌ Store backups on same disk as production
- ❌ Ignore backup failures
- ❌ Skip verification tests
- ❌ Share backup files insecurely
- ❌ Delete old backups without testing new ones

---

## Support

For backup/restore issues:

1. Check logs: `/var/log/vipos/backup.log`
2. Run verification: `bash scripts/verify-backup.sh`
3. Review this guide
4. Contact: [your-support-email]

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0  
**Maintained by:** VIPOS Team
