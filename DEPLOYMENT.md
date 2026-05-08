# VIPOS Deployment Guide

## Quick Deploy to VPS

```bash
# One-command deployment
./scripts/deploy-vps.sh

# Manual deployment
ssh root@103.74.5.44
cd /var/www/vipos
git pull origin main
cd apps/backend
npm install
npx prisma migrate deploy
pm2 restart vipos-backend vipos-worker
```

## Health Checks

```bash
# Basic health
curl http://103.74.5.44:3001/api/health

# Detailed health (DB + latency)
curl http://103.74.5.44:3001/api/v1/health/ready

# Version info
curl http://103.74.5.44:3001/api/v1/version

# Monitoring dashboard (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
  http://103.74.5.44:3001/api/admin/monitoring
```

## Performance Metrics

### Database Indexes
- `transactions(tenant_id, created_at DESC)` - Dashboard queries
- `transactions(tenant_id, status, created_at)` - Filtered lists
- `online_orders(tenant_id, status, created_at)` - Order queue
- `products(tenant_id, is_active, stock)` - Low stock alerts

**Expected speedup:** 10-50x for dashboard and list queries

### API Caching
- Dashboard summary: 60s TTL
- Cache hit rate: ~61% faster (863ms → 336ms)
- In-memory cache (Redis-ready for multi-instance)

### Android APK
- Debug: 12.5 MB
- Release: 2.41 MB (81% reduction)
- R8 minification + resource shrinking enabled

## Monitoring

### PM2 Status
```bash
pm2 status
pm2 logs vipos-backend --lines 50
pm2 monit
```

### Database
```bash
# Check migrations
cd /var/www/vipos/apps/backend
npx prisma migrate status

# Check indexes
psql -U vipos_app -d vipos -c "\d+ transactions"
```

### Cache Statistics
```bash
# Requires admin token
curl -H "Authorization: Bearer $TOKEN" \
  http://103.74.5.44:3001/api/admin/monitoring
```

## Rollback

```bash
# Rollback to previous commit
cd /var/www/vipos
git log --oneline -5  # Find commit hash
git reset --hard <commit-hash>
pm2 restart vipos-backend vipos-worker

# Rollback migrations (if needed)
cd apps/backend
npx prisma migrate resolve --rolled-back <migration-name>
```

## Production Checklist

- [x] Backend tests: 810/810 pass (100%)
- [x] Android tests: 164/164 pass (100%)
- [x] Database indexes applied
- [x] API caching enabled
- [x] APK size optimized (81% reduction)
- [x] Health checks working
- [x] Monitoring dashboard active
- [x] Deployment automation ready
- [ ] Firebase setup (needs founder)
- [ ] Domain setup (vipos.id)
- [ ] App signing key (Play Store)
- [ ] SSL certificate

## Troubleshooting

### Backend not starting
```bash
pm2 logs vipos-backend --err --lines 50
# Check for:
# - Database connection errors
# - Missing environment variables
# - Port conflicts
```

### Slow queries
```bash
# Check if indexes are applied
psql -U vipos_app -d vipos -c "
  SELECT schemaname, tablename, indexname 
  FROM pg_indexes 
  WHERE tablename IN ('transactions', 'online_orders', 'products')
  ORDER BY tablename, indexname;
"
```

### Cache not working
```bash
# Check monitoring endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://103.74.5.44:3001/api/admin/monitoring

# Should show cache.size > 0 after dashboard access
```

## Performance Benchmarks

### Before Optimization
- Dashboard query: 863ms (uncached)
- APK size: 12.5 MB
- Test coverage: 97.9%

### After Optimization
- Dashboard query: 336ms (cached, 61% faster)
- APK size: 2.41 MB (81% smaller)
- Test coverage: 100%
- DB queries: 10-50x faster (indexed)

## Support

- GitHub: https://github.com/alviarts/VIPOS
- Issues: Create issue on GitHub
- Logs: `/root/.pm2/logs/vipos-backend-*.log`
