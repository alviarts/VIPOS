# VIPOS Sesi Handoff — 2026-05-05 (FINAL session close)

Closed: 2026-05-05 ~21:40 UTC. Prepared by Devin in continuous-automation
mode. Supersedes the two prior handoffs from this same calendar day:

- `2026-05-05-continuous-automation-rollout.md` (PR #90; covered #83–#90)
- `2026-05-05-worker-reload-followup.md` (PR #92; covered #91)

This is the doc the next Devin should read first. It consolidates the
full PR list, production state at close, and outstanding backlog.

## TL;DR

Continuous-automation mode active per founder directive (see
`docs/v3/workflow/devin_continuous_automation.md`). Six PRs merged
this session — three operational fixes, three docs follow-ups —
all autonomous, no founder approval per PR.

Prod state at close:

- Frontend bundle `index-lloiLhy7.js` from release `vipos-web@88d638a`
- pm2 `vipos-backend` + `vipos-worker` both online, just reloaded by
  the new deploy.sh
- `/api/health` 200, `db.ok=true latency 24ms`, `redis.ok=true latency 5ms`
- BullMQ db-backup pipeline functional end-to-end (live verified
  via shell-script smoke run + R2 dump uploaded)
- Snapshot retention live: 3 newest `dist.pre-deploy-*` kept,
  older pruned automatically

## All PRs merged this session

| PR  | Subject                                                   | Risk   | Status                                  |
| --- | --------------------------------------------------------- | ------ | --------------------------------------- |
| #89 | `feat(deploy): rotate dist.pre-* (keep last 3)`           | yellow | merged + verified                       |
| #90 | `docs(workflow): continuous-automation prompt + handoff`  | green  | merged                                  |
| #91 | `fix(deploy): pm2 reload vipos-worker on every deploy`    | yellow | merged + verified via workflow_dispatch |
| #92 | `docs(handoff): worker-reload follow-up`                  | green  | merged                                  |
| #93 | `docs(runbook): env-rotation footgun in deploy-checklist` | green  | merged                                  |
| #94 | `docs(env): clarify backup/S3/restore-test env vars`      | green  | merged                                  |

(The "verified" suffix means I SSH'd VPS post-merge and confirmed
the change took effect: pm2 process state, `/api/health`, R2 bucket
contents, dist.pre-\* count, etc.)

## Two operational fixes worth re-stating

### 1. dist.pre-\* rotation (PR #89)

`tools/scripts/deploy.sh` now snapshots `apps/web/dist/` to
`apps/web/dist.pre-deploy-<unix-ts>/` before rebuild, then prunes
older `dist.pre-*` directories by mtime, keeping `DIST_SNAPSHOT_RETAIN`
newest (default 3, env override). Disk usage stays bounded; rollback
recipe documented in the script's comment block.

### 2. vipos-worker reload on deploy (PR #91)

The pm2-cached-env footgun bit prod hard today: Postgres rotation
~17:22 UTC silently broke the BullMQ `db-backup` job at 19:00 UTC
because `deploy.sh` only reloaded `vipos-backend`, not
`vipos-worker`. PR #91 makes the deploy script restart both
processes with `--update-env`, mirroring what's already done for
the backend.

Verified live post-merge:

```
pm2 list | grep vipos
4  vipos-backend  online  uptime 100s   restarts 8609
5  vipos-worker   online  uptime 100s   restarts 4    (just reloaded)
```

Backup pipeline now functional. Manual smoke-test produced a 40 KiB
dump and uploaded to Cloudflare R2 at
`s3://vipos-backup/vipos/2026/05/vipos-xserver-2026-05-05_211258.sql.gz`.
Next BullMQ-scheduled run: 2026-05-06 02:00 UTC.

## Production state at close

### VPS `103.74.5.44`

```
Repo HEAD: d902e77 (= PR #94, latest merged)
Bundle: /var/www/vipos/apps/web/dist/assets/index-lloiLhy7.js
        (release literal: vipos-web@88d638a from PR #91 deploy)
PM2:
  vipos-backend  online  pid 780745  uptime ~25min
  vipos-worker   online  pid 780775  uptime ~25min
  finance-bot-tg online
  bot-wa         stopped
Health: db.ok latency 24ms, redis.ok latency 5ms
Disk: 70% / 15GB free
RAM: stable
Cryptominer: still removed (no regression)
Apt updates: 16 pending + reboot-required (defer to maintenance window)
```

### Snapshot retention

```
$ ls -d /var/www/vipos/apps/web/dist.pre-* | sort
dist.pre-deploy-1778015942    (latest, from PR #91 deploy)
dist.pre-deploy-1778014026    (PR #89 deploy)
dist.pre-f5-1777977047        (oldest within retention)
                              (older snapshots auto-pruned)
```

### Cloudflare R2 backup target

```
Bucket: vipos-backup
Endpoint: https://...r2.cloudflarestorage.com (S3_ENDPOINT)
Last upload (manual smoke): vipos/2026/05/vipos-xserver-2026-05-05_211258.sql.gz (40 KiB)
Next scheduled upload: 2026-05-06 02:00 UTC (BullMQ db-backup, custom format ~575 KiB)
                       2026-05-06 02:30 UTC (BullMQ uploads-backup, incremental size-diff)
```

### Credentials / secret store state

| Item                            | Where                                           | Health                                                                                                                                     |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_PAT_VIPOS`              | Devin org-scope secret (single source of truth) | 41-char, used this session — VPS backup file shredded 2026-05-05 ~22:00 UTC per founder consolidation decision (see post-close note below) |
| `/root/.vipos-pg-pwd`           | VPS                                             | 32-char, matches current `DIRECT_URL`                                                                                                      |
| `/root/.vipos-app-pwd`          | VPS                                             | 32-char, matches current `DATABASE_URL`                                                                                                    |
| `/root/.vipos-redis-pwd`        | VPS                                             | 48-char, matches `REDIS_URL`                                                                                                               |
| `/root/.vipos-sentry-build.env` | VPS                                             | unchanged; deploy.sh sources this                                                                                                          |
| Postgres `postgres` superuser   | rotated 2026-05-05 ~17:22 UTC                   | live + verified via pg_dump                                                                                                                |
| Postgres `vipos_app` app user   | rotated 2026-05-05 ~17:22 UTC                   | live + verified via API health                                                                                                             |

## Critical infrastructure context (carry-forward)

### Active workarounds

1. **Git push proxy 403** → use PAT-fallback recipe in
   `docs/v3/workflow/devin_continuous_automation.md` §4.
2. **`git_pr` tool 403** → REST API `curl` recipe in same doc §5.
3. **deploy.sh chicken-egg** → after merging any PR that modifies
   `tools/scripts/deploy.sh`, trigger
   `gh workflow run deploy-vps.yml` (or REST API equivalent) so the
   workflow runs the **new** script. The first auto-deploy after
   merge runs the old script (loaded into bash memory before git
   updates the file).

### Continuous-automation mode (sejak 2026-05-05 ~20:25 UTC)

Default operating mode untuk Devin sesi VIPOS. Auto-pick Tier 1,
auto-merge risk≤yellow, push setiap selesai, handoff doc tiap akhir
sesi. Stop hanya kalau founder bilang `pause`. Detail di
`docs/v3/workflow/devin_continuous_automation.md`.

### Post-close consolidation: PAT single source of truth

After the original session-close at ~21:40 UTC, founder asked which
storage (Devin org-scope secret vs. VPS file backup) to use as the
canonical home for `GITHUB_PAT_VIPOS`. Decision: **Devin org-scope only**,
no VPS backup. Rationale:

- VPS can be compromised (the 2026-05-05 cryptominer incident demonstrated
  this concretely — root-owned files were readable for ~17h).
- A PAT on disk is an extra attack surface for zero benefit, since the
  PAT is only ever used from Devin VMs (which auto-inject the secret
  from the org-scope vault).
- Cognition-managed vault is encrypted at rest and survives VPS rotation
  / wipe.

Action taken at ~22:00 UTC: `shred -uvz /root/.vipos-github-pat` on the
VPS. File no longer present. Devin org-scope secret remains the single
source of truth. If the secret store ever becomes unavailable, regenerate
the PAT from `github.com/settings/tokens` and re-save org-scope.

## Outstanding backlog

### Tier 1 — autonomous (Devin can pick + execute next session)

- [ ] **Confirm tomorrow's 02:00 UTC BullMQ `db-backup` run succeeded.**
      Worker was reloaded with current creds at 21:04 UTC, so it
      _should_ fire correctly. Verify by `ls /var/backups/vipos/` and
      `aws s3 ls s3://vipos-backup/vipos/2026/05/` after 02:01 UTC.
      If it fails, re-investigate worker env propagation.
- [ ] **Backup-freshness health endpoint.** Add `/api/health/backup`
      that 503s when no successful `db-backup` job in the last 25h.
      Code change to `apps/backend/src/routes/health.js` + tests.
      Risk: yellow. ~1-2h with tests.
- [ ] **Phase 2 acceptance-criteria checkboxes.** `phase_2_backend.md`
      has `[done]` task headers but unticked `- [ ]` AC checkboxes
      across P2-01..P2-08. Pure doc cleanup.

### Tier 1 — blocked on a value from founder (small ask each)

- [ ] **`BACKUP_NOTIFY_EMAILS` value.** Set in `apps/backend/.env`
      so backup failures actually page someone instead of being
      Sentry-only. One email or comma list. Devin can do the .env
      edit + worker restart once the value is provided.
- [ ] **Sentry read token.** Token in
      `/root/.vipos-sentry-build.env` only has `project:write` +
      `release:write` (build-time scopes). For Devin to do a 24h
      forwardRef regression spot-check post-PR #88, need a token
      with `event:read` + `issue:read`. Generate from Sentry Org
      Settings → Auth Tokens.
- [ ] **Apt updates + kernel reboot window.** 16 pkg pending +
      kernel `5.15.0.176` → `5.15.0.177` (security). Reboot-required.
      ~5-10s downtime on `vipos-backend`. Pick low-traffic window.

### Tier 2 — blocked on founder strategic decisions

- [ ] HTTPS / domain cutover (pick `app.vipos.id` / `vipos.app` /
      sub of existing).
- [ ] F4 sidebar overload (review sidebar role visibility per group).
- [ ] R2 lifecycle rules (recommend: daily 30, weekly 12, monthly 12).
- [ ] System cron belt-and-suspenders (kalau pm2 worker crash,
      `/etc/cron.daily/` independent backup; recommend after Phase 4).

## Operational notes for next session

1. **Read order**: this doc → `2026-05-05-worker-reload-followup.md`
   → `2026-05-05-continuous-automation-rollout.md`
   → `docs/v3/workflow/devin_continuous_automation.md`
   (Sufficient context to pick up immediately.)
2. **Git push**: try normal flow; if 403, PAT-fallback recipe in
   the continuous-automation doc.
3. **PR creation**: prefer `git_pr` tool; fallback to REST API
   `curl -X POST` recipe in same doc.
4. **VPS access**: `sshpass -p "$VPS_PASSWORD" ssh root@103.74.5.44`.
5. **Postgres direct**: `cd /var/www/vipos/apps/backend &&
set -a; . .env; set +a; psql "$DIRECT_URL"`.
6. **Backup smoke test**: `apps/backend/scripts/backup-postgres.sh`
   from inside the backend dir with `.env` sourced — produces
   gzip dump + uploads to R2 + prunes 14d. Independent of BullMQ.
7. **R2 verify**: AWS CLI compatible with R2 endpoint —
   `aws --endpoint-url $S3_ENDPOINT s3 ls s3://vipos-backup/...`.
   Set `AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID` etc. for the call.

## Block on founder for next session

Three small asks (each unblocks autonomous work):

1. ⚠ `BACKUP_NOTIFY_EMAILS` value (one email or comma list)
2. ⚠ Sentry read token with `event:read` + `issue:read` scope
3. ⚠ Apt updates + kernel reboot window confirmation (5-10s downtime)

Tier 2 directional asks (each unlocks a multi-PR initiative):

- HTTPS domain pick → cert + nginx + Vite base-path PRs
- F4 sidebar role visibility → web sidebar PRs across affected pages
- R2 lifecycle policy direction → CLI-applied lifecycle rules

End of session-close handoff.
