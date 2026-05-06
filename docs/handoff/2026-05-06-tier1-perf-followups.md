# VIPOS Sesi Handoff — 2026-05-06 (Tier-1 perf follow-ups)

Closed: 2026-05-06 ~10:18 UTC. Prepared by Devin in continuous-automation
mode. Devin session:
<https://app.devin.ai/sessions/52c2da66635d43a9a7c774b05036ae66>

Successor to `2026-05-06-phase1-ac-completion-and-bundle-split.md` (which
captured PRs #112–#119 / per-AC ticks + initial route-level
`React.lazy`). This doc starts at PR #122 and ends at PR #124, covering
the three Tier-1 backlog items that were ready to execute autonomously
this session.

## TL;DR

Three green/yellow PRs merged in one continuous run while resolving an
expired-PAT incident. **`apps/web` lazy chunks ≥ 400 kB previously**
(`ReportFilterBar` 717 kB and `DashboardPage` 417 kB) **both shrunk to
~10–31 kB by lifting their heavy deps into per-feature dynamic imports**
(`xlsx`, `jspdf`, `jspdf-autotable`, `recharts`). The eager bundle stays
at 401 kB / gzip 130 kB — login fast-path unaffected.

Net effect:

- Largest 2 lazy chunks crushed:
  - `ReportFilterBar-*.js` **716.70 kB → 9.99 kB** (-98.6%).
  - `DashboardPage-*.js` **416.80 kB → 30.83 kB** (-92.6%).
- New lazy chunks (only fetched on first interaction):
  - `xlsx-*.js` 429.53 kB (first Export Excel click).
  - `jspdf.es.min-*.js` 390.59 kB + `jspdf.plugin.autotable-*.js` 31.10
    kB (first Export PDF click).
  - `CartesianChart-*.js` 334.55 kB (first chart render under
    `/dashboard`).
  - `RevenueChart-*.js` 24.79 kB + `TopProductChart-*.js` 29.66 kB.
- `apps/web` test suite migrated 3 `.toBeNull()` DOM-absence sites to
  `.not.toBeInTheDocument()` to use `@testing-library/jest-dom` matchers
  consistently.
- Vite warning `chunks > 500 kB` stays absent.
- Zero behaviour change to backend, auth pages, or any non-Reports /
  non-Dashboard surface.

