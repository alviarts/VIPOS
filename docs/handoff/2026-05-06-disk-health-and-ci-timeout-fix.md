# VIPOS Sesi Handoff — 2026-05-06 (disk-health probe + CI timeout fix)

Closed: 2026-05-06 ~14:55 UTC. Prepared by Devin in continuous-automation
mode. Devin session: <https://app.devin.ai/sessions/37291d97f04c45c18b7731c7cfd44e7f>

Successor to `2026-05-06-tier1-perf-followups.md` (which was re-closed at
~14:50 UTC by PR #152). This doc covers the next continuous-automation
session, which merged two PRs end-to-end: PR #102 (the open
`/api/health/disk` probe author `alviarts` had left ready) and PR #153
(a CI-config follow-up to absorb the apt-mirror flake that had blocked
PR #102's first CI run). Total time-to-handoff after secret bootstrap:
~25 minutes.

## TL;DR

Two green/yellow PRs merged + auto-deployed in one continuous run.
**`GET /api/health/disk` is now live in production** (returns
`status:ok, used_percent:71.16, threshold_percent:90` against the
`/var/backups/vipos` mount), pairing with PR #97's
`/api/health/backup` to give the monitoring stack two independent
disk-related signals. CI's `test` job now has a 15-minute budget
(was 10) so transient apt-archive slowdowns can no longer cancel an
otherwise-healthy run — root cause of PR #102's first CI run getting
cancelled at 10m12s while still on `apt-get update`.

Net effect:

- New endpoint: `GET /api/v1/health/disk` + legacy alias
  `/api/health/disk` → 200 `{status, mount, threshold_percent, fs:{
total_bytes, free_bytes, used_bytes, used_percent}}`. Returns 503
  with `status:high_usage` when `used_percent >= DISK_USAGE_THRESHOLD_PERCENT`
  (default 90; override per env). 5 outcome paths (`ok` / `high_usage` /
  threshold-edge / `no_mount` / `error`) covered by 9 unit + integration
  tests.
- CI test job timeout: 10 → 15 min (matching the build job). One-line
  config change with inline comment pointing at PR #102's flaked run
  (25421076324, job 74563134898 cancelled at 10m12s).
- Zero behaviour change to existing routes, frontend bundles, deploy
  pipeline, or any other surface.

Prod state at close (post-PR #153 deploy):

- Backend HEAD `8124af1` (PR #153 squash-merge SHA on `main`).
- `pm2 list` → `vipos-backend` (online, 101.8 MB, ~10 min uptime since
  PR #102's deploy at 14:44:30Z; pm2 not restarted by PR #153 because
  it's CI-config-only), `vipos-worker` (online, 55.2 MB, ~10 min
  uptime), `finance-bot-tg` (online, 6d uptime, 67.7 MB),
  `pm2-logrotate` (online).
- `/api/v1/health/disk` → `{"status":"ok","mount":"/var/backups/vipos","threshold_percent":90,"fs":{"used_percent":71.16,...}}` (verified
  via SSH `curl localhost:3001/api/v1/health/disk` and via public
  `http://103.74.5.44/vipos/api/v1/health/disk`).
- `/api/health` (existing) → expected ok / db ok / redis ok (unchanged
  this session — verified by deploy workflow's smoke step in CI).
- VPS: disk 35 GB / 49 GB (71%), well under the new probe's 90%
  default threshold.
- `tools/scripts/deploy.sh` untouched in both PRs — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Branch                             | Subject                                                                  | Risk   | Status                                                                                 |
| ---- | ---------------------------------- | ------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| #102 | `devin/1778050459-health-disk`     | feat(backend): `/api/health/disk` usage probe with 90% threshold default | yellow | merged `f8f41c7`; deploy 25442332939 ✅; endpoint verified live (used_percent 71.16)   |
| #153 | `devin/1778078818-ci-test-timeout` | ci(test): bump timeout-minutes 10 → 15 for apt-archive flake headroom    | green  | merged `8124af1`; deploy 25442876914 ✅ (no pm2 restart needed; CI-config-only change) |

PR #102 was open from a previous Devin session (author: `alviarts`,
opened 2026-05-06 06:58 UTC, head commit `4ed5731`). It had passed
lint + build but the `test` job had been cancelled at 10m12s during
`apt-get update`. This session re-triggered the failed jobs via
`POST /actions/runs/25421076324/rerun-failed-jobs` (run 25442190870
went 3/3 green in ~5 min), then merged via REST API squash. Verified
locally first: `npx vitest run src/__tests__/health-disk.test.mjs` →
9/9 passed in 1.12s.

PR #153 is this session's own follow-up. The 5-minute headroom on the
test job (15 vs 10 min) absorbs single-run apt-mirror slowdowns
without inflating happy-path CI time (test job typically completes
in 4-5 min).

## Root cause analysis: PR #102's first CI run cancelled

**Symptom**: PR #102's CI run 25421076324 finished as `cancelled` —
lint + build went green, but the `test (--if-present)` job (job_id 74563134898) was cancelled at 10m12s.

**Root cause**: `timeout-minutes: 10` budget on the test job was
exceeded by a transient slowdown on the Ubuntu archive mirror during
the `Provision non-superuser app role for RLS` step's `apt-get update`
call. Last log line before cancellation was at 06:59:56Z fetching
`https://archive.ubuntu.com/ubuntu noble-security InRelease`; the
runner sat there with no further output until the timeout fired at
07:08:33Z. No real test failure — re-run on the same commit completed
3/3 green in ~5 min.

**Fix (PR #153)**: Bump `timeout-minutes: 10` → `15` on the test job.
The build job runs the same apt step at `timeout-minutes: 15` and has
not flaked. The test job has strictly more provisioning steps (Postgres

- Redis services, MinIO docker boot, RLS app-role psql) so it deserves
  at least the same headroom. No change to job logic, env, or step order.

**Verification**: PR #153's own CI run (25442802054) → 3/3 green;
test job 74637925482 completed in well under the new 15-min budget.

**Why not "remove apt step entirely"** (alternative considered): the
GitHub-hosted Ubuntu 24.04 runner image does include
`postgresql-client` by default, so a `which psql` guard could replace
the `apt-get install` call. But that introduces image-version coupling
risk (next runner image bump could remove psql), so we kept the
explicit install and just gave it more time. If apt-archive flakes
become a recurring pattern, revisit the `which psql` shortcut as a
follow-up.

## Production state at close

### VPS (103.74.5.44)

- Repo path: `/var/www/vipos`. `git log --oneline -3`:
  ```
  8124af1 ci(test): bump timeout-minutes 10 -> 15 for apt-archive flake headroom (#153)
  f8f41c7 feat(backend): /api/health/disk usage probe with 90% threshold default (#102)
  a40e6d0 docs(handoff): amend with PRs #150 + #151 (signup-helpers + sentry-scrub regression) (#152)
  ```
- pm2 list (post-deploys):
  ```
  finance-bot-tg    online  6D uptime    67.7 MB
  vipos-backend     online  ~10m uptime  101.8 MB
  vipos-worker      online  ~10m uptime  55.2 MB
  pm2-logrotate     online  (untouched)
  ```
  `bot-wa` remains absent (deleted in `2026-05-06-tier1-perf-followups`
  session — see operational note 8 there).
- Disk: `/dev/sda1` 35 GB / 49 GB (71% used). Comfortably under the
  new `/api/v1/health/disk` 90% threshold. The `pre-deploy-*` snapshot
  rotation at 3 keeps this stable.
- Health probes (verified by SSH `curl localhost:3001/...`):
  - `/api/v1/health/disk` → `{"status":"ok","mount":"/var/backups/vipos","threshold_percent":90,"fs":{"total_bytes":51835101184,"free_bytes":15062249472,"used_bytes":36772851712,"used_percent":70.94}}`
  - `/api/health/disk` (legacy alias) → same payload structure.
  - Public URL `http://103.74.5.44/vipos/api/v1/health/disk` → same.

### Sentry / Backend / Frontend bundle

- Untouched this session. Frontend bundle bytes unchanged (PR #102
  is backend-only; PR #153 is CI-config-only).
- Sentry releases unchanged from prior handoff close.

### Credentials state (rotation table)

| Component            | Last rotation              | Owner                                                |
| -------------------- | -------------------------- | ---------------------------------------------------- |
| `GITHUB_PAT_VIPOS`   | 2026-05-06 (prior session) | Devin org-scope secret store (re-saved this session) |
| Postgres `postgres`  | 2026-05-04 cutover         | `/root/.vipos-pg-pwd` mode 600                       |
| Postgres `vipos_app` | 2026-05-04 cutover         | `/root/.vipos-app-pwd` mode 600                      |
| Redis                | 2026-05-04 cutover         | `/root/.vipos-redis-pwd` mode 600                    |
| Sentry build env     | 2026-05-05                 | `/root/.vipos-sentry-build.env` mode 600             |
| `VPS_PASSWORD`       | n/a (founder-managed)      | Devin org-scope secret store (re-saved this session) |

## Critical infrastructure context

(All carried over from `2026-05-06-tier1-perf-followups.md` unless
ticked here. Update only when the situation changes; don't duplicate
the surrounding text.)

### `git-manager.devin.ai/proxy` returns 403 on push (still active)

Verified again this session: `git push origin <branch>` returned 403.
PAT-fallback recipe in `docs/v3/workflow/devin_continuous_automation.md`
§4 (`HOME=/tmp/empty-home GIT_CONFIG_NOSYSTEM=1 GIT_ASKPASS=...
git push https://github.com/alviarts/VIPOS.git <branch>`) was used for
both PRs — push completed in <1 second each.

### `git_pr` tool returns 403 (REST API still required)

Did not retry the Devin tool this session; went straight to REST API
with `${GITHUB_PAT_VIPOS}` per the operational note in the previous
handoff. Both `POST /repos/alviarts/VIPOS/pulls` (PR create) and
`PUT /repos/alviarts/VIPOS/pulls/<n>/merge` (squash-merge) worked
on the first call.

### `GITHUB_PAT_VIPOS` rotation status

PAT was rotated 2026-05-06 by founder in a previous session. Verified
working this session — `curl -H "Authorization: Bearer ${GITHUB_PAT_VIPOS}"
https://api.github.com/repos/alviarts/VIPOS` returned 200 with full
metadata. **Note**: this session started with `secrets list` returning
empty (no `GITHUB_PAT_VIPOS`, no `VPS_PASSWORD` accessible), so the
founder re-saved both org-scope at session start. Future Devin
sessions: just reference `${GITHUB_PAT_VIPOS}` and `${VPS_PASSWORD}`;
if `secrets list` returns empty again, request both `should_save=true,
save_scope=org` upfront.

### `tools/scripts/deploy.sh` chicken-egg (still applies)

Neither PR touched `tools/scripts/deploy.sh`, so no
`workflow_dispatch` chicken-egg this session. The procedure stays
documented in `devin_continuous_automation.md` §5.

### CI test job's `apt-get update` flake (NEW context — fixed by PR #153)

Resolved this session by widening the test job's
`timeout-minutes: 10 → 15`. If a future apt flake exceeds even 15 min
(unlikely — build job has been at 15 for weeks without tripping),
fall back to dropping the explicit `apt-get install postgresql-client`
in favour of the runner image's preinstalled psql (Ubuntu 24.04
runner ships postgresql-client-16). Don't silence the timeout
indicator (e.g., setting it to 60+ min) — a stuck job should still
fail loudly, just not on noise.

## Outstanding backlog

### Tier 1 — no founder input needed

- **`CartesianChart` (recharts) chunk size** — still 334 kB pre-gzip,
  101 kB gzip. Carried over unchanged from previous handoff. Recharts'
  `sideEffects: false` already lets Rollup tree-shake the barrel
  optimally; the chunk is dominated by internal cross-references. The
  yellow-path deep-imports investigation in the prior session yielded
  0 byte savings. Meaningful reduction requires a chart-lib migration
  (e.g., uPlot, visx, vanilla SVG). Risk: yellow / red depending on
  visual parity. Estimate: 4-8 hours (per-chart rewrite). **No new
  work added this session — same status as carry-over.**

### Tier 2 — blocked on founder input

(All carried over from `2026-05-06-tier1-perf-followups.md` unless
ticked here.)

- **Branch protection on `main`** — phase-0 P0-04 unticked AC. Same
  status as carry-over.
- **HTTPS domain pick + Let's Encrypt** — same status.
- **Sidebar role-visibility rules** — same status.
- **Delete stale `GITHUB_PAT_2`** (proton-telegram-bot scope) — same
  status; founder can revoke + delete from org-scope at leisure.
- **PR #50** (`docs(P2-03): mark task as done in phase_2_backend.md`,
  author `alviarts`, opened 2026-05-04) — has merge conflicts
  (`mergeable_state: dirty`). Docs-only (1 file, 14 additions, 9
  deletions). **NEW Tier 2 entry** — needs founder decision: rebase
  - merge as-is, or close as superseded by subsequent docs. Not
    blocking any pipeline.
- **PR #1** (`VIPOS @ /vipos: Majoo API analysis + Section 19
features`, original initial PR) — still open from project genesis.
  Same status as before; can be closed at founder's convenience.

## Files modified this session

```
apps/backend/src/routes/health-disk.js                | 165 +++  PR #102 (new)
apps/backend/src/__tests__/health-disk.test.mjs       | 218 +++  PR #102 (new)
apps/backend/src/app.js                               |   3 ++   PR #102
.env.example                                          |   8 ++   PR #102
docs/runbook/deploy-checklist.md                      |   4 ++   PR #102
.github/workflows/ci.yml                              |   7 ++   PR #153
docs/handoff/2026-05-06-disk-health-and-ci-timeout-fix.md | (this file)  handoff PR
```

Total: 6 source/config files + 1 new handoff doc, ~405 insertions /
~10 deletions across PRs #102 + #153 + this handoff PR.

## Operational notes for next session

1. **`secrets list` returning empty at session start is a real
   precondition mismatch — request both `GITHUB_PAT_VIPOS` and
   `VPS_PASSWORD` org-scope upfront and resume.** Don't try to work
   around it; without the PAT you cannot push (proxy 403) or merge
   (REST API needs it), and without the VPS password you cannot
   SSH-verify post-deploy. This session re-requested both
   `should_save=true, save_scope=org` and they came back working in
   one round-trip.
2. **CI test job now has 15-minute budget** (was 10). If a future
   flake exceeds even 15, prefer dropping the explicit `apt-get
install postgresql-client` (psql preinstalled on Ubuntu 24.04
   runners) over bumping the timeout further. The 60-min nuclear
   option is reserved for genuinely-long jobs only.
3. **PR-rerun-failed-jobs is the right tool for transient CI
   cancellations.** PR #102's run was salvaged via
   `POST /repos/alviarts/VIPOS/actions/runs/<run_id>/rerun-failed-jobs`
   instead of pushing an empty commit. Cleaner audit trail (no churn
   on the branch) and re-uses the original commit's CI artifacts for
   the unchanged jobs.
4. **Backend-only health probes don't need infra to test locally.**
   PR #102's `health-disk.test.mjs` was a pure unit test using
   `fs.statfs` mocks — `npx vitest run` from `apps/backend` worked
   without Postgres or Redis. The "backend tests need Postgres +
   Redis locally" caveat in the prior handoff applies to the
   integration tests in `apps/backend/src/__tests__/integration/*`,
   not every backend test file.
5. **`/api/v1/health/disk` is now in monitoring scope.** Pair with
   `/api/v1/health/backup` (PR #97) for two independent
   disk-related signals — `health/backup` catches "the job stopped
   firing", `health/disk` catches "no room for tonight's dump". If
   founder wires uptime monitoring (Cronitor / UptimeRobot / similar),
   point it at both. The probes return 503 when over threshold so a
   simple status-code check is sufficient.
6. **`bot-wa` is **still** not part of VIPOS scope.** Verified again
   this session via `pm2 list` — only `vipos-backend`,
   `vipos-worker`, `finance-bot-tg`, `pm2-logrotate` present. Don't
   re-add `bot-wa` to backlogs.
