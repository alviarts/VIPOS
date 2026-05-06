# VIPOS Sesi Handoff — 2026-05-06 (phase-1 AC completion + web bundle code-split)

Closed: 2026-05-06 ~09:30 UTC. Prepared by Devin in continuous-automation
mode. Devin session:
<https://app.devin.ai/sessions/07e3a9a36d1f42878294118e8be52fa5>

Successor to `2026-05-06-lint-cleanup-and-phase-dod-ticks.md` (which
captured PRs #103–#111 / lint+format+phase-0 hygiene). This doc starts at
PR #112 and ends at PR #119, covering:

- Per-AC verification + tick of every remaining phase-1 subsystem.
- A real `apps/web` bundle code-split via `React.lazy` (instead of the
  `manualChunks`-only approach that was on the backlog).

## TL;DR

Seven green/yellow PRs merged in one continuous run. Phase-1
`docs/v3/workflow/phase_1_web_dashboard.md` is now **122/122 ACs ticked**
(was 73/122 at PR #112 close). Web first-paint bundle dropped from
**2,314 kB → 401 kB (-82.6%)** thanks to per-route `React.lazy` +
`<Suspense>`.

Net effect:

- Phase-1 per-AC ticks **73/122 → 122/122**. Six subsystems verified
  this run (P1-01 already done in PR #113 from prior session; P1-02,
  P1-03, P1-04, P1-14, P1-16 ticked here).
- `apps/web/dist/assets/index-*.js` first-paint: **2,314 kB → 401 kB
  pre-gzip / 639 kB → 130 kB gzip**.
- 116 chunks total in `dist/assets/` (was 5). Dashboard/Reports/Print
  surfaces only download their heavy libs (recharts, jspdf, xlsx,
  html2canvas) when the user navigates to them.
- Zero behaviour change to backend or to the auth pages
  (`LoginPage` / `SignupPage` / `ForgotPasswordPage` /
  `ResetPasswordPage`) — they stayed eager so the login fast path is
  unaffected.

Prod state at close (post-PR #119 deploy):

- Backend HEAD `170ac0e` (PR #119 squash-merge SHA on `main`).
- `pm2 list` → `vipos-backend` (online, 107 MB, 2m uptime),
  `vipos-worker` (online, 55 MB, 2m uptime), `finance-bot-tg`
  (online, 5d uptime), `pm2-logrotate` (online), `bot-wa` (stopped —
  pre-existing state, not touched).
- `/api/health` →
  `{"status":"ok","db":{"ok":true,"latency_ms":10},"redis":{"ok":true,"latency_ms":4}}`.
- Web bundle: `apps/web/dist/assets/index-BDoCg5H0.js` = **401,683
  bytes** (vs prior 2,314,919 bytes); 116 chunk files in
  `dist/assets/` totalling 3.0 MB.
- VPS: disk 35 GB / 49 GB used (71%), RAM 693 MB / 3.8 GB used.
- `tools/scripts/deploy.sh` untouched in every PR — no
  `workflow_dispatch` chicken-egg needed.

## All PRs merged this session

| PR   | Subject                                                                    | Risk   | Status                             |
| ---- | -------------------------------------------------------------------------- | ------ | ---------------------------------- |
| #112 | `docs(handoff): refresh 2026-05-06 doc with PRs #106-#111`                 | green  | merged (`74be77c`); deploy success |
| #113 | `docs(phase-1): tick verified ACs in P1-01 (Layout shell)`                 | green  | merged; deploy success             |
| #114 | `docs(phase-1): tick verified ACs in P1-02 (Auth flow refinement)`         | green  | merged; deploy success             |
| #115 | `docs(phase-1): tick verified ACs in P1-03 (Dashboard page)`               | green  | merged; deploy success             |
| #116 | `docs(phase-1): tick verified ACs in P1-04 (Produk Master + 5-tab wizard)` | green  | merged; deploy success             |
| #117 | `docs(phase-1): tick verified ACs in P1-14 (Karyawan + Payroll + Absensi)` | green  | merged (`22efaaa`); deploy success |
| #118 | `docs(phase-1): tick verified ACs in P1-16 (Pengaturan / Settings)`        | green  | merged (`0850357`); deploy success |
| #119 | `perf(web): lazy-load page routes via React.lazy + Suspense (-82% bundle)` | yellow | merged (`170ac0e`); deploy success |

(All eight merged via REST API squash with `GITHUB_PAT_VIPOS`.
`tools/scripts/deploy.sh` untouched; no `workflow_dispatch` needed.)

### PRs #112–#118 — phase-1 per-AC verification methodology

For every `### P1-XX` subsystem inside
`docs/v3/workflow/phase_1_web_dashboard.md` whose section header was
already `[done]` (i.e. accepted at the subsystem level by an earlier
Devin session) but whose individual `- [ ]` AC bullets were still
unchecked, the workflow was:

1. Read the AC bullet text.
2. Open the source file(s) the AC is talking about (page component,
   wizard tab, backend route, util) and verify the behaviour exists.
3. Annotate the bullet inline with `— <file:path>` plus a one-line
   evidence summary (function name, route URL, schema reference, etc.).
4. Flip the box from `- [ ]` to `- [x]`.
5. `prettier --write` on the doc, commit, PR, CI, squash-merge.

This produced one PR per subsystem so the diff is reviewable:

- P1-01 Layout shell — 8 ACs verified (PR #113, prior session).
- P1-02 Auth flow refinement — 8 ACs verified (PR #114).
- P1-03 Dashboard page — 8 ACs verified (PR #115).
- P1-04 Produk Master + 5-tab wizard — 9 ACs verified (PR #116).
- P1-14 Karyawan + Payroll + Absensi — 6 ACs verified (PR #117).
- P1-16 Pengaturan / Settings — 10 ACs verified (PR #118).

Subsystems P1-05..P1-13, P1-15, P1-17, P1-18 were verified to already
be fully ticked at the AC level in the file (an automated `grep -c '^- \[
\]'` scan returned 0 across those sections), so they didn't need
their own PRs. Phase-1 per-AC count progressed:

```
73  -> 81 (#113)
81  -> 89 (#114)
89  -> 97 (#115)
97  -> 106 (#116)
106 -> 112 (#117)
112 -> 122 (#118)   <-- 100%
```

### PR #119 — `React.lazy` + `<Suspense>` route-level code-split

The 2.31 MB pre-split `apps/web/dist/assets/index-*.js` was on the
"Tier 1 — yellow risk" backlog from the previous session, suggested
to be solved with `manualChunks`. **A `manualChunks`-only approach
turned out to be the wrong tool for this codebase**: most pages
statically import shared utilities (`utils/exportTable.js` →
`xlsx` + `jspdf` + `jspdf-autotable`), so any `vendor` bucket containing
those libs gets pulled in eagerly anyway. Tested it — eager bundle
went _up_, not down.

The right fix was route-level `React.lazy`. Concretely, in
`apps/web/src/App.jsx`:

- Auth pages (`LoginPage`, `SignupPage`, `ForgotPasswordPage`,
  `ResetPasswordPage`) and the `AppShell` stay eager. These are the
  fast paths and would only get a flash-of-spinner if lazy.
- Every other page (60+ components) converts from
  `import FooPage from './pages/FooPage'` to
  `const FooPage = lazy(() => import('./pages/FooPage'))`.
- The whole `<Routes>` tree is wrapped in `<Suspense fallback={<Spinner
/>}>` using the existing animated spinner styling already in the file.

Bundle delta (`apps/web/dist`):

| File / phase                           | Before   | After      |
| -------------------------------------- | -------- | ---------- |
| `index-*.js` (eager on every page)     | 2,314 kB | **401 kB** |
| `index-*.js` gzip                      | 639 kB   | **130 kB** |
| chunks in `dist/assets/`               | 5        | **116**    |
| largest lazy chunk (`ReportFilterBar`) | n/a      | 717 kB     |
| `DashboardPage` lazy chunk             | n/a      | 417 kB     |
| `html2canvas.esm.js` (lazy, retained)  | 202 kB   | 202 kB     |
| `index.es.js` (jspdf, lazy, retained)  | 160 kB   | 160 kB     |
| `purify.es.js` (lazy, retained)        | 24 kB    | 24 kB      |

First-paint eager bundle dropped **-82.6%**. Login / signup / forgot
/ reset paths now under 130 kB gzip total before any user
interaction.

Tested in CI:

- `npm run lint --silent` → 0 errors, 0 warnings (still
  `--max-warnings=0` hard-gated by PR #110).
- `npm run format:check` → all matched files prettier-clean.
- `vitest --workspace=apps/web` → 14 files / 82 tests passing.
- `vite build` → 0 errors, deploys cleanly to VPS at `170ac0e`.

Risk classification: **yellow** (touches first-paint on every page).
Rollback recipe: `git revert 170ac0e` and re-run `deploy-vps.yml` —
no migrations, no schema changes, no state.

## Production state at close (post-PR #119)

```
ssh root@103.74.5.44
cd /var/www/vipos
git log -1 --oneline
# 170ac0e perf(web): lazy-load page routes via React.lazy + Suspense (#119)

curl -sS http://localhost:3001/api/health
# {"status":"ok","version":"1.0.0",
#  "db":{"ok":true,"latency_ms":10},
#  "redis":{"enabled":true,"ok":true,"latency_ms":4}}

pm2 list
# vipos-backend     online (107 MB, 2m uptime)
# vipos-worker      online (55 MB, 2m uptime)
# finance-bot-tg    online (5d uptime)
# bot-wa            stopped  (pre-existing, not touched)
# pm2-logrotate     online (3d uptime)

ls -la /var/www/vipos/apps/web/dist/assets/index-*.js
# -rw-r--r-- 1 root root 401683 May  6 16:25 index-BDoCg5H0.js

ls /var/www/vipos/apps/web/dist/assets/ | wc -l
# 116

du -sh /var/www/vipos/apps/web/dist/assets/
# 3.0M

df -h /var/www/vipos | tail -1
# /dev/sda1   49G   35G   15G  71% /

free -h
# Mem: 3.8 GiB total, 693 MiB used, 1.7 GiB free, 2.8 GiB available
```

### Sentry

Source-maps still uploaded by PR #119 build (Sentry plugin runs in CI
with `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` set). Note
that the bundle now produces ~80 chunk source-maps instead of 1; the
plugin handles glob-upload automatically — verified PR #119 deploy
green end to end.

## Critical infrastructure context (unchanged from previous handoff)

These workarounds remain active and unchanged:

1. **`git-manager.devin.ai/proxy` returns 403 on push.** Use the
   PAT-fallback recipe in
   `docs/v3/workflow/devin_continuous_automation.md` §4
   (`HOME=/tmp/empty-home` + `GIT_CONFIG_NOSYSTEM=1` + `GIT_ASKPASS`
   script reading `$GITHUB_PAT_VIPOS`).
2. **`git_pr` tool returns 403 on PR create with PAT.** Use the REST
   API curl recipe in §5 (`POST /repos/alviarts/VIPOS/pulls` + `PUT
/repos/alviarts/VIPOS/pulls/<num>/merge` with
   `merge_method=squash`).
3. **`tools/scripts/deploy.sh` chicken-egg.** Edits to `deploy.sh`
   only take effect on the second run of `deploy-vps.yml`. None of
   this session's PRs touched `deploy.sh`, so no
   `workflow_dispatch` was needed.
4. **`main` branch is NOT protected** in GitHub. Tier 2 backlog
   item; needs founder action (P0-02 AC).
5. **`GITHUB_PAT_2` is stale (401)**. The fresh `GITHUB_PAT_VIPOS`
   (rotated 2026-05-06 by founder) is the one to use. Consider
   deleting `GITHUB_PAT_2` from Devin org-secret store to avoid
   future confusion.

## Outstanding backlog

### Done this session (was on Tier 1 at session start)

| Item                                                                           | Resolved by   |
| ------------------------------------------------------------------------------ | ------------- |
| Per-AC checkbox cleanup inside `[done]` sections of `phase_1_web_dashboard.md` | PRs #113–#118 |
| Code-split `apps/web/dist/assets/index-*.js` (2.31 MB pre-gzip warning)        | PR #119       |
| Refresh of handoff doc to capture PRs #106–#111 (intermediate snapshot)        | PR #112       |

### Tier 1 — no founder input needed (next Devin can pick autonomously)

| Item                                                                                                                                                                         | Risk   | Estimate  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| Investigate the largest remaining lazy chunk: `ReportFilterBar-*.js` (717 kB) — likely pulls full xlsx + jspdf into one chunk; could split further.                          | yellow | 1–2 hours |
| `bot-wa` pm2 entry still in `stopped` state (pre-existing). Decide: delete entry or actually run it. Founder context likely needed.                                          | yellow | 30 min    |
| Migrate `apps/web/src/__tests__` to use `@testing-library/jest-dom` matchers consistently (some tests still use `expect(x).toBeTruthy()` instead of `.toBeInTheDocument()`). | green  | 1–2 hours |
| Phase 0 P0-04 single remaining unticked AC ("Branch protection on `main`") — see Tier 2.                                                                                     | —      | n/a       |

### Tier 2 — blocked on founder input

| Item                                                                       | Needs                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------- |
| Branch protection on `main` (P0-02 AC) — require PR + CI pass before merge | Founder enables it via GitHub Settings → Branches |
| HTTPS domain pick + Let's Encrypt cert install on VPS                      | Founder picks domain + DNS A-record point         |
| Sidebar role-visibility rules per tier (admin vs kasir vs owner)           | Founder confirms which menu items per role        |
| Delete stale `GITHUB_PAT_2` from Devin org-secret store                    | Founder removes via Devin dashboard               |

## Files modified this session

```
docs/handoff/2026-05-06-lint-cleanup-and-phase-dod-ticks.md  +20 lines (PR #112)
docs/v3/workflow/phase_1_web_dashboard.md                    +49 / -49 (PRs #113-#118: tick + annotate ACs)
apps/web/src/App.jsx                                         +212 / -200 (PR #119: lazy + Suspense rewrite)
docs/handoff/2026-05-06-phase1-ac-completion-and-bundle-split.md  (this file)
```

## Operational notes for next session

1. **`apps/web/src/App.jsx` is now lazy-route-driven.** When adding a
   new page, follow the existing pattern — `const FooPage = lazy(() =>
import('./pages/FooPage'))` at the top, then `<Route element={<FooPage />}/>` inside the protected outlet. The `<Suspense
fallback={<Spinner />}>` boundary is already at the top of
   `<App />` so no extra setup needed.

2. **Phase-1 docs are at 100% AC granularity.** If a new phase-1
   subsystem gets added (P1-19+), the per-AC verification pattern is
   documented in this handoff under "PRs #112–#118 methodology".

3. **First-paint bundle is 401 kB pre-gzip / 130 kB gzip.** The only
   chunk above 500 kB now is `ReportFilterBar-*.js` (717 kB) which is
   route-lazy and only loaded on `/reports/*` pages. If we want to
   bring that under 500 kB, the path is to split `xlsx` and `jspdf`
   inside `utils/exportTable.js` into dynamic imports (currently they
   are static top-of-file imports, which forces bundling).

4. **Sentry source-map upload**: PR #119 produces ~80 chunk
   source-maps (one per lazy chunk). The plugin handles them all in a
   single upload pass; verified end-to-end by the PR #119 deploy run
   reaching pm2 restart with no errors.

5. **VPS bundle path is the same.** `apps/web/dist/assets/index-*.js`
   pattern still works for "find the eager chunk". The hash will
   change on every build (Vite content-hash) but the prefix is stable.

6. **Continuous automation mode is still active per
   `docs/v3/workflow/devin_continuous_automation.md`.** Founder
   paused this session at "pause setelah update handoff". Restart by
   founder saying anything other than `pause` / `cukup` / `stop dulu`
   / `mode normal lagi`.