Prod state at close (post-PR #124 deploy):

- Backend HEAD `230ae23` (PR #124 squash-merge SHA on `main`).
- `pm2 list` → `vipos-backend` (online, 98.2 MB, 102s uptime),
  `vipos-worker` (online, 55.2 MB, 100s uptime), `finance-bot-tg`
  (online, 5d uptime), `pm2-logrotate` (online), `bot-wa` (stopped —
  pre-existing, untouched this session).
- `/api/health` → `{"status":"ok","db":{"ok":true},"redis":{"ok":true}}`.
- Web bundle: `apps/web/dist/assets/index-C55kLxdg.js` = **401,696 bytes
  pre-gzip** (eager, unchanged from PR #119 baseline).
- VPS: disk 35 GB / 49 GB (71%), RAM 22% used / 3.8 GB total.
- `tools/scripts/deploy.sh` untouched in every PR — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Subject                                                                                      | Risk   | Status                             |
| ---- | -------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| #122 | `perf(web): dynamic-import xlsx + jspdf in exportTable; ReportFilterBar 717kB→10kB`          | yellow | merged (`c5f4d71`); deploy success |
| #123 | `test(web): replace .toBeNull() with .not.toBeInTheDocument() on DOM queries`                | green  | merged (`cd90a15`); deploy success |
| #124 | `perf(web): lazy-load recharts via React.lazy on dashboard charts; DashboardPage 417kB→31kB` | yellow | merged (`230ae23`); deploy success |

(All three merged via REST API squash with `GITHUB_PAT_VIPOS` — see
**Critical infrastructure context** below for the PAT rotation incident
that gated PR #122.)

### PR #122 — split xlsx + jspdf out of ReportFilterBar

`apps/web/src/utils/exportTable.js` previously did
`import * as XLSX from 'xlsx'`, `import jsPDF from 'jspdf'`, and
`import autoTable from 'jspdf-autotable'` at the top of the file. Every
`/reports/*` page imports `ExportButtons.jsx` (which imports
`exportTable`), so Rollup gathered xlsx + jspdf into the shared
`ReportFilterBar-*.js` chunk pulled on every Reports navigation —
716.70 kB pre-gzip, even if the user never clicked Export.

Conversion:

- `exportXlsx(...)` is now `async` with `const XLSX = await import('xlsx')`
  inside the body.
- `exportPdf(...)` is now `async` with
  `const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])`.
- `exportCsv` / `exportJson` / `formatValue` left synchronous (no heavy
  deps).
- `ExportButtons.handleExport` is now `async` + `try/catch/finally`
  with a busy state and `react-hot-toast` error fallback so a dynamic
  import failure (network / cache miss) is surfaced rather than silent.
- The Export button is `disabled` while `busy` to avoid double-fires.

Bundle delta:

| Chunk                         | Before    | After       |
| ----------------------------- | --------- | ----------- |
| `ReportFilterBar-*.js`        | 716.70 kB | **9.99 kB** |
| `xlsx-*.js`                   | n/a       | 429.53 kB   |
| `jspdf.es.min-*.js`           | n/a       | 390.59 kB   |
| `jspdf.plugin.autotable-*.js` | n/a       | 31.10 kB    |
| Vite chunk-warning ≥ 500 kB   | absent    | absent      |

### PR #123 — jest-dom matcher consistency

Three `expect(screen.queryBy*(...)).toBeNull()` call sites in
`apps/web/src/__tests__` were converted to
`.not.toBeInTheDocument()` (a jest-dom matcher) so the assertion's DOM
intent is explicit and the failure message is jest-dom-tailored.

- `apps/web/src/__tests__/Sidebar.test.jsx` (collapsed-mode invariant).
- `apps/web/src/__tests__/ProductTabs.test.jsx` (variant base-product
  exclusion in the `combobox`).
- `apps/web/src/__tests__/OnboardingPage.test.jsx` (template fetch
  failure).

Other `.toBeTruthy()` / `.toBe(true)` / `.toBe(false)` sites
(`menu-groups.test.js`, `shared-types.test.js`, `ErrorBoundary.test.jsx`,
`DashboardPage.test.jsx`) operate on plain values (Zod parse result,
`errorInfo` object, boolean comparison) — not DOM elements — so jest-dom
matchers don't apply. Left as-is.

### PR #124 — split recharts out of DashboardPage

Same pattern as PR #122 but applied to `recharts` inside `DashboardPage`.
`DashboardPage.jsx` previously did a static
`import RevenueChart from '../components/charts/RevenueChart'` +
`import TopProductChart from '../components/charts/TopProductChart'`,
both pulling `recharts`. Since `/dashboard` is the first post-login
route, every user downloaded a 416.80 kB DashboardPage chunk
immediately after auth.

Conversion:

- `RevenueChart` + `TopProductChart` are now
  `React.lazy(() => import(...))`.
- Each rendered inside its own `<Suspense fallback={<ChartFallback ... />}>`
  with a rounded gray block reading 'Memuat grafik…' (`role="status"`
  for a11y).
- `DashboardPage.test.jsx` already mocked the chart modules via
  `vi.mock(path)`. Vitest's mock hoisting intercepts both static and
  dynamic imports of the same module path, so the tests work unchanged.

Bundle delta:

| Chunk                                   | Before    | After        |
| --------------------------------------- | --------- | ------------ |
| `DashboardPage-*.js`                    | 416.80 kB | **30.83 kB** |
| `RevenueChart-*.js`                     | n/a       | 24.79 kB     |
| `TopProductChart-*.js`                  | n/a       | 29.66 kB     |
| `CartesianChart-*.js` (recharts shared) | n/a       | 334.55 kB    |

Net UX: KPI cards / QuickActions / outlet selector / DateRangePicker
render right away; both chart cards show 'Memuat grafik…' for the brief
window while the recharts chunk lands (~334 kB; instant on broadband,
~1 s on 3G). Page shell renders well under a second on slow networks.

## Production state at close

### VPS

```
Host: 103.74.5.44 (xserver.local)
Repo: /var/www/vipos @ git HEAD 230ae23 (PR #124)
Disk: 35 GB / 49 GB used (71%)
RAM: 22% used / 3.8 GB total
Swap: 4% used
GH Actions deploy run for 230ae23: success (run id 25429273526)
```

### pm2 (post-deploy)

| ID  | Process        | Status  | Uptime | Mem     |
| --- | -------------- | ------- | ------ | ------- |
| 0   | pm2-logrotate  | online  | ~3d    | 35.0 MB |
| 1   | finance-bot-tg | online  | 5d     | 68.1 MB |
| 2   | bot-wa         | stopped | —      | 0 B     |
| 4   | vipos-backend  | online  | 102s   | 98.2 MB |
| 5   | vipos-worker   | online  | 100s   | 55.2 MB |

`bot-wa` remains stopped (pre-existing state from prior sessions; not in
scope for this run — see Tier-2 backlog).

### `/api/health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-05-06T10:01:14.911Z",
  "db": { "ok": true, "latency_ms": 41 },
  "redis": { "ok": true, "latency_ms": 9 }
}
```

### Web bundle (`apps/web/dist/assets/`)

| Chunk                                | Bytes   | Notes                                          |
| ------------------------------------ | ------- | ---------------------------------------------- |
| `index-C55kLxdg.js` (eager)          | 401,696 | Unchanged vs PR #119 baseline (login fast).    |
| `DashboardPage-D2lqPaiA.js`          | 31,220  | Was 416,800 before PR #124.                    |
| `ReportFilterBar-D6BGnC0N.js`        | 10,381  | Was 716,700 before PR #122.                    |
| `RevenueChart-BivSj-A0.js`           | 25,178  | Lazy.                                          |
| `TopProductChart-Cf2laVYN.js`        | 30,047  | Lazy.                                          |
| `CartesianChart-BWQVwfSP.js`         | 334,943 | Lazy; recharts shared, fetched on first chart. |
| `xlsx-Cwq4KIDV.js`                   | 429,926 | Lazy; first Export Excel click.                |
| `jspdf.es.min-De2JR0Kj.js`           | 390,978 | Lazy; first Export PDF click.                  |
| `jspdf.plugin.autotable-DcrDlGgF.js` | 31,489  | Lazy; first Export PDF click.                  |

### Sentry

- Org `cognition-ai`, project `vipos-backend` + `vipos-frontend`.
- No Sentry-related changes this session — release pipeline state
  unchanged from `2026-05-06-phase1-ac-completion-and-bundle-split.md`.

### Credentials state

| Component            | Last rotation                 | Owner                           |
| -------------------- | ----------------------------- | ------------------------------- |
| `GITHUB_PAT_VIPOS`   | **2026-05-06 (this session)** | org-scope (Devin secret)        |
| Postgres superuser   | 2026-05-05 (post-cryptominer) | `/root/.vipos-pg-pwd`           |
| Postgres `vipos_app` | 2026-05-05                    | `/root/.vipos-app-pwd`          |
| Redis                | 2026-05-05                    | `/root/.vipos-redis-pwd`        |
| Sentry build env     | unchanged                     | `/root/.vipos-sentry-build.env` |

## Critical infrastructure context

### `git-manager.devin.ai/proxy` returns 403 on push (still active)

`git push origin <branch>` to the Devin proxy still returns 403. Workaround
documented in `docs/v3/workflow/devin_continuous_automation.md` §4
(`HOME=/tmp/empty-home GIT_CONFIG_NOSYSTEM=1 GIT_ASKPASS=...
git push https://github.com/alviarts/VIPOS.git <branch>`) is what was
used for all three PRs. **Confirmed working** with the freshly rotated
PAT — push throughput normal, no rate-limit issues.

### `git_pr` tool returns 403 (REST API still required)

The Devin `git_pr` tool (action `create` / `merge`) still routes through
the proxy and 403s. Direct REST API with `GITHUB_PAT_VIPOS` keeps
working:

```bash
# Create
curl -sS -X POST -H "Authorization: Bearer ${GITHUB_PAT_VIPOS}" \
  -H "Accept: application/vnd.github+json" \
  -d @/tmp/pr-body.json \
  https://api.github.com/repos/alviarts/VIPOS/pulls

# Squash-merge after CI green
curl -sS -X PUT -H "Authorization: Bearer ${GITHUB_PAT_VIPOS}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"merge_method":"squash"}' \
  https://api.github.com/repos/alviarts/VIPOS/pulls/<num>/merge
```

`git pr_checks` (read-only) keeps working — no need to substitute that.

### **NEW: `GITHUB_PAT_VIPOS` rotation (2026-05-06 this session)**

When this session started, both `GITHUB_PAT_VIPOS` and the legacy
`GITHUB_PAT` (proton-telegram-bot scope) returned `401 Bad credentials`
against `api.github.com`, blocking the entire push / PR / merge path.
Founder rotated `GITHUB_PAT_VIPOS` mid-session via the Devin secrets UI
(`should_save=true`, `save_scope=org`). All three PRs were pushed +
opened + merged with the new PAT. **Future Devin sessions: the new PAT
is in org-scope; just reference `${GITHUB_PAT_VIPOS}` and continue.**

If the PAT 401s again in the future:

1. Generate a fine-grained PAT at
   <https://github.com/settings/personal-access-tokens/new>:
   - Repository access → 'Only select repositories' → `alviarts/VIPOS`.
   - Permissions → Contents: read+write, Pull requests: read+write,
     Metadata: read.
2. Update the org-scope secret named `GITHUB_PAT_VIPOS` (Devin Settings →
   Secrets → org).
3. Per protocol, never write the PAT to a VPS file — it lives only in
   the Devin secret store.

### `tools/scripts/deploy.sh` chicken-egg (still applies)

This session did **not** modify `tools/scripts/deploy.sh`, so no
`workflow_dispatch` was needed. Procedure stays the same as documented
in §5 of `devin_continuous_automation.md`: edit deploy.sh → merge → first
auto-deploy uses old script → manual `workflow_dispatch` triggers the
new script.

## Outstanding backlog

### Tier 1 — no founder input needed

- **`bot-wa` pm2 entry stopped** — pre-existing state since at least
  the 2026-05-05 cryptominer cleanup. Three options for the next session:
  - (a) Investigate WA bot codebase under `apps/`, fix or remove
    accordingly, and PR the change.
  - (b) Permanently `pm2 delete bot-wa` if the founder confirms it's
    deprecated (this is a **Tier-2** ask once it requires founder
    decision; just leave it alone otherwise).
  - (c) No-op — keep status quo. **Recommendation**: leave it stopped
    until the founder explicitly asks to revisit. Risk: green / yellow.
    Estimate: 0.5–2 hours depending on path.
- **DashboardPage chart loading flicker** — `<ChartFallback>` renders for
  the brief window while `CartesianChart-*.js` lands. On first
  navigation the user sees 'Memuat grafik…' for ~300 ms on broadband.
  Could be smoothed with: (a) `link rel=modulepreload` on the chart
  chunks from inside the DashboardPage shell, (b) a more visually
  matched skeleton (gray bars where the chart will be) instead of the
  generic `<ChartFallback>`. Risk: green. Estimate: 1 hour.
- **xlsx / jspdf preload on Reports navigation** — same idea: when
  `ReportFilterBar` mounts, optionally `link rel=prefetch` `xlsx-*.js`
  - `jspdf.es.min-*.js` so the first Export click feels instant.
    Trade-off: extra background bandwidth for users who never export.
    Defer until we have telemetry on how often `/reports/*` users actually
    export. Risk: yellow. Estimate: 1–2 hours + measurement.

### Tier 2 — blocked on founder input

(Carried over from `2026-05-06-phase1-ac-completion-and-bundle-split.md`
unless ticked here.)

- **Branch protection on `main`** — phase-0 P0-04 unticked AC. Founder
  needs to enable required reviewers / required status checks /
  disallow direct push on `github.com/alviarts/VIPOS`. Once enabled, the
  REST-API-merge flow keeps working (it's a regular merge_method=squash;
  branch protection still allows it as long as CI is green).
- **HTTPS domain pick + Let's Encrypt** — production currently served
  at `http://103.74.5.44/vipos/`. Founder needs to pick a domain (e.g.
  `app.vipos.id`) and DNS-point it to the VPS so we can run certbot.
- **Sidebar role-visibility rules** — needs founder spec on what each
  role (`OWNER`, `MANAGER`, `CASHIER`, `KIOSK`) should see.
- **Delete stale `GITHUB_PAT_2`** — there's still a non-VIPOS `GITHUB_PAT`
  (proton-telegram-bot scope) in the Devin secret store. It 401s now
  and isn't needed for VIPOS work. Founder can revoke + delete from
  org-scope secrets at leisure.
- **Decision on `bot-wa`** — see Tier-1 above; once founder clarifies
  intent it becomes Tier-1.

## Files modified this session

```
apps/web/src/__tests__/OnboardingPage.test.jsx    |  4 ++--   PR #123
apps/web/src/__tests__/ProductTabs.test.jsx       |  2 +-     PR #123
apps/web/src/__tests__/Sidebar.test.jsx           |  2 +-     PR #123
apps/web/src/components/reports/ExportButtons.jsx | 28 ++++++++++++++++-----     PR #122
apps/web/src/pages/DashboardPage.jsx              | 30 +++++++++++++++++++----   PR #124
apps/web/src/utils/exportTable.js                 | 23 +++++++++++++----    PR #122
docs/handoff/2026-05-06-tier1-perf-followups.md   | (this file)             handoff PR
```

Total: 6 source files, 70 insertions / 19 deletions across PRs
#122–#124.

## Smoke test infrastructure

No new Playwright / smoke scripts introduced this session. Existing
infrastructure under `apps/web/src/__tests__/` (vitest + RTL + jsdom)
unchanged in shape; one PR (#123) just migrated three matcher sites.
Existing `vi.mock('../components/charts/RevenueChart', ...)` pattern in
`DashboardPage.test.jsx` continues to work with `React.lazy` after PR
#124.

## Operational notes for next session

1. **Use `${GITHUB_PAT_VIPOS}` directly with the REST API** for any
   PR creation / merge. The Devin `git_pr` tool still 403s through the
   proxy. PAT was rotated this session; still valid as of close.
2. **Check `secrets list` first if push 401s.** If both
   `GITHUB_PAT_VIPOS` and `GITHUB_PAT` 401, follow §1 above — request a
   fresh PAT via `secrets request` (org-scope) and resume. Don't waste
   time retrying the same token.
3. **`HOME=/tmp/empty-home GIT_CONFIG_NOSYSTEM=1`** is still the only
   way to bypass the proxy rewrite in `/etc/gitconfig` when pushing
   directly to `github.com`. The full snippet is in
   `devin_continuous_automation.md` §4.
4. **No `manualChunks` config in Vite.** All bundle splitting in this
   session was achieved purely via per-route `React.lazy` (PR #119) and
   per-feature dynamic `import()` (PRs #122 + #124). If future bundles
   regress, prefer the same pattern over adding `manualChunks` —
   simpler, less coupling, and Rollup heuristics handle it well.
5. **Vitest `vi.mock(path)` works with `React.lazy`.** When converting a
   static import to lazy, you do **not** need to update the test mock —
   `vi.mock` hoists and intercepts both static and dynamic imports of
   the same path. Verified in PR #124 + the existing
   `DashboardPage.test.jsx`.
6. **Backend tests need Postgres + Redis locally.** `npm run test`
   from repo root runs the full backend suite which 49/59 fails
   without infra. CI in GH Actions provides those services and runs
   green. For local web-only verification use
   `npm run test --workspace=apps/web` (14 files / 82 tests).
7. **VPS auto-deploy already triggers on `main` push.** GH Actions
   workflow `deploy-vps.yml` deploys every push to `main` (we saw runs
   25428634682, 25428990633, 25429273526 succeed end-to-end this
   session). No manual step needed unless `tools/scripts/deploy.sh`
   itself was modified.
8. **`bot-wa` is intentionally untouched.** Multiple sessions have left
   it `stopped`. Don't restart or delete without explicit founder
   instruction — risk of unexpected webhook traffic / billing surprise.
