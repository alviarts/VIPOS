# VIPOS Sesi Handoff — 2026-05-06 (Sentry SDK lazy-init)

Closed: 2026-05-06 ~18:11 UTC. Prepared by Devin in continuous-automation
mode. Devin session:
<https://app.devin.ai/sessions/d88203c179a44adb964e0bf8798b0456>

Successor to `2026-05-06-disk-health-and-ci-timeout-fix.md` (which was
"final-closed" at ~17:05 UTC after founder said `pause`). This doc
covers the next continuous-automation session, which merged a single
Tier-1 perf PR end-to-end: PR #170 (Sentry SDK lazy-load → eager bundle
−25 kB gzip). Total time-to-handoff after secret bootstrap:
~15 minutes.

## TL;DR

One yellow PR merged + auto-deployed in one continuous run. **The
Sentry SDK no longer ships in the eager `index-*.js` chunk** — it's
been promoted to a dynamic `import('@sentry/react')` scheduled via
`requestIdleCallback` after first paint. Errors during the pre-init
window are still captured via lightweight synchronous global
listeners that buffer events into a 50-event-bounded queue and
replay through `Sentry.captureException` once the SDK boots, then
detach so Sentry's own GlobalHandlers integration owns capture.
Net first-paint LCP cost: **−25 kB gzip / −71 kB raw on the eager
bundle** (the realistic ceiling — see "Why only 25 kB" below).

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

