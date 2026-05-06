# VIPOS Sesi Handoff — 2026-05-06 (Sentry lazy + budget + toast lazy + bundle visualizer)

Closed: 2026-05-06 ~19:20 UTC (re-closed after follow-up PR #176).
Prepared by Devin in continuous-automation mode. Devin session:
<https://app.devin.ai/sessions/d88203c179a44adb964e0bf8798b0456>

Successor to `2026-05-06-disk-health-and-ci-timeout-fix.md` (which was
"final-closed" at ~17:05 UTC after founder said `pause`). This doc
covers the next continuous-automation session, which merged **four**
Tier-1 PRs end-to-end:

1. **PR #170** (yellow) — Sentry SDK lazy-load → eager bundle
   −25 kB gzip.
2. **PR #172** (green) — CI bundle-size budget enforcement at
   110 kB gzip cap on the eager entry chunk, locking in PR #170's
   win against silent regressions.
3. **PR #174** (yellow) — react-hot-toast lazy-load via thin
   wrapper module → eager bundle further −4.2 kB gzip; cap
   headroom grows from ~8 kB to ~14.5 kB.
4. **PR #176** (green) — rollup-plugin-visualizer treemap as a
   CI artifact (`web-bundle-stats`, 30-day retention) so reviewers
   can diagnose bundle-budget regressions from the run summary
   instead of grepping minified `dist/assets/index-*.js` locally.

Total time-to-handoff after secret bootstrap: ~95 minutes across
four PRs (PR #170 ~15 min, PR #172 ~10 min, founder cap-decision
round-trip ~5 min, PR #174 ~25 min including new lazy-wrapper
design + 9 regression tests, PR #176 ~25 min including
visualizer plugin + CI artifact upload, four handoff doc updates).

(This doc was re-opened three times: first after `~18:11 UTC` to
fold in PR #172, then `~18:30 UTC` for PR #174, then `~19:20 UTC`
for PR #176, rather than forking separate per-PR handoff docs for
tightly-coupled bundle-tooling follow-ups. The original prod
numbers are preserved as `PR #170 close state` / `PR #172 close
state` / `PR #174 close state` subsections.)

## TL;DR

Four PRs merged + auto-deployed back-to-back in one continuous run.
**The Sentry SDK no longer ships in the eager `index-*.js` chunk**
(PR #170) — it's been promoted to a dynamic `import('@sentry/react')`
scheduled via `requestIdleCallback` after first paint. Errors during
the pre-init window are still captured via lightweight synchronous
global listeners that buffer events into a 50-event-bounded queue
and replay through `Sentry.captureException` once the SDK boots,
then detach so Sentry's own GlobalHandlers integration owns
capture. Net first-paint LCP cost: **−25 kB gzip / −71 kB raw on
the eager bundle** (the realistic ceiling — see "Why only 25 kB"
below).

PR #172 then **pinned the eager entry chunk at ≤110 kB gzip** in
`.github/workflows/ci.yml` so the win cannot silently regress.
Detection is via the `<script type="module" src=…>` tag in
`dist/index.html` (Vite emits exactly one entry script per build),
which correctly distinguishes the eager chunk from PR #170's lazy
Sentry chunk that _also_ gets a default `index-*.js` filename. The
cap is enforced as a hard CI failure with rollback recipe documented
in the PR body.

PR #174 followed the same lazy-wrapper pattern as PR #170 but for
`react-hot-toast`. The library was eagerly pulled by `main.jsx`
(`Toaster` import) and `LoginPage.jsx` (`toast` import); a thin
`apps/web/src/utils/toast.js` wrapper now exposes a buffered
`toast(...)` proxy + `React.lazy` `Toaster`, dropping
`react-hot-toast` (and its `goober` CSS-in-JS dep) into a 5 kB gzip
lazy chunk. **−4.2 kB gzip on the eager bundle (-4.2%)**; cap
headroom grows from ~8 kB to ~14.5 kB.

PR #176 closes the bundle-tooling story by emitting a per-build
treemap (rollup-plugin-visualizer) as a CI artifact
(`web-bundle-stats`, 30-day retention). Future bundle-budget
bumps and lazy-load PRs can diagnose regressions visually instead
of having to grep into minified `dist/assets/index-*.js`. The
plugin is gated behind `BUNDLE_VISUALIZER=1`; CI sets it on every
build, local devs only emit `dist/stats.html` on opt-in. Build
output is byte-identical with or without the env var (verified
by chunk hash).

Net effect:

- Eager `index-*.js` (first-paint critical path):
  `index-C12pfD7b.js` **386.85 kB → 315.59 kB raw** /
  **127.03 kB → 102.09 kB gzip** (−19.6% gzip).
- New lazy chunk `index-*.js` (Sentry SDK, fetched after first paint
  via `requestIdleCallback` with `setTimeout(_, 1000)` Safari
  fallback): **360.26 kB / 120.76 kB gzip**. Imports two React
  utility symbols from the eager chunk so there's no React/ReactDOM
  duplication.
- `apps/web` test suite: 172 → **182 tests** (+10 in the new
  `SentryLazyInit.test.js`). Existing 36 ErrorBoundary +
  sentry-scrub tests untouched and still passing.
- Zero behaviour change to backend, auth pages, or any non-Sentry
  surface. `apps/backend/src/lib/sentry.js` (Node SDK) untouched —
  backend Sentry still inits synchronously on app boot.

Prod state at close (post-PR #172 deploy):

- Backend HEAD on `main`: **`7371b45`** (PR #172 squash-merge SHA;
  PR #170 squash-merge SHA `0c2439b` is HEAD~2).
- `pm2 list` → `vipos-backend` (online, 141.5 MB, ~57 s post-deploy
  restart), `vipos-worker` (online, 54.7 MB, ~56 s post-deploy
  restart), `finance-bot-tg` (online, 6 d uptime), `pm2-logrotate`
  (online).
- `/api/health` →
  `{"status":"ok","version":"1.0.0","db":{"ok":true,"latency_ms":8},"redis":{"enabled":true,"ok":true,"latency_ms":4}}`.
- `/api/v1/health/disk` → `{"status":"ok","used_percent":71.1}`
  (well under 90% threshold).
- `/api/v1/health/backup` → `{"status":"ok","age_hours":11.71}`
  (well under 25h threshold).
- VPS: disk 35 GB / 49 GB (72%), unchanged across both PR deploys.
- Frontend chunks live (PR #172 deploy rebuild):
  - `apps/web/dist/assets/index-CoGD66kV.js` =
    **316,082 bytes raw / 101,797 bytes gzip** (eager entry, served
    via `<script src=…>` in `dist/index.html`). Comfortably under
    the 110 kB gzip cap (~8.20 kB / 7.5% headroom).
  - `apps/web/dist/assets/index-CGUAMTjo.js` =
    **360,647 bytes raw / 120,334 bytes gzip** (Sentry SDK lazy
    chunk, fetched only when `initSentry()` runs after first paint).
  - The new chunk hashes (vs the PR #170 close: `index-CMynNfkG.js`
    eager / `index-QwGSzCmz.js` lazy) are expected — Vite re-hashes
    on every build, and the deploy rebuilt for PR #172.
- `tools/scripts/deploy.sh` untouched in PR #170 + PR #172 — no
  `workflow_dispatch` chicken-egg needed.

### PR #170 close state (preserved for reference)

- Backend HEAD on `main` at PR #170 close: `0c2439b`.
- Frontend chunks at PR #170 deploy rebuild:
  `index-CMynNfkG.js` = 316,082 bytes raw / **102,024 bytes gzip**
  (eager); `index-QwGSzCmz.js` = 360,647 bytes raw / 120,490 bytes
  gzip (lazy Sentry).
- `/api/health` db latency 173 ms / redis 14 ms; disk 71.29%; backup
  age 11.389 h.

## All PRs merged this session

| PR   | Branch                                  | Subject                                                                        | Risk   | Status                                                                                                                                                            |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #170 | `devin/1778089953-sentry-lazy-init`     | perf(web): lazy-load Sentry SDK after first paint (-25 kB gzip eager bundle)   | yellow | merged `0c2439b`; deploy 25452632891 ✅; production verified (eager bundle 102.02 kB gzip post-deploy)                                                            |
| #171 | `devin/1778091098-handoff-sentry-lazy`  | docs(handoff): close 2026-05-06 Sentry lazy-init session (PR #170)             | green  | merged `ddd3dd8`; deploy 25453068273 ✅; this doc was the original close — re-opened to fold in PR #172 + PR #174                                                 |
| #172 | `devin/1778091701-bundle-size-budget`   | ci(web): enforce eager-bundle gzip budget at 110 kB                            | green  | merged `7371b45`; deploy 25453547650 ✅; CI bundle-budget step shows eager `index-CoGD66kV.js` 101,797 B gzip (99.41 kB) under 110 kB cap on `main`               |
| #173 | `devin/1778092250-handoff-budget-pr`    | docs(handoff): re-close 2026-05-06 session with PR #172 (bundle-size budget)   | green  | merged `f7dd8a6`; deploy 25454061637 ✅; this doc was the second close — re-opened to fold in PR #174                                                             |
| #174 | `devin/1778093115-lazy-react-hot-toast` | perf(web): lazy-load react-hot-toast (-4.2 kB gzip eager bundle)               | yellow | merged `81a941c`; deploy 25454817872 ✅; CI bundle-budget step shows eager `index-DIrvQ15_.js` 95.20 kB gzip (cap 110 kB), production rebuilt to 97.76 kB gzip    |
| #175 | `devin/1778093875-handoff-toast-lazy`   | docs(handoff): re-close 2026-05-06 session with PR #174 (react-hot-toast lazy) | green  | merged `c6381fb`; deploy 25455420041 ✅; this doc was the third close — re-opened to fold in PR #176                                                              |
| #176 | `devin/1778094590-bundle-visualizer`    | ci(web): emit + upload bundle treemap (rollup-plugin-visualizer)               | green  | merged `ed93a46`; deploy 25455922786 ✅; CI run 25455922841 emitted `web-bundle-stats` artifact (137,546 B compressed); production eager rebuilt to 97,734 B gzip |

All seven PRs were implemented end-to-end this session. CI ran 3/3
green on the first push for each (lint + format:check, test
--if-present, build web + backend) — no reruns needed across any
of them.

## Root cause / design notes per change

### PR #170 — Sentry SDK lazy-load (`apps/web/src/lib/sentry.js`)

**Symptom (carry-over from prior handoff)**: the eager bundle on
`main` was ~387 kB raw / ~127 kB gzip. The single largest dependency
inside it (~25 kB gzip after our analysis below) was `@sentry/react`,
which gets pulled into the eager chunk by virtue of the static
`import * as Sentry from '@sentry/react'` at the top of
`apps/web/src/lib/sentry.js`. Sentry's value (crash-triage) doesn't
need to be available in the first millisecond of page load — anything
crashing during that window is rare and can be buffered and replayed
once the SDK chunk arrives.

**Design**:

1. Drop the static import of `@sentry/react`. Replace with a deferred
   dynamic `import('@sentry/react')` inside an `async function
loadAndInit(…)`.
2. Schedule the load via `requestIdleCallback(run, { timeout: 2000 })`
   (with `window.setTimeout(run, 1000)` fallback for Safari, which
   doesn't expose rIC). The timeout=2000 ms cap means the SDK still
   loads even on a busy page that never goes idle.
3. Install two synchronous pre-init handlers as soon as `initSentry()`
   is called (in `main.jsx`, before React hydrates):
   - `window.addEventListener('error', …)` — captures `ErrorEvent.error`.
   - `window.addEventListener('unhandledrejection', …)` — captures
     promise rejections, wrapping non-Error reasons in `new Error()`.
4. Both handlers push into a bounded `preInitBuffer` (cap: 50 events).
   `captureBoundaryError` (called from `<ErrorBoundary>` in React)
   uses the same buffer when called pre-init.
5. After `loadAndInit` resolves: call `Sentry.init` with the original
   config (`sendDefaultPii:false`, `beforeBreadcrumb:scrubBreadcrumb`,
   `beforeSend:scrubEvent`, all sample rates 0), iterate
   `preInitBuffer` and replay each event through
   `Sentry.captureException` inside a `Sentry.withScope` (preserving
   the `source` / `componentStack` extras), then drain the buffer
   and detach the pre-init handlers (`removeEventListener`) so
   Sentry's own `GlobalHandlers` integration owns capture from there
   on. **Critical** — without the detach we'd double-capture every
   error post-init (once via our buffer, once via Sentry's listener).
6. `captureBoundaryError` post-init forwards directly to
   `Sentry.captureException` via the cached `SentrySDK` reference
   from step 1's dynamic import resolution.
7. PII scrubbers (`scrubObject`, `scrubBreadcrumb`, `scrubEvent`,
   `SENSITIVE_KEYS`) **stay in the eager bundle**. They're tiny pure
   functions and they get passed by reference into `Sentry.init`
   when the SDK loads. Keeping them eager means a future PR that
   adds pre-init Sentry-shaped scrubbing won't need a second
   dynamic import.

**Why only 25 kB gzip and not the 52 kB the prior handoff
estimated**: the prior handoff identified the Sentry chunk as
`index.es-*.js` (159.64 kB raw / 53.54 kB gzip on `main`). That
file is actually shared `jspdf` + `xlsx` core code (verified by
`head -c 500 dist/assets/index.es-*.js` at session start — the
file's first import points at `./jspdf.es.min-*.js`). Sentry was
always part of the main eager `index-*.js`, contributing ~25 kB
gzip to its 127 kB total. The 25 kB savings we landed is the real
ceiling on this optimization.

**Verification**: `apps/web/src/__tests__/SentryLazyInit.test.js`
adds 10 cases covering:

- `initSentry({ dsn: undefined })` returns false and skips handler
  install.
- `initSentry({ dsn })` installs pre-init handlers, returns true,
  but **does not synchronously call `Sentry.init`** (the SDK chunk
  has not loaded yet — this is the eager-bundle exclusion guarantee).
- `initSentry` is idempotent — second call while scheduled returns
  false.
- `window.error` events buffer with `source:'window.error'`.
- `unhandledrejection` events with non-Error reasons wrap into Error
  and buffer with `source:'unhandledrejection'` (jsdom-portable: uses
  `globalThis.PromiseRejectionEvent` if present, else
  `Object.assign(new Event(...), { reason })`).
- `captureBoundaryError` pre-init buffers with
  `source:'react-error-boundary'` + `componentStack`.
- 50-event cap (the 51st `captureBoundaryError` is silently dropped).
- SDK boot via `_loadSentryNowForTests` (test helper that bypasses
  rIC scheduling): calls `Sentry.init` exactly once with the correct
  DSN + `beforeBreadcrumb:scrubBreadcrumb` + `beforeSend:scrubEvent`
  references (regression guard against losing the PII hooks during
  a future refactor); replays both buffered events through
  `Sentry.captureException`; drains the buffer; detaches both
  pre-init handlers.
- Post-init `captureBoundaryError` calls forward directly to
  `Sentry.captureException` (no buffer touch).
- `_resetSentryForTests` clears all module state and detaches
  handlers, so a fresh `initSentry` after reset works cleanly.

The mock `vi.mock('@sentry/react', () => sentryMock)` covers
`init`, `captureException`, and `withScope` so we never make real
Sentry network calls during the test run. `vi.resetModules()` is
called in `beforeEach` so module state is truly fresh between tests
(belt-and-braces alongside `_resetSentryForTests`).

### PR #172 — Bundle-size budget enforcement (`.github/workflows/ci.yml`)

**Symptom (carry-over from prior handoff backlog)**: PR #165 added
an informational-only "Bundle size summary" step in CI that listed
top-15 chunks by raw size + an "Eager bundle" table globbed from
`index-*.js` / `index.es-*.js` / `index-*.css`. It surfaced
regressions to PR reviewers but never failed CI. PR #170 then split
the Sentry SDK into a dynamic chunk that _also_ gets a default
`index-*.js` filename, which made the old "Eager bundle" table
list the lazy chunk alongside the real eager chunk — confusing for
reviewers, and useless as a regression guardrail.

**Root cause**: there was no programmatic identification of which
`index-*.js` was eager vs lazy. Vite emits exactly one
`<script type="module" src="…/assets/<entry>.js">` in
`dist/index.html` per build (the eager entry), and any other
`index-*.js` in `dist/assets/` is a dynamic-import target. The
fix is to parse `dist/index.html` instead of globbing.

**Fix (PR #172)**: rewrote the step (renamed to
`Bundle size summary + budget enforcement`) to:

1. Parse `apps/web/dist/index.html` and extract the entry script
   basename via two staged greps:
   `grep -oE '<script[^>]+src="[^"]+/assets/[^"]+\.js"'` →
   `grep -oE '/assets/[^"]+\.js'` → `sed 's|/assets/||'`. The same
   pattern is applied to the `<link rel="stylesheet">` tag for the
   eager CSS (informational only, no cap).
2. Render a new "Eager entry chunk" GH step-summary table that
   shows the entry filename + raw + gzip + budget (gzip) + status
   (`✅ under cap` / `❌ over cap`).
3. Enforce **`BUDGET_GZIP=110*1024`** (112,640 bytes / 110 kB) on
   the entry chunk's gzip size. If exceeded, emit
   `::error file=apps/web/src/main.jsx::eager entry chunk … is
N bytes gzip, over the 112640-byte cap` and `exit 1` to fail
   the CI job. If under cap, emit `::notice::eager entry chunk …
is X kB gzip (cap 110 kB)` so the success is visible in the
   job log.
4. Preserve the existing "Top 15 chunks by raw size" table as
   informational context (still useful for spotting non-eager
   bloat).

**Verification**:

- Local: ran the bash logic against this branch's
  `apps/web/dist/`. Detection correctly identified
  `index-qJWZ9BGm.js` as the entry; gzip 101,554 / cap 112,640 →
  "OK under cap".
- CI on PR #172 (run 25453367815): the new step surfaced
  `index-qJWZ9BGm.js` 308.19 kB raw / **99.17 kB gzip** under the
  110 kB cap, with `::notice::` line in the job log.
- Production deploy 25453547650: rebuilt eager chunk
  `index-CoGD66kV.js` 316,082 bytes raw / **101,797 bytes gzip**;
  next CI run on the merge commit `7371b45` will re-validate
  against the cap on every push to `main`.

**Cap rationale**: 110 kB gives ~8 kB headroom over today's 102 kB
production gzip — enough to absorb routine dep updates without
flaking CI, but tight enough that any feature PR that adds ≥10 kB
of code to the eager path will trip the cap and force the author
to either lazy-load or justify the bump explicitly. The win from
PR #170 (-25 kB gzip) is worth the discipline.

**What's intentionally not pinned yet**:

- CSS budget — `index-*.css` ships ~9.5 kB gzip today. Could pin
  at 12 kB but no prior regression history makes the cap
  arbitrary; revisit when there's a concrete CSS bloat incident.
- Lazy chunk budgets — the Sentry chunk is 120 kB gzip and the
  largest non-Sentry lazy chunks (jspdf, xlsx, html2canvas) are
  fetched on-demand, so a regression there is per-feature not
  first-paint-critical. Add per-route budgets if a specific lazy
  chunk becomes a hot-path performance issue.

### PR #174 — react-hot-toast lazy-load (`apps/web/src/utils/toast.js`)

**Symptom**: after PR #170 + PR #172, the eager bundle was 99.41 kB
gzip with ~8 kB headroom under the 110 kB cap. The next-largest
easily-removable cost in the eager chunk was `react-hot-toast`
(~3.9 kB gzip on its own + a few hundred bytes of internal store
wiring + its `goober` CSS-in-JS dep). Routine dep updates risked
eating into the 8 kB headroom and tripping the cap, even though
the library is only used for purely cosmetic UI.

**Root cause**: `react-hot-toast` was reachable from the eager
chunk via two static imports:

1. `apps/web/src/main.jsx`: `import { Toaster } from 'react-hot-toast'`.
2. `apps/web/src/pages/LoginPage.jsx`: `import toast from 'react-hot-toast'`.

`LoginPage` is the only eagerly-loaded page (every unauthenticated
user lands at `/login`), and its `toast.error(…)` calls in
validation handlers pulled the library into the eager bundle.
Every other call site (~30 lazy-routed pages + components) lives
inside a route-lazy boundary and was already fine.

**Fix (PR #174)**: introduced `apps/web/src/utils/toast.js`, a
thin lazy wrapper that mirrors the architectural shape of
`apps/web/src/lib/sentry.js`:

- **Default export `toast`**: a callable proxy with chained
  methods (`success`, `error`, `loading`, `dismiss`, `remove`,
  `custom`, `promise`). First call triggers a one-shot
  `import('react-hot-toast')`; calls before the SDK lands are
  buffered into a 50-event-bounded queue (`QUEUE_MAX = 50`,
  matches the Sentry pre-init buffer cap) and replayed in order
  via `flushQueue()`; subsequent calls forward directly.
- **Named export `Toaster`**: `React.lazy(() => import(...))`
  that resolves to the real `Toaster`. Mounted under
  `<Suspense fallback={null}>` in `main.jsx` so the lazy chunk
  fetch does not block first paint. `react-hot-toast`'s store
  accepts `toast(...)` calls before the Toaster mounts and
  renders them when it does, so user-visible behaviour is
  unchanged.
- **Test-only helpers**: `_resetToastForTests`,
  `_peekQueueForTests`, `_isToastLoadedForTests`,
  `_loadToastNowForTests`. The `_loadToastNowForTests` helper
  follows the same pattern as `_loadSentryNowForTests` — returns
  the load promise so tests can `await` post-load behaviour
  without juggling microtask-flush counts in vitest's mock
  environment.

`main.jsx` imports `Toaster` from `./utils/toast` and wraps it in
`<Suspense>`. `LoginPage.jsx` imports `toast` from
`../utils/toast`. Lazy pages keep their direct
`import toast from 'react-hot-toast'` imports — those are already
inside lazy boundaries, so they share the same lazy chunk via
Vite's deduped chunk graph (no double-load).

**Verification**:

- Local: `npm run lint`, `npm run format:check` clean. 191/191
  vitest tests pass (was 182, +9 new in `ToastLazy.test.js`).
- Local build: eager `index-DIrvQ15_.js` 304,800 B raw / 97,482 B
  gzip (was 316,082 B / 101,797 B post-PR #172); new lazy chunk
  `index-CUyKW1Cq.js` 12,176 B raw / 4,887 B gzip.
- CI on PR #174 (run 25454817854): bundle-budget step reports
  eager `index-DIrvQ15_.js` 95.20 kB gzip (cap 110 kB),
  `::notice::eager entry chunk index-DIrvQ15_.js is 95.20 kB gzip
(cap 110 kB)` line in the job log.
- Production deploy 25454817872: rebuilt eager chunk
  `index-Do0DuQOR.js` 305,296 B raw / 97,758 B gzip; new lazy
  chunk `index-DO0a46Wi.js` 12,568 B raw / 5,081 B gzip.
  `react-hot-toast` not present in the eager chunk's bundled
  code (verified post-deploy via grep).

**Failure-mode analysis**: if the lazy chunk fetch fails (CSP
blocks, network flake on first toast call), buffered toasts are
dropped on load failure rather than retried. `react-hot-toast`
is purely cosmetic (no business logic gated on a toast firing),
so a toast-loss is a UX-only regression, never a data-correctness
regression. The most likely real-world failure case (offline user
clicking 'Login') already fails the axios login request itself,
so the missing toast is not the user-visible problem.

## Production state at close

### VPS (103.74.5.44)

- Repo path: `/var/www/vipos`. `git log --oneline -7`:
  ```
  ed93a46 ci(web): emit + upload bundle treemap (rollup-plugin-visualizer) (#176)
  c6381fb docs(handoff): re-close 2026-05-06 session with PR #174 (react-hot-toast lazy) (#175)
  81a941c perf(web): lazy-load react-hot-toast (-4.2 kB gzip eager bundle) (#174)
  f7dd8a6 docs(handoff): re-close 2026-05-06 session with PR #172 (bundle-size budget) (#173)
  7371b45 ci(web): enforce eager-bundle gzip budget at 110 kB (#172)
  ddd3dd8 docs(handoff): close 2026-05-06 Sentry lazy-init session (PR #170) (#171)
  0c2439b perf(web): lazy-load Sentry SDK after first paint (#170)
  ```
- pm2 list (post-PR-#176 deploy): all four processes online
  (`finance-bot-tg`, `vipos-backend`, `vipos-worker`,
  `pm2-logrotate`); `bot-wa` remains absent (deleted in
  `2026-05-06-tier1-perf-followups.md` session).
- Disk: `/dev/sda1` ~71% used. Unchanged across
  PR #170 → PR #172 → PR #174 → PR #176 deploys — comfortably
  under the `/api/v1/health/disk` 90% threshold.
- Health probes (verified by SSH `curl localhost:3001/...`
  immediately after PR #176 deploy):
  - `/api/health` → `{"status":"ok","db":{"latency_ms":32},"redis":{"latency_ms":9}}`
- Frontend bundles served (post-PR #176 deploy rebuild):
  - Eager: `apps/web/dist/assets/index-BAAkMglR.js` =
    **305,296 bytes raw / 97,734 bytes gzip** (under the
    110 kB cap with ~14.56 kB / 13.2% headroom — best
    headroom in the project's history; bundle bytes are
    effectively identical to PR #174's deploy build, confirming
    PR #176 introduced no functional changes).
  - `dist/stats.html` is **not** present in the production
    `dist/` (deploy script does not set `BUNDLE_VISUALIZER=1`,
    intentionally — the treemap is a CI-side diagnostic, not
    something we want to ship publicly under `/vipos/stats.html`).
  - The CI bundle-budget step on the merge commit reported the
    eager chunk at **95.42 kB gzip** for the runner build
    (no Sentry source-maps upload → ~250 bytes smaller than the
    deploy build); both numbers are well under the 110 kB cap.
  - The CI build also produced a `web-bundle-stats` artifact
    (137,546 bytes compressed, 30-day retention) on run
    25455922841 — first artifact from the new visualizer step.

### PR #174 close state (preserved for reference)

- Backend HEAD on `main` at PR #174 close: `81a941c`.
- Frontend chunks at PR #174 deploy rebuild:
  `index-Do0DuQOR.js` = 305,296 bytes raw / **97,758 bytes
  gzip** (eager); `index-BD4U5CaG.js` = 360,647 bytes raw /
  120,331 bytes gzip (lazy Sentry); `index-DO0a46Wi.js` =
  12,568 bytes raw / 5,081 bytes gzip (lazy react-hot-toast).
- `/api/health` db latency 28 ms / redis 5 ms; disk 71.19%;
  backup age 12.158 h.

### PR #172 close state (preserved for reference)

- Backend HEAD on `main` at PR #172 close: `7371b45`.
- Frontend chunks at PR #172 deploy rebuild:
  `index-CoGD66kV.js` = 316,082 bytes raw / **101,797 bytes
  gzip** (eager); `index-CGUAMTjo.js` = 360,647 bytes raw /
  120,334 bytes gzip (lazy Sentry).
- `/api/health` db latency 8 ms / redis 4 ms; disk 71.1%; backup
  age 11.71 h.

### Sentry / Backend / Frontend

- Sentry releases unchanged from prior handoff close (PR #170 doesn't
  bump the release tag — it's a runtime-load-pattern change, not a
  feature change).
- `apps/backend/src/lib/sentry.js` untouched.

### Credentials state (rotation table)

| Component            | Last rotation              | Owner                                                |
| -------------------- | -------------------------- | ---------------------------------------------------- |
| `GITHUB_PAT_VIPOS`   | 2026-05-06 (prior session) | Devin org-scope secret store (re-saved this session) |
| Postgres `postgres`  | 2026-05-04 cutover         | `/root/.vipos-pg-pwd` mode 600                       |
| Postgres `vipos_app` | 2026-05-04 cutover         | `/root/.vipos-app-pwd` mode 600                      |
| Redis                | 2026-05-04 cutover         | `/root/.vipos-redis-pwd` mode 600                    |
| Sentry build env     | 2026-05-05                 | `/root/.vipos-sentry-build.env` mode 600             |
| `VPS_PASSWORD`       | n/a (founder-managed)      | Devin org-scope secret store (re-saved this session) |

`secrets list` returned empty at session start (per op-note 1 in the
prior handoff) — both `GITHUB_PAT_VIPOS` and `VPS_PASSWORD` were
re-saved org-scope upfront and resolved on the first round-trip.

## Critical infrastructure context

(All carried over from `2026-05-06-disk-health-and-ci-timeout-fix.md`
unless ticked here. Update only when the situation changes; don't
duplicate the surrounding text.)

### `git-manager.devin.ai/proxy` returns 403 on push (still active)

Verified again this session: `git push origin <branch>` returned 403
on the initial attempt. PAT-fallback recipe in
`docs/v3/workflow/devin_continuous_automation.md` §4 was used for
PR #170's push — completed in <1 second. The proxy fallback continues
to be required for **all** pushes from Devin sessions.

### `git_pr` tool returns 403 (REST API still required)

Did not retry the Devin tool this session; went straight to REST API
with `${GITHUB_PAT_VIPOS}` per the operational note in the previous
handoff. Both `POST /repos/alviarts/VIPOS/pulls` (PR create) and
`PUT /repos/alviarts/VIPOS/pulls/170/merge` (squash-merge) worked
on the first call.

### `tools/scripts/deploy.sh` chicken-egg (still applies)

None of PR #170 / PR #172 / PR #174 touched `tools/scripts/deploy.sh`,
so no `workflow_dispatch` chicken-egg this session. Procedure stays
documented in `devin_continuous_automation.md` §5.

### Bundle-size budget enforcement (new this session, PR #172)

`.github/workflows/ci.yml` step `Bundle size summary + budget
enforcement` now fails CI when the eager entry chunk's gzip size
exceeds **`BUDGET_GZIP=110*1024`** (112,640 bytes). The eager entry
is detected by parsing the single `<script type="module" src=…>`
tag in `apps/web/dist/index.html` so it cannot be confused with the
lazy Sentry chunk that _also_ gets a Vite-default `index-*.js`
filename (currently 120 kB gzip). Bumping the cap is a deliberate
act: edit the `BUDGET_GZIP` line in `ci.yml` and document the
reason in the bumping PR's body.

If the detection regex ever breaks (e.g., a future Vite version
emits a multi-script `index.html`), the step fails fast with a
clear `::error::` line. Worst-case rollback: revert PR #172, or
narrowly remove the trailing `if [ "$ENTRY_GZ" -gt "$BUDGET_GZIP" ]`
block to keep the improved entry-detection summary without the cap.

## Outstanding backlog

### Tier 1 — no founder input needed

- ~~**Eager bundle reduction (Sentry SDK lazy init)**~~ — **✅ DONE
  this session (PR #170)**. Eager bundle dropped 386.85 kB / 127.03
  kB gzip → 315.59 kB / 102.09 kB gzip (−19.6% gzip). The next-most
  promising eager-bundle reduction target on the SDK side would be
  the React Router code-split, but that's a larger refactor (touches
  every route definition) and the savings are smaller than the
  Sentry win.
- ~~**Bundle-size budget enforcement**~~ — **✅ DONE this session
  (PR #172)**. Founder approved 110 kB gzip cap on the eager entry
  chunk; CI now fails hard on regressions. Detection via
  `dist/index.html` `<script src=…>` parse.
- ~~**`react-hot-toast` lazy-load**~~ — **✅ DONE this session
  (PR #174)**. Identified follow-up to the previous re-close note
  ("sub-component splits, e.g. extracting the `Toaster`'s
  react-hot-toast bundle; estimate ~5-8 kB gzip"); the actual
  measured win was −4.2 kB gzip (slightly less than the upper
  estimate, because `goober` had already partially deduped with
  Vite's other CSS-in-JS users). Eager chunk now
  **97,758 B gzip / 95.46 kB** post-deploy with ~14.5 kB / 13.2%
  headroom under the 110 kB cap.
- ~~**Bundle visualizer + CI artifact**~~ — **✅ DONE this session
  (PR #176)**. `rollup-plugin-visualizer` 5.x emits a treemap
  to `apps/web/dist/stats.html` when `BUNDLE_VISUALIZER=1`; CI
  sets the env var on every build and uploads the file as the
  `web-bundle-stats` artifact (30-day retention). First artifact
  appeared on run 25455922841 (137,546 B compressed). Future
  bundle-budget bumps can use the treemap to identify the next
  lazy-load candidate without grepping into minified chunks.
- **`xlsx@0.18.5` high CVE eradication** — see Tier 2 carry-over.
  Listed here as a placeholder note that PR #170 / #172 / #174 did
  not touch `xlsx`; its 429 kB lazy chunk is unchanged and still
  loads on first Export Excel click.

**At session re-close, no Tier-1-actionable-without-founder-input
backlog items remain that yield ≥3 kB gzip.** Remaining candidate
for a future session: extract `axios` (~16 kB gzip in the eager
chunk) into a lazy chunk by deferring the AuthContext's bootstrap
`/auth/me` + `/auth/refresh` calls to a `useEffect()` that
dynamic-imports axios. This is a **yellow-to-red risk refactor**
(touches ~30+ files that import `utils/api.js` + changes the auth
bootstrap ordering). Per protocol §7, the mass-user-invalidation
risk if the refactor breaks pushes this into red territory —
**block on founder approval before starting**. Estimated savings:
−10-15 kB gzip on the eager chunk (axios isn't fully tree-shakable;
~2-4 kB stays for the type definitions / interceptor scaffolding
that AuthContext uses before the dynamic import resolves). The
bundle visualizer (PR #176) treemap is the right tool to verify
this estimate before greenlighting the refactor: download the
`web-bundle-stats` artifact from any recent CI run on `main`, open
`stats.html`, and inspect the eager chunk's axios subtree.

### Tier 1 (operational) — no follow-ups this session

PR #170, #172, #174, #176 are all single-purpose source-code or
CI changes. CI ran 3/3 green on the first push for each; deploys
ran ✅ on the first attempt. No operational tweaks layered.

### Tier 2 — blocked on founder input

(All carried over from `2026-05-06-disk-health-and-ci-timeout-fix.md`
unless ticked here.)

- **Branch protection on `main`** — phase-0 P0-04 unticked AC. Same
  status as carry-over.
- **HTTPS domain pick + Let's Encrypt** — same status.
- **Sidebar role-visibility rules** — same status.
- **Delete stale `GITHUB_PAT_2`** (proton-telegram-bot scope) — same
  status; founder can revoke + delete from org-scope at leisure.
- **PR #50** (`docs(P2-03): mark task as done in phase_2_backend.md`,
  author `alviarts`, opened 2026-05-04) — has merge conflicts. Same
  status.
- **PR #1** (`VIPOS @ /vipos: Majoo API analysis + Section 19
features`, original initial PR) — still open from project genesis.
  Same status.
- **`xlsx@0.18.5` high CVEs (Prototype Pollution + ReDoS)** — same
  status. Founder decision needed before migration to `exceljs` or
  alternative.

## Files modified this session

```
apps/web/src/lib/sentry.js                    | 232 +/- 33   PR #170 (rewrite to lazy-load + pre-init buffer)
apps/web/src/__tests__/SentryLazyInit.test.js | 204 ++       PR #170 (new — 10 cases)
.github/workflows/ci.yml                      | 104 +/- 25   PR #172 (rewrite + budget enforcement) + PR #176 (visualizer artifact)
apps/web/src/utils/toast.js                   | 149 ++       PR #174 (new lazy wrapper around react-hot-toast)
apps/web/src/__tests__/ToastLazy.test.js      | 191 ++       PR #174 (new — 9 cases)
apps/web/src/main.jsx                         |  16 +/-  6   PR #174 (Toaster lazy + Suspense wrap)
apps/web/src/pages/LoginPage.jsx              |   8 +/-  1   PR #174 (toast import via wrapper)
apps/web/vite.config.js                       |  26 ++       PR #176 (rollup-plugin-visualizer plugin gated by BUNDLE_VISUALIZER)
apps/web/package.json                         |   1 ++       PR #176 (devDep: rollup-plugin-visualizer ^5.14.0)
package-lock.json                             | 112 ++       PR #176 (lock for rollup-plugin-visualizer + transitive deps)
docs/handoff/2026-05-06-sentry-lazy-init.md   | (this file)  handoff PR (created by #171, updated by #173, #175, this re-close PR)
```

Total: 7 source files + 1 ci workflow + 1 lockfile + 1 handoff
doc, ~1,043 insertions / ~65 deletions across PR #170 + PR #171

- PR #172 + PR #173 + PR #174 + PR #175 + PR #176 + this re-close
  handoff PR.

## Operational notes for next session

1. **The eager `index-*.js` is now hash `BAAkMglR`** (97.74 kB gzip).
   Production rebuilds get a fresh hash on every deploy because
   the Sentry source-map upload mutates the chunk; CI runner
   builds (no source-maps) produce a stable hash per source-tree
   state. Use the `web-bundle-stats` CI artifact (PR #176) for
   per-chunk inspection rather than chasing hashes.
   If it suddenly grows back past ~110 kB gzip without a corresponding
   feature PR, suspect a regression of one of the lazy-loads:
   - Sentry: someone added `import * as Sentry from '@sentry/react'`
     to a file reachable from `main.jsx`, or `@sentry/react` was
     bumped to a major that changes its tree-shaking shape. Inspect
     with
     `grep -l "browserApiErrorsIntegration\|getCurrentScope" dist/assets/*.js`
     — only the **lazy** chunk should match; if the eager chunk
     matches, the Sentry lazy-load broke.
   - react-hot-toast: someone imported `Toaster` or `toast` directly
     from `'react-hot-toast'` in `main.jsx`, `LoginPage.jsx`, or
     any other eager-reachable module instead of going through
     `apps/web/src/utils/toast`. Inspect with
     `grep -l "goober\|use-toaster\|hot-toast" dist/assets/*.js`
     — only the **lazy** chunk should match (currently
     `index-DO0a46Wi.js` ~5 kB gzip).
2. **The `_loadSentryNowForTests` helper** in `apps/web/src/lib/sentry.js`
   is the right way for any future test to assert post-init behavior
   (it bypasses the rIC schedule + does the `loadAndInit` synchronously
   under the `vi.mock('@sentry/react')` scope). Don't try to advance
   timers and wait for rIC to fire — vitest's fake timers are flaky
   with mixed-Promise-resolution code paths and the helper sidesteps
   the whole problem.
3. **The pre-init buffer cap is 50 events** (`PRE_INIT_BUFFER_MAX`).
   Any future regression that triggers an error loop during first
   paint will silently drop after 50 — this is by design (memory
   safety) but if you're investigating "missing Sentry events from
   first paint", check whether a runaway loop hit the cap.
4. **`VPS_PASSWORD` and `GITHUB_PAT_VIPOS` are again working
   org-scope as of this session start**. The prior session's note
   about `secrets list` returning empty at session start still
   applies — re-request both at the start of every Devin VIPOS
   session if they're absent. This session reproduced the empty-list
   start and resolved with one round-trip.
5. **CI test job's 15-minute budget (PR #153) was not exercised
   this session.** The `apps/web` test surface grew from 172 to
   **191 tests** (+10 from PR #170, +9 from PR #174); the test job
   still ran in well under 15 minutes. No need to revisit the
   budget yet.
6. **The eager-bundle gzip cap (PR #172) is `110*1024` bytes** in
   `.github/workflows/ci.yml`. If a legitimate dep update pushes
   the eager chunk over the cap, the bumping PR must (a) edit
   `BUDGET_GZIP` to a new value with explicit headroom rationale,
   and (b) link the bumping PR's body back to the dep's release
   notes / changelog so the cap-history is auditable. Don't just
   bump silently. Conversely, if a _future_ perf PR drops the eager
   chunk by another ≥5 kB gzip, drop the cap by ~half the win
   (keeping ~5 kB headroom) so we lock in the new floor.
7. **The CI step `Bundle size summary + budget enforcement` reads
   `apps/web/dist/index.html` to identify the eager entry.** If a
   future Vite version changes how it emits the entry `<script>`
   tag (multi-script, different attribute order, etc.), the
   detection regex in the step may need adjustment. The step fails
   fast with `::error::failed to detect eager entry chunk` so the
   failure is loud, not silent.
