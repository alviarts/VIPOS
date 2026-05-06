# VIPOS Sesi Handoff — 2026-05-06 (Tier-1 perf follow-ups)

Closed: 2026-05-06 ~10:50 UTC. Prepared by Devin in continuous-automation
mode. Devin session:
<https://app.devin.ai/sessions/52c2da66635d43a9a7c774b05036ae66>

Successor to `2026-05-06-phase1-ac-completion-and-bundle-split.md` (which
captured PRs #112–#119 / per-AC ticks + initial route-level
`React.lazy`). This doc starts at PR #122 and ends at PR #133, covering
six Tier-1 perf items + three test-coverage items that were ready to
execute autonomously this session.

## TL;DR

Nine green/yellow PRs merged in one continuous run while resolving an
expired-PAT incident. **`apps/web` lazy chunks ≥ 400 kB previously**
(`ReportFilterBar` 717 kB and `DashboardPage` 417 kB) **both shrunk to
~10–31 kB by lifting their heavy deps into per-feature dynamic imports**
(`xlsx`, `jspdf`, `jspdf-autotable`, `recharts`), with chart prefetch +
bar-skeleton + Export busy spinner polishing the resulting UX. Test
coverage on the touched surface area went from 14 files / 82 tests to
**16 files / 103 tests** (+1 file ExportButtons regression, +1 file
exportTable.js regression, plus jsdom matchMedia/ResizeObserver
stubs in shared setup). The eager bundle stays at 401 kB / gzip 130 kB
— login fast-path unaffected.

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