Prod state at close (post-PR #170 deploy):

- Backend HEAD on `main`: `0c2439b` (PR #170 squash-merge SHA).
- `pm2 list` → `vipos-backend` (online, 141.0 MB, ~53 s post-deploy
  restart), `vipos-worker` (online, 54.5 MB, ~51 s post-deploy
  restart), `finance-bot-tg` (online, 6d uptime), `pm2-logrotate`
  (online).
- `/api/health` →
  `{"status":"ok","version":"1.0.0","db":{"ok":true,"latency_ms":173},"redis":{"enabled":true,"ok":true,"latency_ms":14}}`.
- `/api/v1/health/disk` → `{"status":"ok","used_percent":71.29}`
  (well under 90% threshold).
- `/api/v1/health/backup` → `{"status":"ok","age_hours":11.389}`
  (well under 25h threshold).
- VPS: disk 35 GB / 49 GB (72%), unchanged from prior close.
- Frontend chunks live (PR #170 deploy rebuild):
  - `apps/web/dist/assets/index-CMynNfkG.js` =
    **316,082 bytes raw / 102,024 bytes gzip** (eager entry, served
    via `<script src=…>` in `dist/index.html`).
  - `apps/web/dist/assets/index-QwGSzCmz.js` =
    **360,647 bytes raw / 120,490 bytes gzip** (Sentry SDK lazy
    chunk, fetched only when `initSentry()` runs after first paint).
- `tools/scripts/deploy.sh` untouched in PR #170 — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Branch                              | Subject                                                                      | Risk   | Status                                                                                                 |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| #170 | `devin/1778089953-sentry-lazy-init` | perf(web): lazy-load Sentry SDK after first paint (-25 kB gzip eager bundle) | yellow | merged `0c2439b`; deploy 25452632891 ✅; production verified (eager bundle 102.02 kB gzip post-deploy) |

PR #170 was implemented end-to-end in this session. CI ran 3/3 green
on the first push (lint + format:check, test --if-present, build web

- backend) — no rerun needed.

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

## Production state at close

### VPS (103.74.5.44)

- Repo path: `/var/www/vipos`. `git log --oneline -3`:
  ```
  0c2439b perf(web): lazy-load Sentry SDK after first paint (#170)
  1069397 docs(handoff): final close after pause; record PR #168 + prod state (#169)
  40fee27 chore(lint): ban recharts imports to lock in PR #159 win (#168)
  ```
- pm2 list (post-deploy):
  ```
  finance-bot-tg    online  6D uptime    67.8 MB
  vipos-backend     online  ~53s uptime  141.0 MB
  vipos-worker      online  ~51s uptime  54.5 MB
  pm2-logrotate     online  (untouched)  38.4 MB
  ```
  `bot-wa` remains absent (deleted in
  `2026-05-06-tier1-perf-followups.md` session).
- Disk: `/dev/sda1` 35 GB / 49 GB (72% used). Unchanged from prior
  close — comfortably under the `/api/v1/health/disk` 90% threshold.
- Health probes (verified by SSH `curl localhost:3001/...`):
  - `/api/health` → `{"status":"ok","db":{"latency_ms":173},"redis":{"latency_ms":14}}`
  - `/api/v1/health/disk` → `{"status":"ok","used_percent":71.29}`
  - `/api/v1/health/backup` → `{"status":"ok","age_hours":11.389}`
- Frontend bundles served:
  - Eager: `apps/web/dist/assets/index-CMynNfkG.js` =
    **316,082 bytes raw / 102,024 bytes gzip**.
  - Lazy Sentry chunk: `apps/web/dist/assets/index-QwGSzCmz.js` =
    **360,647 bytes raw / 120,490 bytes gzip**, fetched only after
    first paint when `initSentry()` runs.
  - `dist/index.html` `<script>` reference: `index-CMynNfkG.js`
    only (the lazy chunk is loaded on demand, not preloaded).

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

PR #170 didn't touch `tools/scripts/deploy.sh`, so no
`workflow_dispatch` chicken-egg this session. Procedure stays
documented in `devin_continuous_automation.md` §5.

## Outstanding backlog

### Tier 1 — no founder input needed

- ~~**Eager bundle reduction (Sentry SDK lazy init)**~~ — **✅ DONE
  this session (PR #170)**. Eager bundle dropped 386.85 kB / 127.03
  kB gzip → 315.59 kB / 102.09 kB gzip (−19.6% gzip). The next-most
  promising eager-bundle reduction target on the SDK side would be
  the React Router code-split, but that's a larger refactor (touches
  every route definition) and the savings are smaller than the
  Sentry win.
- **Bundle-size budget enforcement** — PR #165 added an
  informational-only bundle-size summary. Future PR can pin per-chunk
  caps (e.g. eager `index-*.js < 350 kB raw / < 110 kB gzip` to
  protect this session's win) to fail CI on regressions. Currently
  no agreed baseline; needs founder buy-in on what the cap should be
  (Tier 2 input). **Recommended cap with this session's data**:
  eager chunk `gzip <= 110 kB` (+8 kB headroom over today's 102 kB
  to absorb minor dep updates without flaking CI).
- **`xlsx@0.18.5` high CVE eradication** — see Tier 2 carry-over.
  Listed here as a placeholder note that PR #170 did not touch
  `xlsx`; its 429 kB lazy chunk is unchanged and still loads on
  first Export Excel click.

### Tier 1 (operational) — no follow-ups this session

PR #170 is a single source-code change. CI ran 3/3 green on the
first push; deploy ran 25452632891 ✅ on the first attempt. No
operational tweaks layered.

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
docs/handoff/2026-05-06-sentry-lazy-init.md   | (this file)  handoff PR
```

Total: 2 source files (1 rewrite + 1 new test file) + 1 new handoff
doc, ~403 insertions / ~33 deletions across PR #170 + this handoff
PR.

## Operational notes for next session

1. **The eager `index-*.js` is now hash `CMynNfkG`** (102.02 kB gzip).
   If it suddenly grows back past ~110 kB gzip without a corresponding
   feature PR, suspect a regression of the Sentry lazy-load — either
   someone added `import * as Sentry from '@sentry/react'` to a file
   that's reachable from `main.jsx`, or `@sentry/react` was bumped to
   a major that changes its tree-shaking shape. Inspect with
   `grep -l "browserApiErrorsIntegration\|getCurrentScope" dist/assets/*.js`
   — only the **lazy** chunk should match; if the eager chunk matches,
   the lazy-load broke.
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
   this session.** The `apps/web` test surface grew from 172 to 182
   tests; the test job still ran in well under 15 minutes. No need
   to revisit the budget yet.
