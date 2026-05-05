# VIPOS Phase 2 prod-completion — End-of-Session Handoff (2026-05-05)

**Audience:** Next Devin session continuing from this branch.
**Trigger:** Founder asked the previous session to push state and switch
to a new Devin to finish the last pending step (Sentry source-map
deploy). This doc tells you exactly where to pick up.

---

## TL;DR — read this first

1. **Phase 2 prod-side is 7 of 8 components live on VPS.** The only
   piece left is _frontend Sentry source-map upload_ (last sub-bullet
   of P2-05 observability). PR #81 wires the build-time plumbing for
   it — it just needs to merge and deploy.
2. **Founder has NOT yet said "gas merge" for PR #81.** Per
   `docs/v3/workflow/devin_session_protocol.md` §2, you wait for that
   before squash-merging. Do not auto-merge.
3. **All four Sentry build-time secrets are already org-scope
   permanent** — your shell env will have them on session start. No
   need to re-prompt the founder.
4. **Founder will trigger end-to-end testing in a future session**, not
   this one. Per protocol §1, do not start bug-layer fixes until they
   say so explicitly. Stop after Phase F is done and lapor balik.
5. **Read `docs/v3/workflow/devin_session_protocol.md` first** — it is
   the single source of truth for how the founder wants Devin sessions
   to behave. Anything in that doc overrides anything in this handoff.

---

## 1. Session timeline (2026-05-05)

| sha       | PR      | Description                                                                                |
| --------- | ------- | ------------------------------------------------------------------------------------------ |
| ops only  | —       | `vipos_app` Postgres password rotation (RLS role) + `/root/.vipos-app-pwd` 600             |
| `86d0573` | #76     | F5 fix — signup slug placeholder derives from `window.location.host`                       |
| `45066bd` | #77     | F6 fix — Riwayat timezone abbreviation via `Intl.DateTimeFormat({timeZoneName:'short'})`   |
| `a99cf9a` | #78     | Dashboard PG SQL regression (top-products GROUP BY + chart `DATE('now',-7d)`)              |
| `832c134` | #79     | commission-report.js stale strftime comment cleanup                                        |
| `2b7542f` | #80     | `docs/v3/workflow/devin_session_protocol.md` — formalises founder mental model             |
| ops only  | —       | Phase A — Redis 7-alpine docker container `vipos-redis`, loopback-only, password-protected |
| ops only  | —       | Phase B — backend `.env` REDIS_URL appended, `vipos-backend` restarted                     |
| ops only  | —       | Phase C — `vipos-worker` pm2 process spawned, BullMQ schedulers registered                 |
| ops only  | —       | Phase D — BullMQ smoke OK (notification job processed 154 ms; Bull Board 200)              |
| ops only  | —       | Phase E — R2 bucket `vipos-backup` wired, ad-hoc db-backup uploaded 562 KB pg_dump         |
| `c016c73` | **#81** | **OPEN** — `@sentry/vite-plugin` wiring (NOT yet merged, awaiting "gas merge")             |

---

## 2. Production state at handoff

```
host:           103.74.5.44 (HTTP, no domain)
main sha:       2b7542f (PR #80)
backend:        pm2 vipos-backend  online  port 3001 loopback
worker:         pm2 vipos-worker   online  10 BullMQ queues + 3 cron schedulers
redis:          docker vipos-redis Up      127.0.0.1:6379 password-protected
postgres:       17, RLS enforced via vipos_app role (rotated 2026-05-05)
backup:         R2 bucket vipos-backup (account d603aa7b3d07612926e3a01eec824a51)
                vipos-backups/daily/2026/05/vipos-2026-05-05T115944Z.dump (562 KB) — confirmed live
GET /vipos/api/health -> 200 db.ok=true redis.ok=true
```

### BullMQ recurring schedulers (worker TZ = Asia/Jakarta)

| queue           | cron         | next run (WIB) |
| --------------- | ------------ | -------------- |
| db-backup       | `0 2 * * *`  | 02:00 daily    |
| uploads-backup  | `30 2 * * *` | 02:30 daily    |
| audit-retention | `15 3 * * *` | 03:15 daily    |

