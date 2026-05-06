# VIPOS Sesi Handoff — 2026-05-06 (Tier-1 perf follow-ups)

Closed: 2026-05-06 ~14:50 UTC (re-closed by PRs #150 + #151 amend;
previously ~14:30 UTC after PR #148 + xlsx audit amend, ~14:10 UTC
after bot-wa-delete amend, ~13:35 UTC after PR #143–#145 amend,
~13:00 UTC after PR #141 amend, and ~10:50 UTC at the original close). Prepared by Devin in continuous-
automation mode. Devin sessions:

- Original close: <https://app.devin.ai/sessions/52c2da66635d43a9a7c774b05036ae66>
- 2026-05-06 #141 + #143–#145 + bot-wa-delete + #148 + #150/#151 amend: <https://app.devin.ai/sessions/5a13e29449674f47bb2d035b5636542b>

Successor to `2026-05-06-phase1-ac-completion-and-bundle-split.md` (which
captured PRs #112–#119 / per-AC ticks + initial route-level
`React.lazy`). This doc starts at PR #122 and ends at PR #145, covering
eight Tier-1 perf items + seven test-coverage items + one read-only
audit, all executed autonomously across the original 2026-05-06 session
plus the #141 + #143–#145 amend session. PRs #139 and #140 (lazy-load
`CustomerImportDialog`, `ProductMovementHistoryDialog`, and
`CampaignBuilder`) were merged from a separate Devin session between
#138's amend and the #141 amend; their **regression tests are added
this amend session** as PRs #143–#145 (see breakdowns below).

## TL;DR

Eleven green/yellow PRs (and seven handoff doc amends, including this
#143–#145 amend) merged in one continuous run while resolving an
expired-PAT incident, plus three lazy-dialog regression tests for the
react.lazy() boundaries PRs #139 + #140 added (`CustomerImportDialog`,
`ProductMovementHistoryDialog`, `CampaignBuilder`). **`apps/web` lazy chunks ≥ 400 kB previously**
(`ReportFilterBar` 717 kB and `DashboardPage` 417 kB) **both shrunk
to ~10–31 kB by lifting their heavy deps into per-feature dynamic
imports** (`xlsx`, `jspdf`, `jspdf-autotable`, `recharts`), with chart
prefetch + bar-skeleton + Export busy spinner + Export dropdown-open
prefetch polishing the resulting UX. Test coverage on the touched
surface area went from 14 files / 82 tests to **23 files / 166 tests**
(+1 file ExportButtons regression with prefetch tests, +1 file
exportTable.js regression, +1 file DashboardChartFallback Suspense
regression, +3 files for the lazy-dialog contracts of
`CustomerImportDialog`, `ProductMovementHistoryDialog`,
`CampaignBuilder`, +1 file for the `<ProtectedRoute>` auth-guard
contract, +1 file for `signup-helpers` (slugify/SLUG_REGEX/scorePassword,
27 cases), +1 file for `sentry-scrub` PII redaction (scrubObject /
scrubBreadcrumb / scrubEvent, 26 cases), plus jsdom
matchMedia/ResizeObserver stubs in shared setup).
The eager bundle dropped to **387 kB / gzip 127 kB** (was 401 kB / gzip
130 kB at session start; PR #137 lazy-loaded three uncommon auth
pages). Login fast-path unaffected.

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

