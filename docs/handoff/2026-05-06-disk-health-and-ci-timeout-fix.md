# VIPOS Sesi Handoff — 2026-05-06 (disk-health probe + CI timeout fix)

Closed: 2026-05-06 ~14:55 UTC. Re-closed: 2026-05-06 ~15:10 UTC by
amend PR after merging PR #155 (CI build-smoke follow-up to PR #102).
Re-closed: 2026-05-06 ~15:30 UTC by amend PR #158 after merging
PR #157 (deploy-smoke follow-up). Re-closed: 2026-05-06 ~16:10 UTC
by this amend PR after merging **PR #159** (recharts → vanilla SVG
chart migration; −377 kB / −113.7 kB gzip; **96% bundle reduction**)
and **PR #160** (deploy smoke retry + max-time cap; fixes the 4-min
hang seen on PR #159's deploy run 25445961488). Prepared by Devin
in continuous-automation mode. Devin session:
<https://app.devin.ai/sessions/37291d97f04c45c18b7731c7cfd44e7f>

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

Prod state at close (post-PR #160 deploy at ~16:06 UTC):

- Backend HEAD `d44215c` (PR #160 squash-merge SHA on `main`).
- `pm2 list` → `vipos-backend` (online, 99.9 MB, ~2 min uptime since
  PR #160's deploy), `vipos-worker` (online, 55.3 MB, ~2 min uptime),
  `finance-bot-tg` (online, 6d uptime, 68.5 MB), `pm2-logrotate`
  (online).
- `/api/v1/health/disk` → `{"status":"ok","mount":"/var/backups/vipos","threshold_percent":90,"fs":{"used_percent":71.06,...}}` (verified
  via SSH `curl localhost:3001/api/v1/health/disk` and via public
  `http://103.74.5.44/vipos/api/v1/health/disk`).
- `/api/health` (existing) → 200 (verified via deploy 25446623776's
  retry-enabled smoke step).
- VPS: disk 35 GB / 49 GB (72%), well under the probe's 90%
  default threshold.
- Frontend chunks live: `RevenueChart-BGwmECCc.js` (9.5 kB),
  `TopProductChart-Cw-m8AsT.js` (3.29 kB), `useChartSize-668n_Adz.js`
  (0.85 kB). NO `CartesianChart-*.js` (recharts gone, confirmed via
  `ls apps/web/dist/assets/`).
- `tools/scripts/deploy.sh` untouched in all 6 PRs this session — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Branch                                         | Subject                                                                        | Risk   | Status                                                                                                                                                                          |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #102 | `devin/1778050459-health-disk`                 | feat(backend): `/api/health/disk` usage probe with 90% threshold default       | yellow | merged `f8f41c7`; deploy 25442332939 ✅; endpoint verified live (used_percent 71.16)                                                                                            |
| #153 | `devin/1778078818-ci-test-timeout`             | ci(test): bump timeout-minutes 10 → 15 for apt-archive flake headroom          | green  | merged `8124af1`; deploy 25442876914 ✅ (no pm2 restart needed; CI-config-only change)                                                                                          |
| #155 | `devin/1778079934-ci-smoke-disk-health`        | ci(smoke): also curl `/api/v1/health/disk` after backend boot                  | green  | merged `26b0828`; CI 3/3 ✅ (smoke step verified the new probe returns 200 ok)                                                                                                  |
| #157 | `devin/1778080968-deploy-smoke-disk-info`      | ci(deploy): informational `/api/v1/health/disk` curl in live smoke             | green  | merged `0856eca`; deploy 25444751281 ✅; deploy log shows `disk     HTTP 200` line                                                                                              |
| #159 | `devin/1778081933-cartesian-chart-vanilla-svg` | perf(web): replace recharts with vanilla SVG charts (−377 kB / −113.7 kB gzip) | yellow | merged `2bf09ab`; deploy 25445961488 (smoke flaked, see PR #160 RCA); production verified healthy via SSH (new chart bundle live, no CartesianChart-\*.js, pm2 backend 99.9 MB) |
| #160 | `devin/1778083192-deploy-smoke-retry`          | ci(deploy): retry + cap smoke-curl timeouts (run 25445961488 4-min hang)       | green  | merged `d44215c`; deploy 25446623776 ✅; smoke now `frontend HTTP 200` / `health HTTP 200` / `disk HTTP 200` in <2 sec total                                                    |

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

PR #155 is a second PR-#102 follow-up. Extends the build job's
existing **Smoke check backend can start** step to also `curl
/api/v1/health/disk` after the existing `/api/health` curl. The unit
tests in `apps/backend/src/__tests__/health-disk.test.mjs` cover the
route's logic in isolation; the smoke addition catches the narrow
regression where someone removes the `parent.use('/health/disk',
healthDiskRouter)` line in `app.js` but doesn't update unit tests.
Set `DISK_HEALTH_MOUNT: /tmp` in the smoke env so the probe sees a
real low-usage filesystem (else the default `./var/backups` doesn't
exist on the runner and the probe returns 503 `no_mount`, failing
`curl -fsS`).

PR #157 is the third PR-#102 follow-up. Adds a non-blocking curl
to `/api/v1/health/disk` in the deploy-vps workflow's post-deploy
smoke step (right after the existing frontend + `/api/health` curls).
Deliberately uses `curl -sS ... || true` (no `-f`, no fail-on-error)
so a 503 `status:high_usage` response shows up in the deploy log
but does not block the deploy itself — blocking deploys on a
near-full disk would create a catch-22 where the disk-cleanup fix
can't ship. Confirmed in deploy run 25444751281: log line
`disk     HTTP 200` printed alongside the existing `frontend HTTP
200` + `health   HTTP 200`.

## PR #159 — recharts → vanilla SVG chart migration

The two dashboard charts (`RevenueChart` area + `TopProductChart`
horizontal bar) were the only consumers of `recharts`. Their lazy
chunks pulled in the entire shared `CartesianChart-*.js` chunk
(334.55 kB / 101.58 kB gzip) plus per-chart wrappers. Replaced both
components with hand-rolled SVG + scales:

| chunk           | before                   | after                  | delta                      |
| --------------- | ------------------------ | ---------------------- | -------------------------- |
| RevenueChart    | 24.79 kB / 7.98 kB gzip  | 9.11 kB / 3.58 kB gzip | −15.7 / −4.4 kB            |
| TopProductChart | 29.66 kB / 9.23 kB gzip  | 2.90 kB / 1.51 kB gzip | −26.8 / −7.7 kB            |
| CartesianChart  | 334.55 kB / 101.58 kB gz | (gone)                 | −334.5 / −101.6 kB         |
| **total**       | **389 kB / 118.8 kB gz** | **12 kB / 5.1 kB gz**  | **−377 / −113.7 kB (96%)** |

New shared hook: `apps/web/src/components/charts/useChartSize.js`
(40 lines) wraps `ResizeObserver` + seeds initial size from
`getBoundingClientRect`. jsdom's `ResizeObserver` is already a
no-op stub in `apps/web/src/__tests__/setup.js`; charts short-circuit
to their empty-state placeholder when width/height are 0, which keeps
existing test mocks honest. Visual contract preserved:
mint-green stroke `#04C99E` + linear gradient fill (`RevenueChart`),
right-rounded bars (`TopProductChart`), tooltip cards, empty-state
copy. 6 new regression tests pin the migration
(`RevenueChart.test.jsx`, `TopProductChart.test.jsx`).

38 transitive `recharts` deps removed from `package-lock.json`.

## PR #160 — deploy smoke retry + timeout cap

PR #159's deploy run (25445961488) failed the smoke step with
`health HTTP 000` after the curl hung for **4 minutes 11 seconds**
(15:52:53 → 15:57:12). Backend logs on the VPS showed the pm2
process actually came online at 15:52:51 — 2 seconds _before_ the
smoke step started — so the curl was racing nginx's upstream-pool
refresh window, not a real backend outage. Single-shot `curl -fsS`
had no retry and no `--max-time` cap, so one transient `000` /
connect-refused stalled the runner for the full default until
`set -e` failed the job.

Fix: all three smoke curls (frontend, health, disk) now use
`--retry 5 --retry-delay 3 --retry-connrefused --max-time 30`,
plus initial `sleep 5 → sleep 10` for a bit more cold-restart
headroom. Disk curl keeps trailing `|| true` (catch-22 prevention
from PR #157). Deploy run 25446623776 confirmed the fix:
`frontend HTTP 200` (16:06:26.13) → `health HTTP 200`
(16:06:26.76) → `disk HTTP 200` (16:06:27.27) — all three in
~1.6 sec total.

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
.github/workflows/ci.yml                              |   7 ++   PR #153 (test job timeout)
.github/workflows/ci.yml                              |  11 ++   PR #155 (build smoke step + DISK_HEALTH_MOUNT env)
.github/workflows/deploy-vps.yml                      |   8 ++   PR #157 (deploy smoke informational curl)
.github/workflows/deploy-vps.yml                      |  17 +/- 5  PR #160 (smoke retry + max-time cap)
apps/web/package.json                                 |   1 −   PR #159 (recharts dep removed)
apps/web/src/components/charts/useChartSize.js        |  43 ++  PR #159 (new ResizeObserver hook)
apps/web/src/components/charts/RevenueChart.jsx       | 211 +/- 55  PR #159 (rewrite)
apps/web/src/components/charts/TopProductChart.jsx    | 170 +/- 35  PR #159 (rewrite)
apps/web/src/__tests__/RevenueChart.test.jsx          |  67 ++  PR #159 (regression tests)
apps/web/src/__tests__/TopProductChart.test.jsx       |  73 ++  PR #159 (regression tests)
package-lock.json                                     | −400      PR #159 (38 transitive recharts deps removed)
docs/handoff/2026-05-06-disk-health-and-ci-timeout-fix.md | (this file)  handoff PR + 3 amends
```

Total: 13 source/config files + 1 new handoff doc (with three amends),
~1024 insertions / ~510 deletions across PRs #102 + #153 + #155 +
#157 + #159 + #160 + handoff PR + 3 amend PRs.

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