(spec doc says `UTC` but worker process inherits `TZ=Asia/Jakarta`.
This is actually preferable — 02:00 WIB = lowest-traffic window in
Indonesia. No change needed unless founder asks.)

---

## 3. Phase 2 completion checklist (vs `devin_session_protocol.md` §3b)

| Component                                          | Code       | Prod                                                   |
| -------------------------------------------------- | ---------- | ------------------------------------------------------ |
| P2-01 SQLite → Postgres migration                  | ✓          | ✓                                                      |
| P2-02 Multi-tenant + RLS                           | ✓          | ✓                                                      |
| P2-03 Audit logging                                | ✓          | ✓                                                      |
| P2-04 BullMQ + Redis + worker process              | ✓          | ✓                                                      |
| P2-05 Observability — Sentry backend init          | ✓          | ✓                                                      |
| P2-05 Observability — **Sentry frontend SDK init** | ✓          | ❌ (DSN was empty in build env, fixed in this handoff) |
| P2-05 Observability — **Sentry source-map upload** | ✓ (PR #81) | ❌ (needs merge + rebuild)                             |
| P2-06 Rate limit + security hardening              | ✓          | ✓                                                      |
| P2-07 API versioning + Swagger                     | ✓          | ✓                                                      |
| P2-08 Backup R2                                    | ✓          | ✓                                                      |

→ One remaining task: merge PR #81 + rebuild frontend on VPS with the
four new env vars. Then Phase 2 is 100 % prod-deployed.

---

## 4. Your TODO (next Devin)

### 4.1 Read the protocol doc and verify state

```
1. cat docs/v3/workflow/devin_session_protocol.md
2. ssh root@103.74.5.44 'pm2 list && docker ps && curl -sS http://127.0.0.1:3001/health'
3. confirm: vipos-backend online, vipos-worker online, vipos-redis Up,
   /health returns db.ok=true redis.ok=true
4. if any drift from §2 above, lapor to founder before continuing
```

### 4.2 Merge PR #81 (only after founder says "gas merge")

```
PR:        https://github.com/alviarts/VIPOS/pull/81
Branch:    devin/1777982825-sentry-source-maps
CI status: 3/3 pass at last check
Review:    no comments outstanding

If founder has already said "gas merge" in the chat that started your
session: squash-merge via the same REST-API workaround documented in
the protocol doc §5 (PAT + curl, since the proxy still 403s on
git_pr action=create / git_comment).
```

### 4.3 Deploy frontend with source-maps to VPS

The four secrets are already in your env (org-scope permanent):
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT_FRONTEND`,
`VIPOS_SENTRY_DSN_FRONTEND`. Map `SENTRY_PROJECT_FRONTEND` →
`SENTRY_PROJECT` and `VIPOS_SENTRY_DSN_FRONTEND` →
`VITE_SENTRY_DSN_FRONTEND` when invoking the build (the plugin reads
`SENTRY_PROJECT`, the SDK reads `VITE_SENTRY_DSN_FRONTEND`).

```
1. ssh root@103.74.5.44
2. cd /var/www/vipos
3. git fetch origin && git checkout main && git pull --ff-only
4. # confirm HEAD now includes the squash-merged PR #81 commit
   git log --oneline -3
5. cd apps/web
6. cp -a dist dist.pre-sentry-$(date +%s)   # rollback breadcrumb
7. # install the new devDep (npm workspaces, hoists to root)
8. cd /var/www/vipos && npm install --include=dev
9. cd /var/www/vipos/apps/web
10. SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN}" \
    SENTRY_ORG="${SENTRY_ORG}" \
    SENTRY_PROJECT="${SENTRY_PROJECT_FRONTEND}" \
    VITE_SENTRY_DSN_FRONTEND="${VIPOS_SENTRY_DSN_FRONTEND}" \
    VITE_SENTRY_RELEASE="vipos-web@$(cd /var/www/vipos && git rev-parse --short HEAD)" \
      npm run build
11. # plugin output should include "> Found N source map files",
    # "Successfully uploaded", and end with the .map files removed.