Prod state at close (post-PR #145 deploy):

- Backend HEAD `7f05b84` (PR #151 squash-merge SHA on `main`; PRs #146,
  #147, #149, and this PR are doc-only and don't change the bundle;
  PRs #150 and #151 are pure-helper test additions and don't touch any
  bundled source).
- `pm2 list` → `vipos-backend` (online, 100.3 MB, ~4 min uptime),
  `vipos-worker` (online, 55.4 MB, ~4 min uptime), `finance-bot-tg`
  (online, 5d uptime, 67.6 MB), `pm2-logrotate` (online, 34.3 MB).
  `bot-wa` was deleted this session at founder's instruction
  (`pm2 delete bot-wa && pm2 save`); it belonged to the separate
  `alviarts/finance-bot` repo, not VIPOS — see investigation report in
  the operational notes.
- `/api/health` → `{"status":"ok","version":"1.0.0","db":{"ok":true,"latency_ms":22},"redis":{"enabled":true,"ok":true,"latency_ms":5}}`.
- Web bundle: `apps/web/dist/assets/index-D9b7i2zC.js` = **387,757 bytes
  pre-gzip** (eager). Byte-identical to the post-#141 build (PRs #143,
  #144, #145 are all test-only — no production code touched).
- VPS: disk 35 GB / 49 GB (71%), RAM 672 MiB used / 3.8 GiB total
  (~17%), swap left near previous run.
- `tools/scripts/deploy.sh` untouched in every PR (incl. #143/#144/#145)
  — no `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Subject                                                                                          | Risk   | Status                             |
| ---- | ------------------------------------------------------------------------------------------------ | ------ | ---------------------------------- |
| #122 | `perf(web): dynamic-import xlsx + jspdf in exportTable; ReportFilterBar 717kB→10kB`              | yellow | merged (`c5f4d71`); deploy success |
| #123 | `test(web): replace .toBeNull() with .not.toBeInTheDocument() on DOM queries`                    | green  | merged (`cd90a15`); deploy success |
| #124 | `perf(web): lazy-load recharts via React.lazy on dashboard charts; DashboardPage 417kB→31kB`     | yellow | merged (`230ae23`); deploy success |
| #125 | `docs(handoff): close 2026-05-06 Tier-1 perf follow-ups session` (this doc, initial draft)       | green  | merged (`8e76507`); deploy success |
| #126 | `perf(web): prefetch dashboard chart chunks in useEffect to mask Suspense fallback`              | green  | merged (`00982c2`); deploy success |
| #127 | `docs(handoff): amend 2026-05-06 Tier-1 perf doc with PR #126 (chart prefetch)`                  | green  | merged (`1e16b39`); deploy success |
| #128 | `feat(reports): show inline spinner + 'Memuat…' on Export button while xlsx/pdf chunk loads`     | green  | merged (`998aad2`); deploy success |
| #129 | `feat(dashboard): use bar-skeleton for ChartFallback instead of flat placeholder`                | green  | merged (`c74f36e`); deploy success |
| #130 | `docs(handoff): final amend with PRs #128, #129 + post-deploy prod state`                        | green  | merged (`55bd5c8`); deploy success |
| #131 | `test(web): add ExportButtons regression tests for disabled, dropdown, sync, busy, error paths`  | green  | merged (`7d07608`); deploy success |
| #132 | `test(web): stub matchMedia, ResizeObserver, IntersectionObserver in test setup`                 | green  | merged (`d6c7752`); deploy success |
| #133 | `test(web): add exportTable.js regression tests for csv/json/formatValue`                        | green  | merged (`c7bab47`); deploy success |
| #134 | `docs(handoff): amend with PRs #131-#133 (test coverage)`                                        | green  | merged (`677ba64`); deploy success |
| #135 | `perf(reports): prefetch xlsx + jspdf chunks when ExportButtons dropdown opens`                  | green  | merged (`e744878`); deploy success |
| #136 | `docs(handoff): amend with PR #135 (export prefetch) + Reports audit`                            | green  | merged (`88badfc`); deploy success |
| #137 | `perf(web): lazy-load SignupPage + ForgotPasswordPage + ResetPasswordPage`                       | green  | merged (`82ff723`); deploy success |
| #138 | `docs(handoff): amend with PR #137 (lazy auth pages)`                                            | green  | merged (`ec29d80`); deploy success |
| #141 | `test(web): add DashboardChartFallback Suspense regression for /dashboard charts`                | green  | merged (`5cb739b`); deploy success |
| #142 | `docs(handoff): amend with PR #141 (DashboardChartFallback regression test)`                     | green  | merged (`ff33a79`); deploy success |
| #143 | `test(web): add CustomerImportDialog lazy-load contract test`                                    | green  | merged (`37ccc60`); deploy success |
| #144 | `test(web): add ProductMovementHistoryDialog lazy-load contract test`                            | green  | merged (`3f3751d`); deploy success |
| #145 | `test(web): add CampaignBuilder lazy-load contract test`                                         | green  | merged (`9bde4ff`); deploy success |
| #146 | `docs(handoff): amend with PRs #143/#144/#145 (lazy-dialog regression tests)`                    | green  | merged (`aa88abe`); deploy success |
| #147 | `docs(handoff): record bot-wa pm2 delete + drop from VIPOS backlog (not VIPOS scope)`            | green  | merged (`37203f1`); deploy success |
| #148 | `test(web): add ProtectedRoute auth-guard regression test`                                       | green  | merged (`73e1e4d`); deploy success |
| #149 | `docs(handoff): amend with PR #148 + xlsx (SheetJS) audit finding`                               | green  | merged (`56c8d51`); deploy success |
| #150 | `test(web): add signup-helpers regression tests (slugify, SLUG_REGEX, scorePassword)`            | green  | merged (`85aa254`); deploy success |
| #151 | `test(web): add sentry-scrub PII regression tests (scrubObject, scrubBreadcrumb, scrubEvent)`    | green  | merged (`7f05b84`); deploy success |
| #152 | `docs(handoff): amend with PRs #150 + #151 (signup-helpers + sentry-scrub regression)` (this PR) | green  | pending merge                      |

(All twenty-three merged via REST API squash with `GITHUB_PAT_VIPOS` —
see **Critical infrastructure context** below for the PAT rotation
incident that gated PR #122. PRs #139, #140 were merged from a separate
session and are intentionally not described in detail in this doc; see
those PRs for context, but the lazy-load boundaries they introduced are
regression-tested by PRs #143/#144/#145 added in this amend session. PR
#147 also captures the operational `pm2 delete bot-wa` step — see Tier-1
backlog and Operational notes §8–9.)

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

### PR #135 — prefetch xlsx + jspdf on ExportButtons dropdown open

After PR #122 + #128, the export flow looked like: user clicks the
trigger → dropdown opens → user picks 'Export Excel' → component flips
`busy=true` and starts `import('xlsx')` → spinner + `Memuat…` shown
during the 430 kB download → resolved → `XLSX.writeFile` runs. The
chunk download itself is the dominant latency (\~hundreds of ms on
slow networks).

Mitigation strategy: kick off `import('xlsx')` + `import('jspdf')` +
`import('jspdf-autotable')` the moment the user opens the dropdown.
That's a much stronger signal of intent-to-export than mount-time
prefetch (which would waste bandwidth on users who never export). By
the time the user picks a format and clicks, the chunks are in the
module cache and the export starts instantly.

Implementation:

- `useEffect` watches the `open` state. On first transition to `true`,
  fire-and-forget `import()` for the chunks corresponding to the
  formats actually present in the `formats` prop.
- `useRef(false)` gates the prefetch so it only fires once per
  component instance, even on re-open.
- `formats={['csv', 'json']}` → no heavy chunk prefetch (correct).
  `formats={['csv', 'xlsx']}` → only `xlsx` prefetches.
- Errors are swallowed (`.catch(() => {})`) — prefetch is pure
  optimization. If the chunk fails to load, the eventual real export
  click will retry the `import()` and surface the error via
  `toast.error` (existing PR #122 behaviour).

Bundle delta:

- `ReportFilterBar-*.js`: 9.99 kB → 10.59 kB (+0.60 kB pre-gzip for
  the prefetch effect). On VPS: `ReportFilterBar-D424vjzO.js` =
  10,983 bytes.
- `xlsx-*.js`, `jspdf*.js`, `jspdf.plugin.autotable-*.js` chunks
  unchanged in size or laziness.

Test coverage: 2 new cases added to `ExportButtons.test.jsx` — one
exercising the open/close/re-open cycle (idempotent `useRef` guard),
one verifying that CSV/JSON-only `formats` prop doesn't prefetch (the
heavy formats aren't even in the menu). Mocks `xlsx`, `jspdf`,
`jspdf-autotable` via `vi.mock` so jsdom doesn't try to load real
libraries. Suite total: 16 files / 105 tests passing (+2 vs #133).

Risk: green (conservative trigger gated on user-intent click,
idempotent, errors swallowed, full test coverage). Bundle eager
at 401 kB / gzip 130 kB pre-#137; subsequent PR #137 dropped it to
387 kB / gzip 127 kB.

### Reports child-page jspdf/xlsx audit (no PR — verification only)

Verified (via `grep -n '(xlsx|jspdf|jspdf-autotable|XLSX|jsPDF)'` over
`apps/web/src/**/*.{js,jsx}`) that no Reports child page or component
re-imports xlsx/jspdf statically. The only runtime references are:

- `apps/web/src/utils/exportTable.js` — dynamic `import('xlsx')` /
  `import('jspdf')` (PR #122).
- `apps/web/src/components/reports/ExportButtons.jsx` — dynamic
  prefetch (PR #135).
- `apps/web/src/__tests__/ExportButtons.test.jsx` — `vi.mock` stubs
  for the prefetch tests.
- `apps/web/src/pages/reports/ScheduledReportsPage.jsx:21` — string
  literal `'xlsx'` in a select option label (not an import).

No regressions: every Reports surface keeps the heavy chunks lazy.
Audit task (Tier-1, 30 min estimate) closed.

### PR #137 — lazy-load uncommon auth pages

The eager bundle (`index-*.js`) carried four auth pages: `LoginPage`,
`SignupPage`, `ForgotPasswordPage`, `ResetPasswordPage`. Only
`LoginPage` is the canonical entry point — every unauthenticated user
lands there. The other three are long-tail flows:

- `/signup` — rare for an existing tenant app.
- `/forgot-password` — long-tail recovery flow.
- `/reset-password` — used at most once per email link.

This PR moves those three behind `React.lazy()`, leaving only
`LoginPage` eager. Routes are already wrapped in
`<Suspense fallback={<Spinner />}>` at `App.jsx:115`, so no new
Suspense boundary needed.

Bundle delta:

- **`index-*.js` (eager)**: 401.21 kB / gzip 130.04 kB →
  **387.25 kB / gzip 127.20 kB** (−13.96 kB / −2.84 kB gzip, −3.5%
  raw). On VPS: `index-CBkho8Zq.js` = 387,749 bytes.
- New lazy chunks:
  - `SignupPage-*.js` 9.47 kB / gzip 3.18 kB.
  - `ForgotPasswordPage-*.js` 2.37 kB / gzip 1.08 kB.
  - `ResetPasswordPage-*.js` 2.51 kB / gzip 1.13 kB.

Login fast-path unaffected — `LoginPage` stays eager and the spinner
is the same one used for every other lazy boundary.

Risk: green (route-level code split, three uncommon paths, fallback
Suspense already wired).

### PR #141 — DashboardChartFallback Suspense regression test

Pins the cold-cache behaviour PR #124 (lazy `recharts`) + PR #129
(`ChartFallback` bar-skeleton) ship: while the lazy chart chunks are
still in-flight, both chart cards in `DashboardPage` render their
`ChartFallback` with the correct `aria-label` and `role="status"`
semantics for assistive tech.

Implementation in `apps/web/src/__tests__/DashboardChartFallback.test.jsx`
(1 test, 111 LOC):

- Mocks `RevenueChart` and `TopProductChart` with never-resolving module
  promises (`new Promise(() => {})`), so the page is held in its
  suspended state for the lifetime of the test.
- Mocks `../utils/api` with an `apiGetMock` that resolves the four
  `/dashboard/*` endpoints (`summary`, `sales-trend`, `top-products`,
  `payment-methods`) with deterministic stub data, and mocks
  `../context/OutletContext`'s `useOutlet` so the page exits its
  loading skeleton without needing a `QueryClientProvider`.
- Renders `DashboardPage` inside a `MemoryRouter`, waits for the
  `Dashboard Penjualan` heading + `Tren Pendapatan` / `Top 10 Produk`
  / `Metode Pembayaran` card titles (page body, not skeleton), then
  asserts:
  - `getByLabelText('Memuat tren pendapatan')` and
    `getByLabelText('Memuat top produk')` both present.
  - Exactly two `role="status"` elements (the third 'Metode Pembayaran'
    card is a list, not a chart).
  - Each `role="status"` element contains the visually-hidden
    `Memuat grafik…` SR copy.

The matching post-resolution path (charts mount, fallbacks tear down)
is already covered by the existing `DashboardPage.test.jsx`, which
mocks the chart modules synchronously — so this new file complements
it without duplicating coverage.

Test suite delta: 16 files / 105 tests → **17 files / 106 tests**.

Bundle / behaviour: zero source changes to `DashboardPage.jsx`,
`RevenueChart.jsx`, `TopProductChart.jsx`, or any other production
code. `apps/web` build output is byte-identical to pre-#141 main.

Risk: green (test-only addition).

### PRs #143 / #144 / #145 — lazy-dialog regression tests for PRs #139 + #140

PRs #139 + #140 (separate Devin session, between #138 and #141) wrapped
three dialogs in `React.lazy()`:

- `CustomerImportDialog` (298 LOC) on `CustomersPage` — admin-only
  bulk-import dialog, mounted under `{showImport && <Suspense
fallback={null}>}` on the `Impor` button.
- `ProductMovementHistoryDialog` (127 LOC) on `InventoryPage` —
  per-product history view, mounted under `{historyProduct && <Suspense
fallback={null}>}` on the History icon button per movement row.
- `CampaignBuilder` (~30 kB pre-gzip, 5-step wizard) on `MarketingPage`
  — admin-only, gated by `tab === 'campaigns'`, mounted under
  `{showBuilder && <Suspense fallback={null}>}` on the `Buat Campaign`
  header button.

All three use `<Suspense fallback={null}>` (no skeleton UI), so the
test pattern from PR #141 (assert visible `<ChartFallback>` while the
lazy chunk is in-flight) doesn't fit — there's no fallback DOM to
inspect. Instead, PRs #143/#144/#145 each assert the _post-resolve_
mount path end-to-end:

1. Page mounts; the dialog is **not** in the DOM (lazy chunk not yet
   requested because the visibility flag is still `false`/`null`).
2. Click the page's trigger button (Impor / History / Buat Campaign).
3. The dynamic `import(...)` resolves through the test's **real
   (unmocked) module graph** — the dialog component is _not_ mocked.
4. Assert the dialog header + at least one piece of internal real-
   module content (`Pilih file CSV...`, `Riwayat Stok` subtitle,
   wizard channel cards) is visible.
5. Click the close (X) button; assert the dialog disappears.

Each test mocks `../utils/api` (no network), `../context/AuthContext`
(admin role gates the buttons), and `react-hot-toast` (trims noise).
The `ProductMovementHistoryDialog` test also stubs the dialog's own
`/inventory/movements/<id>` fetch to return `[]`, so the empty-state
copy `Belum ada pergerakan stok untuk produk ini.` shows up — that
also confirms the dialog's `useEffect(() => api.get(...))` ran end-to-
end, not just the static shell.

Test suite delta:

- PR #143: 17 files / 106 tests → **18 files / 107 tests** (+1).
- PR #144: 18 files / 107 tests → **19 files / 108 tests** (+1).
- PR #145: 19 files / 108 tests → **20 files / 109 tests** (+1).

Bundle / behaviour: zero source changes to `CustomersPage`,
`InventoryPage`, `MarketingPage`, or any of the dialog components.
`apps/web` build output is byte-identical to post-#141 main.

Risk: green (all three are test-only additions).

### PR #148 — `<ProtectedRoute>` auth-guard regression test

`<ProtectedRoute>` is the single component every authenticated route
in `App.jsx` is wrapped in (`/onboarding`, `/`, and all 50+ child
routes hanging off the `<AppShell>` `<Outlet>`). Its job is small but
security-critical:

| `useAuth()` state            | Render                                  |
| ---------------------------- | --------------------------------------- |
| `loading=true`               | `<Spinner />` (h-12 w-12, animate-spin) |
| `loading=false, user=null`   | `<Navigate to="/login" />`              |
| `loading=false, user=truthy` | children                                |

A regression here would either (a) leak protected pages to
unauthenticated users, or (b) bounce authenticated users to `/login`
on every refresh. Both are P0-class bugs.

Implementation in `apps/web/src/__tests__/ProtectedRoute.test.jsx`
(4 tests, 139 LOC):

1. **Spinner during loading** — asserts `.animate-spin` is in the DOM
   and neither the guarded children nor the `/login` sentinel renders.
2. **Redirect to `/login` when auth resolved with no user** — asserts
   the `/login` route's element is rendered and the guarded children
   are not.
3. **Children render when auth resolved with a user** — mirror of (2).
4. **Loading→authenticated transition does not flash `/login`** —
   realistic refresh-while-logged-in flow. Initial render has
   `loading=true` (spinner), then re-render with
   `loading=false, user=present` must NOT briefly show the `/login`
   redirect.

Test surface:

- `vi.mock('../context/AuthContext', ...)` and
  `vi.mock('./context/AuthContext', ...)` both wired to the same
  `useAuthMock` so each test can `mockReturnValue(...)` independently.
  Both relative path forms are mocked because `App.jsx` and the test
  file resolve the import differently from their respective
  directories.
- `MemoryRouter` + `/login` sentinel route lets the test observe
  `<Navigate>`'s redirect outcome via the rendered element rather than
  navigation history.

Source change: a single-character edit in `apps/web/src/App.jsx`
(`function ProtectedRoute(...)` → `export function ProtectedRoute(...)`)
to make the component testable in isolation. No behavior change; eager
bundle byte-identical (`index-DmntnoNG.js` 387.26 kB pre-gzip).

Test suite delta: 20 files / 109 tests → **21 files / 113 tests** (+1
file, +4 tests).

Risk: green (one-line `export` keyword addition + new test file).

### PR #150 — `signup-helpers` regression tests

`apps/web/src/utils/signup-helpers.js` exposes three pure helpers that
gate the signup flow:

| Helper              | Where it runs                                                                       | Regression cost                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `slugify(input)`    | Live preview while user types business name; output flows into `POST /auth/signup`. | User sees a slug different from what they preview, or a slug the API rejects (e.g. accents not stripped).        |
| `SLUG_REGEX`        | Real-time form validation gate before submit.                                       | Either accepts invalid slugs (API rejects with confusing error) or rejects valid ones (user can't proceed).      |
| `scorePassword(pw)` | 0–4 strength meter + label next to the password input.                              | Label drift (e.g. "Sangat kuat" for a weak password) or submit-disabled bug if the strength gate uses the score. |

Implementation in `apps/web/src/__tests__/signup-helpers.test.js`
(27 cases, 174 LOC):

- `slugify` (8): non-string inputs → `''`, ASCII case+dash, NFKD
  accent strip, non-alnum collapse, leading/trailing dash strip,
  40-char cap, all-non-alnum input, empty string.
- `SLUG_REGEX` (7): valid 3–40 char alnum + interior dashes, 1-char
  minimum, leading/trailing dash rejection, uppercase rejection,
  non-dash special char rejection, length>40 rejection, empty.
- `scorePassword` (12): empty/non-string → `score=0`, length
  boundaries (5/6/10), composition rules (length, mixed case, digit,
  symbol), label transitions (Lemah/Cukup/Kuat/Sangat kuat), score
  cap at 4.

Test suite delta: 21 / 113 → 22 / 140 (+1 file, +27 tests).

Risk: green (zero source changes, pure-helper test only).

### PR #151 — `sentry-scrub` PII regression tests

`apps/web/src/lib/sentry.js` ships three PII scrubbers that run before
Sentry events leave the browser. The author explicitly designed them
for unit testing (per the comment in `sentry.js` and the `_internal`
export), but no test file existed. A regression in any of these is a
**P0 privacy bug** — tokens, passwords, TOTP codes, session cookies,
emails, or IP addresses could end up in Sentry.

| Helper               | Sentry hook         | Coverage                                                                                                                                                                          |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrubObject(value)` | All recursive scrub | SENSITIVE_KEYS list, nested objects + arrays, mutation safety                                                                                                                     |
| `scrubBreadcrumb(b)` | `beforeBreadcrumb`  | `data` scrub + Bearer/password/token regex on `message` strings                                                                                                                   |
| `scrubEvent(e)`      | `beforeSend`        | `request.cookies` redact, `request.headers/data` scrub, query_string token/password/totp regex, user PII strip (username/email/ip_address), breadcrumbs map, extra+contexts scrub |

Implementation in `apps/web/src/__tests__/sentry-scrub.test.js`
(26 cases, 366 LOC):

- `SENSITIVE_KEYS` (1): pins the redacted-key list.
- `scrubObject` (8): primitives passthrough, top-level redact,
  case-insensitive matching, nested object recursion, array recursion,
  mixed object/array recursion, no input mutation, non-sensitive key
  preservation.
- `scrubBreadcrumb` (6): null/undefined passthrough, data scrub, Bearer
  token regex, inline `password=` / `token=` regex, non-string message
  guard, no input mutation.
- `scrubEvent` (11): null/undefined passthrough, `request.cookies`
  wholesale redact, headers/data scrub, query_string
  token/password/totp regex, case-insensitive query_string keys,
  non-string `query_string` passthrough, user PII removal
  (username/email/ip_address) with `id` + `role` kept, breadcrumbs
  array map, `extra`+`contexts` scrub, end-to-end realistic Sentry
  event combining all the above.

Test suite delta: 22 / 140 → 23 / 166 (+1 file, +26 tests).

Risk: green (zero source changes; the helpers were already exported
via `_internal` for testability).

## Production state at close

### VPS

```
Host: 103.74.5.44 (xserver.local)
Repo: /var/www/vipos @ git HEAD 9bde4ff (PR #145)
Disk: 35 GB / 49 GB used (71%)
RAM: 672 MiB / 3.8 GiB used (~17%)
Swap: ~near previous run
GH Actions deploy runs (this session): success for #122-#137 + #141 +
  #143-#145 (#139 + #140 also succeeded but were merged from a separate
  session).
```

**Note**: PR #137 shrunk the eager bundle from 401.21 kB to 387.25 kB
by lazy-loading three uncommon auth pages. VPS git HEAD now `9bde4ff`
(PR #145 squash-merge SHA). PR #141 + PRs #143/#144/#145 are all
test-only — production bundles match the post-#137 build output
byte-for-byte (387,757 bytes eager, +8 bytes vs the original PR #137
baseline due to PRs #139 + #140 lazy dialogs).

### pm2 (post-deploy, PR #145 + bot-wa delete)

| ID  | Process        | Status | Uptime | Mem      |
| --- | -------------- | ------ | ------ | -------- |
| 0   | pm2-logrotate  | online | ~3d    | 34.3 MB  |
| 1   | finance-bot-tg | online | 5d     | 67.6 MB  |
| 4   | vipos-backend  | online | ~4 min | 100.3 MB |
| 5   | vipos-worker   | online | ~4 min | 55.4 MB  |

`bot-wa` (id 2) was deleted from pm2 this session at founder's instruction;
it was a stopped process from the separate `alviarts/finance-bot` repo
(WhatsApp twin of the still-online `finance-bot-tg`). VIPOS has zero
dependency on it. See Operational notes §9 below for the rationale.

### `/api/health`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": { "ok": true, "latency_ms": 22 },
  "redis": { "enabled": true, "ok": true, "latency_ms": 5 }
}
```

### Web bundle (`apps/web/dist/assets/`)

| Chunk                       | Bytes   | Notes                                                                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index-D9b7i2zC.js` (eager) | 387,757 | Byte-identical to post-#141 build (PRs #143/#144/#145 are test-only). +8 bytes vs original PR #137 baseline (#139 + #140). |

(Lazy-chunk fingerprints rotate per build with the dialog/page splits;
the Tier-1 size reductions captured in the per-PR sections above are
unaffected.)

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

- **`bot-wa` pm2 entry** — ✅ deleted this session
  (`pm2 delete bot-wa && pm2 save`). Was never VIPOS scope: belonged to
  the separate `alviarts/finance-bot` repo (WhatsApp twin of
  `finance-bot-tg`, sharing logic via `processMessage()` in
  `src/commands.js`). Last known state: stopped after Baileys session
  was invalidated by WhatsApp (403 disconnect loop in 2026-05-03 logs).
  Telegram bot (`finance-bot-tg`) remains online and provides feature
  parity for the Google Sheets finance-tracking use case. Future
  sessions should not see `bot-wa` in `pm2 list` and should not list it
  in VIPOS handoff backlog.
- **`<ChartFallback>` visual matching** — ✅ shipped in PR #129
  (bar-skeleton with `animate-pulse` + Y-axis line). Carried over only
  for changelog context.
- **xlsx / jspdf preload on Reports navigation** — ✅ shipped in PR
  #135 with a stronger trigger: prefetch on dropdown-open instead of
  page-mount. Avoids the bandwidth-waste trade-off entirely (only
  users who _intentionally_ open the export menu pay the cost).
  Carried over only for changelog context.
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
- **Other `/reports/*` page chunks** — ✅ verified clean this session
  (no PR — read-only audit; see "Reports child-page jspdf/xlsx audit"
  section above). Re-run the same `grep` after any future Reports
  refactor.
- **`DashboardPage` test coverage** — ✅ shipped in PR #141
  (`DashboardChartFallback.test.jsx`, 1 case). Mounts `DashboardPage`
  inside a `MemoryRouter` and asserts both chart cards render their
  `ChartFallback` `role="status"` while the lazy chart chunks are in-
  flight (chart modules mocked with never-resolving promises). The
  matching post-resolution path is already covered by
  `DashboardPage.test.jsx`. Note: handoff originally said "three chart
  cards" but only two are lazy charts (`RevenueChart` +
  `TopProductChart`); the `Metode Pembayaran` card is a list, not a
  chart, so no Suspense fallback there. Carried over only for
  changelog context.
- **Lazy-dialog regression tests for PRs #139 + #140** — ✅ shipped
  in PRs #143/#144/#145 (`CustomerImportDialogLazy.test.jsx`,
  `ProductMovementHistoryDialogLazy.test.jsx`,
  `CampaignBuilderLazy.test.jsx`, 1 case each). Each test triggers the
  page's lazy boundary by clicking the trigger button (Impor / History
  / Buat Campaign), waits for the real (unmocked) dialog module to
  resolve, asserts the dialog content is in the DOM, then clicks the
  close button and asserts the dialog disappears. All three dialogs
  use `<Suspense fallback={null}>` so there's no skeleton UI to
  inspect; the assertion is on post-resolve mount instead.
- **Yellow-path `CartesianChart` deep-imports investigation** —
  attempted in this amend session, **0 byte savings**. Swapped
  `from 'recharts'` barrel imports for per-symbol entry points
  (`recharts/es6/cartesian/Area`, `recharts/es6/chart/AreaChart`, etc.)
  on `RevenueChart.jsx` + `TopProductChart.jsx`; rebuilt; the shared
  chunk landed at 334.54 kB (vs 334.55 kB before). Root cause: recharts
  already declares `sideEffects: false` so Rollup tree-shakes the
  barrel optimally; chunk size is dominated by internal cross-
  references inside the recharts components themselves. Branch deleted,
  no PR opened. Conclusion: meaningful CartesianChart reduction
  requires a chart-lib migration (yellow/red — see Tier-1 entry above)
  or accepting the current size.

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

## Files modified this session

```
apps/web/src/__tests__/OnboardingPage.test.jsx     |  4 ++--    PR #123
apps/web/src/__tests__/ProductTabs.test.jsx        |  2 +-      PR #123
apps/web/src/__tests__/Sidebar.test.jsx            |  2 +-      PR #123
apps/web/src/__tests__/ExportButtons.test.jsx      | 218 +++    PR #131 (new), #135 (+57)
apps/web/src/__tests__/exportTable.test.js         | 214 +++    PR #133 (new)
apps/web/src/__tests__/setup.js                    |  48 +++    PR #132
apps/web/src/components/reports/ExportButtons.jsx  |  73 +++    PRs #122, #128, #135
apps/web/src/pages/DashboardPage.jsx               |  57 +++    PRs #124, #126, #129
apps/web/src/utils/exportTable.js                  |  23 ++-    PR #122
apps/web/src/App.jsx                               |  22 ++-    PR #137
apps/web/src/__tests__/DashboardChartFallback.test.jsx | 111 +++ PR #141 (new)
apps/web/src/__tests__/CustomerImportDialogLazy.test.jsx | 123 +++ PR #143 (new)
apps/web/src/__tests__/ProductMovementHistoryDialogLazy.test.jsx | 160 +++ PR #144 (new)
apps/web/src/__tests__/CampaignBuilderLazy.test.jsx | 138 +++ PR #145 (new)
docs/handoff/2026-05-06-tier1-perf-followups.md    | (this file + 7 amends)   handoff PRs #125, #127, #130, #134, #136, #138, #142, #146
```

Total: 14 source/test files, ~1,191 insertions / 32 deletions across
PRs #122–#145. Plus 8 handoff doc PRs (#125 initial, #127 post-#126
amend, #130 final amend with #128 + #129 + post-deploy prod state,
#134 amend with #131-#133 test coverage, #136 amend with #135 export
prefetch + Reports audit, #138 amend with #137 lazy auth pages, #142
amend with #141 DashboardChartFallback regression test, #146 amend
with PRs #143/#144/#145 lazy-dialog regression tests).

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

Test suite now: **20 files / 109 tests passing** (was 14 / 82 at
session start; +6 files, +27 tests). PR #141's
`DashboardChartFallback.test.jsx` mocks the chart modules with
`new Promise(() => {})` to pin the page in its suspended state for the
lifetime of the test — a clean variation on the `vi.hoisted` resolve-
handle pattern from PR #131 when post-resolution assertions aren't
needed.

PRs #143/#144/#145 introduced the **complementary** pattern: they do
_not_ mock the lazy dialog component, so the test exercises the real
`React.lazy()` resolution path end-to-end. Each test renders the page,
asserts the dialog is initially absent (chunk not yet requested),
clicks the trigger button, awaits the dialog header via
`screen.findByRole('heading', ...)`, asserts at least one piece of
internal real-module content is present, and finally clicks the close
button to assert teardown. `userEvent.setup()` must be called _after_
`render(...)` to avoid `prepareDocument` crashes in user-event 14 with
the project's vitest 2.x + jsdom config; this is the documented
workaround for the existing repo setup. **When run from repo root,
`vitest` picks up the wrong config** — always cd into `apps/web/` (or
use `npm run test --workspace=apps/web`) so the workspace's
`vitest.config.js` is loaded.

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
8. **`bot-wa` was deleted this session.** Previously stopped pm2 entry
   pointing to `/root/finance-bot/src/bot-wa.js`, which belongs to the
   separate `alviarts/finance-bot` repo. Read-only investigation in this
   session confirmed: zero VIPOS code/data/deploy dependency, last activity
   was a 403 disconnect loop on 2026-05-03 (Baileys session invalidated by
   WhatsApp), Telegram twin `finance-bot-tg` covers the same use case.
   Founder approved Option A (delete). Performed via
   `pm2 delete bot-wa && pm2 save` on VPS; `pm2 dump` saved at
   `/root/.pm2/dump.pm2`. Future Devin sessions: bot-wa is **not** part of
   VIPOS scope; do not re-add it to backlogs.
9. **`npm audit` flags 1 high-severity `xlsx` (SheetJS) vuln — non-exploitable in VIPOS.** Two advisories in `node_modules/xlsx`:
   - GHSA-4r6h-8v6p-xvw6 (Prototype Pollution in SheetJS) — requires
     parsing a crafted `.xlsx` file via `XLSX.read(...)` /
     `XLSX.readFile(...)`.
   - GHSA-5pgg-2g8v-p4x9 (SheetJS ReDoS) — same; requires parsing
     untrusted strings through SheetJS reader APIs.

   Both have "No fix available" via `npm audit fix` because SheetJS
   removed their package from npm; the patched build is hosted at
   `https://cdn.sheetjs.com/`. **VIPOS is not vulnerable**: the only
   call sites use write-side APIs (`XLSX.utils.aoa_to_sheet`,
   `book_new`, `book_append_sheet`, `writeFile` in
   `apps/web/src/utils/exportTable.js`); there is **no** `XLSX.read`
   anywhere in `apps/web/src/`. CSV import in
   `CustomerImportDialog.jsx` uses a custom RFC4180 parser (no xlsx).

   Verification one-liner for future sessions:
   `grep -rn "XLSX\\.read\\|xlsx.*read" apps/web/src/` → expect 0 matches.

   Migration options if SheetJS is ever needed in a read context:
   (a) pin to the SheetJS CDN tarball via
   `package.json` `"xlsx": "https://cdn.sheetjs.com/xlsx-X.Y.Z/xlsx-X.Y.Z.tgz"`,
   (b) switch to ExcelJS (different API, broader feature set, npm-published).

   Do not silence the audit (e.g. via `audit-level=critical` in
   `.npmrc`) — the visible warning is a useful signal that future
   contributors should re-check this finding before adding any
   xlsx-read code path.

10. **Don't touch `alviarts/finance-bot` repo from VIPOS sessions.** That
    repo lives at `/root/finance-bot/` on the VPS but has nothing to do
    with this monorepo. If you need to make changes there, use a separate
    Devin session scoped to that repo.
