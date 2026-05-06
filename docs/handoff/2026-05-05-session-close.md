# VIPOS Sesi Handoff — 2026-05-05 (FINAL session close)

Closed: 2026-05-05 ~21:40 UTC. Prepared by Devin in continuous-automation
mode. Supersedes the two prior handoffs from this same calendar day:

- `2026-05-05-continuous-automation-rollout.md` (PR #90; covered #83–#90)
- `2026-05-05-worker-reload-followup.md` (PR #92; covered #91)

This is the doc the next Devin should read first. It consolidates the
full PR list, production state at close, and outstanding backlog.

## TL;DR

Continuous-automation mode active per founder directive (see
`docs/v3/workflow/devin_continuous_automation.md`). Eleven PRs merged
across this calendar day — six operational fixes, five docs
follow-ups — all autonomous, no founder approval per PR. Initial
session-close at ~21:40 UTC; PRs #96 → #100 are post-close additions
that surfaced from continued autonomous scanning (PAT consolidation,
backup-freshness probe, dotenv override durable fix, plus matching
docs).

Prod state at close (final, post-PR #100):

- Backend HEAD `97075bb` (PR #100 merge SHA)
- pm2 `vipos-backend` + `vipos-worker` both online, freshly reloaded
  by the post-#100 auto-deploy
- `/api/v1/health/backup` returns `{"status":"ok"}` with a fresh
  manual-smoke dump (`age_hours: 0.001`, `size_bytes: 577421`)
- BullMQ db-backup pipeline functional end-to-end (verified via
  `q.add('post-pr100-smoke', ...)` → `state=completed` post-deploy)
- Snapshot retention live: 3 newest `dist.pre-deploy-*` kept,
  older pruned automatically
- `.env` is now unambiguously authoritative for both API + worker
  env vars (PR #100 `dotenv override:true`)

## All PRs merged this session

| PR   | Subject                                                              | Risk   | Status                                          |
| ---- | -------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| #89  | `feat(deploy): rotate dist.pre-* (keep last 3)`                      | yellow | merged + verified                               |
| #90  | `docs(workflow): continuous-automation prompt + handoff`             | green  | merged                                          |
| #91  | `fix(deploy): pm2 reload vipos-worker on every deploy`               | yellow | merged + verified via workflow_dispatch         |
| #92  | `docs(handoff): worker-reload follow-up`                             | green  | merged                                          |
| #93  | `docs(runbook): env-rotation footgun in deploy-checklist`            | green  | merged                                          |
| #94  | `docs(env): clarify backup/S3/restore-test env vars`                 | green  | merged                                          |
| #96  | `docs: retire VPS PAT backup; single source of truth`                | green  | merged (post-close consolidation)               |
| #97  | `feat(backend): /api/health/backup freshness probe`                  | yellow | merged + verified live (200 ok)                 |
| #98  | `docs(handoff): add #96 + #97 to session-close`                      | green  | merged                                          |
| #99  | `docs(phase-2): tick the Definition-of-Done checkboxes`              | green  | merged                                          |
| #100 | `fix(backend): dotenv override:true so .env wins over stale pm2 env` | yellow | merged + verified live (BullMQ smoke completed) |

(The "verified" suffix means I SSH'd VPS post-merge and confirmed
the change took effect: pm2 process state, `/api/health`, R2 bucket
contents, dist.pre-\* count, etc.)

PRs #96 → #100 were added after the original session-close at ~21:40
UTC. See § "Post-close consolidation: PAT single source of truth",
§ "Post-close addition: /api/health/backup probe (PR #97)", and
§ "Post-close addition: dotenv override:true durable fix (PR #100)"
below for the rationale + verification details.

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

### Post-close addition: /api/health/backup probe (PR #97)

The 2026-05-05 silent-failure pattern (worker producing zero-byte dumps
for ~12h before anyone noticed) motivated a permanent monitoring hook.
PR #97 adds `GET /api/v1/health/backup` (and the legacy `/api/health/backup`
alias) which returns:

- **200 + `status:"ok"`** when the newest local dump is non-empty AND
  fresh (within `BACKUP_FRESHNESS_THRESHOLD_HOURS`, default 25h)
- **503 + `status:"stale"`** when the newest dump is past threshold
- **503 + `status:"corrupt"`** when the newest dump is zero-byte
  (the exact failure mode from today)
- **503 + `status:"no_backups"`** when the dir is empty
- **503 + `status:"no_backup_dir"`** when `BACKUP_DIR` doesn't exist

Live verification post-merge:

```
$ curl -sS -w 'HTTP %{http_code}\n' http://localhost:3001/api/v1/health/backup
{
  "status":"ok",
  "timestamp":"2026-05-06T06:23:28.800Z",
  "threshold_hours":25,
  "backup_dir":"/var/backups/vipos",
  "dump":{
    "path":"/var/backups/vipos/vipos-2026-05-05T115944Z.dump",
    "age_hours":18.396,
    "size_bytes":575656,
    "mtime":"2026-05-05T11:59:44.776Z"
  }
}HTTP 200
```

Both paths (v1 + legacy alias) return identical JSON. 12 unit + HTTP
integration tests in `apps/backend/src/__tests__/health-backup.test.mjs`
cover all five outcomes.

Related fix in same PR: rate-limit `SKIP_PATHS` was previously exact-match
(`/health`, `/api/health`, `/api/v1/health`), so `/api/v1/health/backup`
would have been rate-limited. Added `SKIP_PREFIXES` for `/health/`,
`/api/health/`, `/api/v1/health/` so any `/health/*` sub-probe is
auto-skipped.

Next step (out of scope for this PR): wire up the founder's monitoring
provider (Uptime Kuma / BetterUptime / etc.) to poll the new endpoint
and alert on 503.

### Post-close addition: dotenv override:true durable fix (PR #100)

**Symptom**: 2026-05-06 02:00 UTC `db-backup` cron fired (per Redis
`bull:db-backup:repeat:db-backup-daily:1778007600000` —
`processedOn=02:00:06.929` UTC, three retries, all `failedReason`
matching `pg_dump: ... password authentication failed for user
"postgres"`). Same shape as the 2026-05-05 19:00 UTC failures, even
though PR #91 had reloaded the worker with `--update-env` at 21:04 UTC
the previous evening.

**Root cause** (traced 2026-05-06 ~06:30 UTC):

1. `pm2 jlist` showed `vipos-worker` had _no_ `DIRECT_URL` in its
   stored env (`pm2_env.DIRECT_URL === undefined`). `pm2 restart
vipos-worker --update-env` is therefore a no-op for that key —
   `--update-env` only refreshes from pm2's stored env, which never
   had it.
2. `src/worker.js` and `src/index.js` called `dotenv.config()`
   without options. Default behaviour is "first-wins" — if a key is
   _already_ present in `process.env` (e.g. inherited from the shell
   that first launched pm2 ages ago), dotenv silently no-ops on that
   key.
3. So the worker re-read `.env` at every restart, but
   `process.env.DIRECT_URL` retained whatever the long-ago parent
   shell had leaked in (or nothing at all, falling through to a code
   path that produced the same auth failure).

**Fix**: PR #100 — `require('dotenv').config({ override: true })` in
both `src/index.js` and `src/worker.js`. `.env` is now unambiguously
authoritative for every env var the API + worker read, regardless of
what pm2's parent shell ever held.

Regression-tested via `apps/backend/src/__tests__/dotenv-override.test.mjs`
(4 tests):

- override:true replaces stale `process.env` with `.env` value
- default config (no override) keeps stale value (pre-fix baseline)
- static guard: `worker.js` source still calls dotenv with override:true
- static guard: `index.js` source still calls dotenv with override:true

**Verification post-merge** (2026-05-06 06:48 UTC):

- HEAD = `97075bb` on prod, both files have `override: true`
- pm2 reloaded: `vipos-backend` + `vipos-worker` both ~22s uptime
- BullMQ smoke (`q.add('post-pr100-smoke', { source: 'devin-pr100-smoke' })`)
  → `state=completed`, no `failedReason`
- `/api/v1/health/backup` returns `{"status":"ok",
"dump":{"path":".../vipos-2026-05-06T064754Z.dump","age_hours":0.001,
"size_bytes":577421}}`

**Defence-in-depth now**:

- Primary: `tools/scripts/deploy.sh` reloads `vipos-backend` + `vipos-worker`
  with `--update-env` (PR #91, 2026-05-05).
- Secondary: dotenv override:true in `src/{index,worker}.js` (PR #100,
  2026-05-06) — `.env` wins regardless of supervisor cache state.
- Detection: `/api/health/backup` returns 503 if newest dump >25h
  (PR #97, 2026-05-06) — silent failures get caught within one cron
  cycle, even if defence layers above ever drift.
- Alerting: BullMQ `failed` listener calls `Sentry.captureException`
  with `tags.component=backup` (existing, in `src/jobs/index.js`).
  Email path is gated on `BACKUP_NOTIFY_EMAILS` (still pending founder
  value).

## Outstanding backlog

### Tier 1 — autonomous (Devin can pick + execute next session)

- [x] ~~**Confirm 2026-05-06 02:00 UTC BullMQ `db-backup` run succeeded.**~~
      Investigated 2026-05-06 ~06:30 UTC: the cron _did_ fire (Redis
      `bull:db-backup:repeat:db-backup-daily:1778007600000` recorded
      `processedOn=02:00:06.929` UTC, `failedReason="pg_dump exited
  with code 1: ... password authentication failed for user
  'postgres'"`). Same shape as the 2026-05-05 19:00 UTC failures.
      Two-cause analysis: (1) the cron _did_ run; (2) the worker's
      `process.env.DIRECT_URL` was still stale despite the post-PR #91
      `--update-env` reloads — pm2's stored env never had `DIRECT_URL`
      in the first place, so `--update-env` was a no-op for that key,
      and dotenv's default first-wins precedence then preserved
      whatever the parent shell had leaked in at first boot. **Fixed
      durably by PR #100** (`dotenv.config({ override: true })` in
      both `src/index.js` and `src/worker.js`). Manual smoke
      post-merge: `await q.add('post-pr100-smoke', ...)` returned
      `state=completed` and `/api/health/backup` returns 200 with
      `age_hours: 0.001`. Next 02:00 UTC fire (2026-05-07) should now
      succeed without intervention.
- [x] ~~**Backup-freshness health endpoint.**~~ DONE in PR #97 (post-close).
      `/api/health/backup` + `/api/v1/health/backup` return 503 when
      no fresh dump (>25h) or zero-byte dump exists. Verified live.
- [ ] **Wire monitoring provider to poll `/api/health/backup`.** Out of
      scope for code (provider config). Recommend Uptime Kuma (self-host
      on the VPS) or BetterUptime (free tier). Founder picks; Devin
      configures.
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