12. ls /var/www/vipos/apps/web/dist/assets/*.map 2>/dev/null
    # expected: empty (filesToDeleteAfterUpload removes them)
13. # nginx serves dist/ via alias; no restart needed (content-hashed)
```

### 4.4 Smoke verify

```
1. Browser: https://sentry.io/organizations/vwrks/releases/
   → click vipos-web@<sha> → Artifacts tab → confirm bundle filenames
   listed with their sourcemap counterparts (Type column shows "release.file")
2. Open http://103.74.5.44/vipos/ in a browser, login as canary
   mbaksri / pilot2026! (tenant id=3), then trigger any frontend
   error — easiest is appending ?force=err to a route or pasting
   `throw new Error('smoke')` into devtools console.
3. Refresh Sentry Issues page filtered to environment=production +
   release=vipos-web@<sha>; new issue should appear within ~60 s
   with stack frames showing readable file paths
   (e.g. `apps/web/src/pages/DashboardPage.jsx:42:18`) instead of
   minified `index-XXXXXX.js:1:12345`.
4. Screenshot the Sentry stack-trace view and attach to the chat for
   founder visibility.
```

### 4.5 Update `devin_session_protocol.md` §3b checklist

After source-map upload is verified live, flip the row in §3b for the
last unchecked item from `❌` to `✓ DONE` and the table at top of
§3b to reflect Phase 2 = 8/8 prod. Open this as a tiny doc-only PR
(do not bundle it with anything else).

### 4.6 Lapor balik dan stop

Lapor to founder:

```
- Phase 2 prod-side now 100 % live (with screenshots/logs as evidence)
- Sentry source-map upload working (release artifacts URL)
- Outstanding follow-ups remaining:
    F4 sidebar overload  — needs founder product input
    F7 logout konfirm    — defer Phase 3 multi-user role
    Onboard merchant #1  — needs founder target
- Per founder direction earlier in this thread: testing not triggered
  yet. Bug-layer fixes blocked until founder explicitly requests.
```

Then stop the session with `block_on_user=true` until founder responds.

---

## 5. Secret inventory

### Available in your shell env (org-scope, auto-injected)

```
GITHUB_PAT                  — PAT for git pushes & REST API workaround
VPS_PASSWORD                — root@103.74.5.44
R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
                            — Cloudflare R2 (vipos-backup bucket)
SENTRY_AUTH_TOKEN           — sentry-cli upload, scoped project:read+write+releases
SENTRY_ORG                  — sentry org slug (vwrks)
SENTRY_PROJECT_FRONTEND     — sentry frontend project slug (vipos-web)
VIPOS_SENTRY_DSN_FRONTEND   — frontend DSN (project vipos-web)
```

### On the VPS at `/var/www/vipos/apps/backend/.env`

```
DATABASE_URL, DIRECT_URL    — postgres role vipos_app
JWT_SECRET                  — backend JWT signing
SENTRY_DSN, SENTRY_ENV, SENTRY_RELEASE — backend Sentry init
REDIS_URL                   — bullmq + rate-limit redis
S3_*, AWS_*                 — R2 backup (S3_ for SDK, AWS_ for aws-cli)
BACKUP_DIR=/var/backups/vipos, RETENTION_DAYS=14
```

### On the VPS at `/root/`

```
/root/.vipos-app-pwd        — postgres vipos_app role password (mode 600)
/root/.vipos-redis-pwd      — redis password (mode 600)
```

---

## 6. Canary tenant (do NOT delete)

```
tenant id:  3
slug:       warung-mie-mbak-sri
admin user: mbaksri / pilot2026!
purpose:    smoke-testing post-deploy without polluting future merchant data
```

---

## 7. Known quirks the proxy / tools do not handle

(See protocol doc §5 for the full list. Highlights for this handoff:)

- `git_pr(action="create")` and `git_comment` may 403 with "Resource
  not accessible by personal access token". Workaround: `curl` with
  `Authorization: token $GITHUB_PAT`. The protocol doc §5 has the
  exact command.
- `pm2 restart` takes 5-10 s for Sentry init + Prisma boot. Always
  poll `/health` in a loop after restart instead of asserting
  immediately.
- npm workspaces hoists shared deps to `/var/www/vipos/node_modules`,
  not per-app. Standalone scripts must resolve from the root, not the
  app dir.
- The Vite bundle is content-hashed, so nginx never serves stale; just
  ensure the rebuild succeeded before declaring deploy done.