Prod state at close (post-PR #129 deploy):

- Backend HEAD `c74f36e` (PR #129 squash-merge SHA on `main`).
- `pm2 list` → `vipos-backend` (online, 100.5 MB, 116s uptime),
  `vipos-worker` (online, 55.1 MB, 114s uptime), `finance-bot-tg`
  (online, 5d uptime), `pm2-logrotate` (online), `bot-wa` (stopped —
  pre-existing, untouched this session).
- `/api/health` → `{"status":"ok","db":{"ok":true,"latency_ms":33},"redis":{"ok":true,"latency_ms":9}}`.
- Web bundle: `apps/web/dist/assets/index-v4U4f4Zx.js` = **401,710 bytes
  pre-gzip** (eager, +14 bytes from #119 baseline).
- VPS: disk 35 GB / 49 GB (71%), RAM 22% used / 3.8 GB total.
- `tools/scripts/deploy.sh` untouched in every PR — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Subject                                                                                         | Risk   | Status                             |
| ---- | ----------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| #122 | `perf(web): dynamic-import xlsx + jspdf in exportTable; ReportFilterBar 717kB→10kB`             | yellow | merged (`c5f4d71`); deploy success |
| #123 | `test(web): replace .toBeNull() with .not.toBeInTheDocument() on DOM queries`                   | green  | merged (`cd90a15`); deploy success |
| #124 | `perf(web): lazy-load recharts via React.lazy on dashboard charts; DashboardPage 417kB→31kB`    | yellow | merged (`230ae23`); deploy success |
| #125 | `docs(handoff): close 2026-05-06 Tier-1 perf follow-ups session` (this doc, initial draft)      | green  | merged (`8e76507`); deploy success |
| #126 | `perf(web): prefetch dashboard chart chunks in useEffect to mask Suspense fallback`             | green  | merged (`00982c2`); deploy success |
| #127 | `docs(handoff): amend 2026-05-06 Tier-1 perf doc with PR #126 (chart prefetch)`                 | green  | merged (`1e16b39`); deploy success |
| #128 | `feat(reports): show inline spinner + 'Memuat…' on Export button while xlsx/pdf chunk loads`    | green  | merged (`998aad2`); deploy success |
| #129 | `feat(dashboard): use bar-skeleton for ChartFallback instead of flat placeholder`               | green  | merged (`c74f36e`); deploy success |
| #130 | `docs(handoff): final amend with PRs #128, #129 + post-deploy prod state`                       | green  | merged (`55bd5c8`); deploy success |
| #131 | `test(web): add ExportButtons regression tests for disabled, dropdown, sync, busy, error paths` | green  | merged (`7d07608`); deploy success |
| #132 | `test(web): stub matchMedia, ResizeObserver, IntersectionObserver in test setup`                | green  | merged (`d6c7752`); deploy success |
| #133 | `test(web): add exportTable.js regression tests for csv/json/formatValue`                       | green  | merged (`c7bab47`); deploy success |
| #134 | `docs(handoff): amend with PRs #131-#133 (test coverage)` (this PR)                             | green  | pending merge                      |

(All twelve merged via REST API squash with `GITHUB_PAT_VIPOS` — see
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

### PR #126 — prefetch dashboard chart chunks on mount

Follow-up to #124 to mask the brief 'Memuat grafik…' fallback. Added a
one-shot `useEffect` in `DashboardPage` that fires `import('.../RevenueChart')`

- `import('.../TopProductChart')` as fire-and-forget prefetch. Dynamic
  imports are cached by the bundler, so the `React.lazy(() => import(…))`
  calls reuse the same promise at render time — the recharts chunk
  downloads in parallel with the four `/dashboard/*` API fetches.

Bundle delta: `DashboardPage-*.js` 30.83 kB → 31.00 kB (+0.17 kB for the
extra effect). Charts and `CartesianChart` chunks unchanged. No new
chunks. Vite warning still absent.

Risk: green (additive prefetch only; no render-path change). `vi.mock`
in `DashboardPage.test.jsx` continues to intercept the prefetch dynamic
import via vitest hoisting. All 14 web test files / 82 tests still
green.

### PR #128 — Export button busy spinner

Follow-up to #122. Pre-#122 the xlsx + jspdf libs were eager so Export
clicks were instant; post-#122 the disabled-only state (`opacity-50`)
gives no progress feedback while the dynamic import is in flight. On
slow networks users may think the click didn't register and click
again.

Fix: in `apps/web/src/components/reports/ExportButtons.jsx`, the Export
trigger now renders a `Loader2` spinner (lucide-react) + 'Memuat…'
label when `busy=true`, plus `aria-busy` for screen readers. Icons get
`aria-hidden="true"` since the visible text already conveys state. CSV
/ JSON exports stay synchronous; the spinner only shows for xlsx + PDF
(the formats with dynamic imports).

Bundle delta: `ReportFilterBar-*.js` 9.99 → 10.23 kB (+0.24 kB for the
`Loader2` import + branch).

Risk: green (visual-only enhancement; no behaviour change to Export
flow, no new props or API surface).

### PR #129 — ChartFallback bar-skeleton

Follow-up to #124 + #126. The `ChartFallback` placeholder used to be a
flat gray box with the text 'Memuat grafik…'. It now renders a
bar-chart skeleton: faint Y-axis line on the left + 12 bars of varying
height + Tailwind `animate-pulse` shimmer.

While #126's prefetch makes the fallback rarely visible on warm loads,
this PR makes the cold-load / slow-network experience smoother — the
placeholder now visually grounds the user to the chart layout that's
about to appear, instead of the page reflowing from a flat box to a
chart.

A11y: outer `<div>` keeps `role="status"` + `aria-label={label}` so
screen readers announce the loading state per chart card. Each bar
`<div>` is `aria-hidden="true"` (decorative). The 'Memuat grafik…'
text is preserved via an `sr-only` `<span>` for screen readers.

Bundle delta: `DashboardPage-*.js` 31.00 → 31.28 kB (+0.28 kB for the
bars array + map). On VPS: `DashboardPage-CgDFt8pc.js` = 31,675 bytes.

Risk: green.

### PR #131 — ExportButtons regression tests

Added `apps/web/src/__tests__/ExportButtons.test.jsx` (6 cases). Pins
existing public behaviour for the component touched by #122 + #128:

1. Disabled trigger when `rows.length === 0`.
2. Disabled trigger when `disabled` prop is `true`.
3. `formats={['csv', 'xlsx']}` filters dropdown to 2 items.
4. CSV click calls `exportCsv` synchronously without flipping busy.
5. XLSX click flips busy + shows `Memuat…` spinner during pending
   `import('xlsx')`; clears after resolve.
6. PDF rejection calls `toast.error(/Export PDF gagal/i)` and clears
   busy state.

Mocks `../utils/exportTable` (4 fns) via `vi.hoisted`, and mocks
`react-hot-toast` to a `{ error, success }` stub so the real `Toaster`
(which calls `matchMedia`) doesn't load. `console.error` is silenced
during the expected catch path.

Risk: green (test-only, no source/dep changes).

### PR #132 — jsdom global stubs in shared test setup

Added permissive stubs for `window.matchMedia`, `window.ResizeObserver`,
and `window.IntersectionObserver` to `apps/web/src/__tests__/setup.js`.
jsdom doesn't ship them, and several deps (react-hot-toast `Toaster`,
recharts `ResponsiveContainer`, headlessui) call them at render time.
Future tests that want to assert real toast UX or mount a chart
container no longer need per-file polyfills.

Stub semantics: `matchMedia` returns `{ matches: false, … }` so tests
don't accidentally depend on real media-query state.
`ResizeObserver` + `IntersectionObserver` are no-op classes (with
`takeRecords` returning `[]` for the latter). All three are guarded
with `typeof === 'undefined'` so future jsdom upgrades won't be
overwritten.

Risk: green (test-infrastructure only, no production bundle impact).

### PR #133 — exportTable.js regression tests

Added `apps/web/src/__tests__/exportTable.test.js` (15 cases) for the
sync helpers in the util touched by #122. `exportXlsx` / `exportPdf`
behavioural coverage stays in #131 via integration mocks since their
dynamic imports are heavy to mock at the unit level.

- `exportCsv` (7): UTF-8 BOM, `.csv` extension append, comma + nested
  double-quote escaping (`"Klasik"` → `""Klasik""`), newline
  preservation as quoted field, raw numeric cells (no `Rp` prefix in
  CSV), empty-string for `null`/`undefined`, `text/csv;charset=utf-8`
  content-type.
- `exportJson` (3): pretty-printed indent, explicit-`.json` filename
  preservation, `application/json` content-type.
- `formatValue` (5): currency/number/date dispatch, unknown-type
  passthrough, `null`/`undefined` → empty string.

`setupBlobCapture()` monkey-patches `window.Blob` with a
`CapturingBlob` subclass that retains the original `parts` array
(jsdom's `Blob.text()` isn't reliable across versions) plus stubs
`URL.createObjectURL` + `HTMLAnchorElement.prototype.click` to
capture the download filename without actually downloading.

Test suite total after #133: **16 files / 103 tests** passing (was
14 / 82 at session start; +2 files / +21 tests this session).

Risk: green (test-only, no source/dep changes).

## Production state at close

### VPS

```
Host: 103.74.5.44 (xserver.local)
Repo: /var/www/vipos @ git HEAD c7bab47 (PR #133)
Disk: 35 GB / 49 GB used (71%)
RAM: 22% used / 3.8 GB total
Swap: 4% used
GH Actions deploy runs (this session): success for #122-#133
```

**Note**: PRs #131-#133 are test-only — they don't change production
runtime behaviour. The deploy pipeline still re-builds + ships every
merge, so VPS git HEAD advances (currently `c7bab47`), but the
production bundles remain functionally equivalent to the post-#129
state. No user-visible difference between #129 and #133 deploys.

### pm2 (post-deploy)

| ID  | Process        | Status  | Uptime | Mem      |
| --- | -------------- | ------- | ------ | -------- |
| 0   | pm2-logrotate  | online  | ~3d    | 35.0 MB  |
| 1   | finance-bot-tg | online  | 5d     | 67.0 MB  |
| 2   | bot-wa         | stopped | —      | 0 B      |
| 4   | vipos-backend  | online  | 46s    | 132.6 MB |
| 5   | vipos-worker   | online  | 45s    | 55.0 MB  |

`bot-wa` remains stopped (pre-existing state from prior sessions; not in
scope for this run — see Tier-2 backlog).

### `/api/health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": { "ok": true, "latency_ms": 33 },
  "redis": { "ok": true, "latency_ms": 9 }
}
```

### Web bundle (`apps/web/dist/assets/`)

| Chunk                                | Bytes   | Notes                                           |
| ------------------------------------ | ------- | ----------------------------------------------- |
| `index-v4U4f4Zx.js` (eager)          | 401,710 | +14 bytes vs PR #119 baseline (login fast).     |
| `DashboardPage-CgDFt8pc.js`          | 31,675  | Was 416,800 before PR #124 (incl. #126 + #129). |
| `ReportFilterBar-BjUvSO2e.js`        | 10,625  | Was 716,700 before PR #122 (incl. #128).        |
| `RevenueChart-BivSj-A0.js`           | 25,178  | Lazy.                                           |
| `TopProductChart-Cf2laVYN.js`        | 30,047  | Lazy.                                           |
| `CartesianChart-BWQVwfSP.js`         | 334,943 | Lazy; recharts shared, fetched on first chart.  |
| `xlsx-Cwq4KIDV.js`                   | 429,926 | Lazy; first Export Excel click.                 |
| `jspdf.es.min-De2JR0Kj.js`           | 390,978 | Lazy; first Export PDF click.                   |
| `jspdf.plugin.autotable-DcrDlGgF.js` | 31,489  | Lazy; first Export PDF click.                   |

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
used for all eight PRs. **Confirmed working** with the freshly rotated
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
(`should_save=true`, `save_scope=org`). All eight PRs were pushed +
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
- **`<ChartFallback>` visual matching** — ✅ shipped in PR #129
  (bar-skeleton with `animate-pulse` + Y-axis line). Carried over only
  for changelog context.
- **xlsx / jspdf preload on Reports navigation** — when
  `ReportFilterBar` mounts, optionally fire-and-forget
  `import('xlsx')` + `import('jspdf')` + `import('jspdf-autotable')`
  so the first Export click feels instant. Trade-off: extra background
  bandwidth (~850 kB) for users who never export. Defer until we have
  telemetry on how often `/reports/*` users actually export. Risk:
  yellow. Estimate: 1 hour + measurement.
- **`CartesianChart` (recharts) chunk size** — still 334 kB pre-gzip,
  101 kB gzip. recharts itself has no easy split; if telemetry shows
  users care, consider migrating to a lighter chart lib (e.g. uPlot,
  visx, or vanilla SVG components). Risk: yellow / red depending on
  visual parity. Estimate: 4–8 hours (chart-by-chart rewrite).
- **`ExportButtons` test coverage** — ✅ shipped in PR #131
  (`ExportButtons.test.jsx`, 6 cases covering disabled / dropdown /
  sync-csv / async-xlsx busy / pdf rejection toast). Carried over only
  for changelog context.
- **`exportTable.js` test coverage** — ✅ shipped in PR #133
  (`exportTable.test.js`, 15 cases covering CSV escaping, BOM,
  filename suffixes, JSON pretty-print, `formatValue` dispatch).
  Carried over only for changelog context.
- **jsdom test setup polyfills** — ✅ shipped in PR #132 (matchMedia,
  ResizeObserver, IntersectionObserver in shared
  `apps/web/src/__tests__/setup.js`). Future tests can mount
  `react-hot-toast Toaster` / recharts `ResponsiveContainer` without
  per-file polyfills.
- **Other `/reports/*` page chunks** — audit other Reports child pages
  to ensure none of them re-import jspdf/xlsx statically (they don't
  today; #122 confirmed via build, but worth a regression check after
  any refactor). Risk: green. Estimate: 30 min.
- **`DashboardPage` test coverage** — opportunistic. With #132's
  shared jsdom polyfills, a smoke test that renders `DashboardPage`
  inside a `MemoryRouter` + `QueryClientProvider` and asserts the
  three chart cards mount their `ChartFallback` `role="status"`
  before the lazy chunk resolves becomes feasible. Risk: green.
  Estimate: 1 hour.

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
apps/web/src/__tests__/OnboardingPage.test.jsx     |  4 ++--    PR #123
apps/web/src/__tests__/ProductTabs.test.jsx        |  2 +-      PR #123
apps/web/src/__tests__/Sidebar.test.jsx            |  2 +-      PR #123
apps/web/src/__tests__/ExportButtons.test.jsx      | 161 +++    PR #131 (new file)
apps/web/src/__tests__/exportTable.test.js         | 214 +++    PR #133 (new file)
apps/web/src/__tests__/setup.js                    |  48 +++    PR #132
apps/web/src/components/reports/ExportButtons.jsx  |  42 +++    PRs #122, #128
apps/web/src/pages/DashboardPage.jsx               |  57 +++    PRs #124, #126, #129
apps/web/src/utils/exportTable.js                  |  23 ++-    PR #122
docs/handoff/2026-05-06-tier1-perf-followups.md    | (this file + 3 amends)   handoff PRs #125, #127, #130, #134
```

Total: 9 source files, ~550 insertions / 25 deletions across PRs
#122–#133. Plus 4 handoff doc PRs (#125 initial, #127 post-#126 amend,
#130 final amend with #128 + #129 + post-deploy prod state, #134 amend
with #131-#133 test coverage).

## Smoke test infrastructure

No new Playwright / smoke scripts introduced this session. Vitest + RTL

- jsdom infrastructure under `apps/web/src/__tests__/` was extended:

* PR #131 added `ExportButtons.test.jsx` (6 cases, integration-style
  mocks via `vi.hoisted`).
* PR #132 added permissive jsdom polyfills for `matchMedia`,
  `ResizeObserver`, and `IntersectionObserver` to the shared
  `setup.js` so future tests don't need per-file workarounds.
* PR #133 added `exportTable.test.js` (15 cases) using a
  `setupBlobCapture()` helper that monkey-patches `window.Blob` +
  `URL.createObjectURL` + `HTMLAnchorElement.prototype.click` to
  capture downloads without disk I/O.

Existing `vi.mock('../components/charts/RevenueChart', ...)` pattern in
`DashboardPage.test.jsx` continues to work with `React.lazy` after PR
#124.

Test suite now: **16 files / 103 tests passing** (was 14 / 82 at
session start; +2 files, +21 tests).

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
