# Handoff — VIPOS continuous-automation Tier-1 loop #2 (allow-list follow-ups)

> **Closed**: 2026-05-07 ~17:01 UTC
> **Devin session**: https://app.devin.ai/sessions/7949a094ff1f409b9e2bd7e7a4ff1457
> **Mode**: continuous-automation (per `docs/v3/workflow/devin_continuous_automation.md`)
> **Predecessor handoff**: [`docs/handoff/2026-05-07-tier1-continuous-automation-loop.md`](2026-05-07-tier1-continuous-automation-loop.md)

## TL;DR

Loop #2 closed: **2 follow-up PRs merged** locking the canonical
`payment_method` allow-list end-to-end. PR #235 codifies the 27-case
smoke matrix as a permanent vitest integration test on
`POST /api/transactions`; PR #236 wires the web kasir to send
canonical uppercase codes (`CASH`/`EDC`/`QRIS_STATIC`) and renders
friendly Indonesian labels in receipts + transactions list/detail. CI
3/3 + 3/3 green, both auto-deployed via `deploy-vps.yml` (`run #229`
green, `run #230` in progress at close). Production state from the
preceding handoff is otherwise unchanged — same VPS, same Sentry, same
credential rotation table.

## PRs merged this session

| PR                                                 | Branch                                           | Subject                                                                                       | Risk   | CI  |
| -------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------ | --- |
| [#235](https://github.com/alviarts/VIPOS/pull/235) | `devin/1778172388-tx-allowlist-integration-test` | test(backend): integration test for `POST /api/transactions` payment_method allow-list (#232) | green  | 3/3 |
| [#236](https://github.com/alviarts/VIPOS/pull/236) | `devin/1778172862-web-kasir-canonical-codes`     | feat(web): web kasir kirim canonical uppercase payment_method codes (paired #232)             | yellow | 3/3 |

Both squash-merged into `main`; branches deleted on merge per repo
default. `deploy-vps.yml` auto-deployed `run #229` (PR #235 merge,
`f6e1f5c`) and `run #230` (PR #236 merge, `e5fd096`, in-flight at
close).

## Smoke test infrastructure

PR #235 codifies `apps/backend/src/__tests__/transactions-payment-method-allowlist.test.mjs`
(245 lines, 27 cases). Runs in 2.5s under vitest + the pre-existing
`setup-test-db.mjs` infra (docker postgres + RLS-aware vipos_app role

- admin/admin123 login). Ships in CI now — any future allow-list
  regression will fail before merge.

PR #236 ships `apps/web/src/__tests__/paymentMethod.test.js` (28
cases) covering wire-code translation + 18 Indonesian display labels

- 5 nullish/non-string/unknown edge cases.

A reusable smoke recipe for the same backend route style (auth + RLS

- tenant-scoped seed) is suggested as a SKILL.md PR — pending user
  review on the timeline. See <ref_file file="/home/ubuntu/test-plan.md" />
  and <ref_file file="/home/ubuntu/test-results/test-report.md" /> for
  the original 27/27 manual smoke that fed into PR #235.

## Production state per close

Source of truth for the morning's loop: the **predecessor handoff**
(2026-05-07 first closing). Loop #2 changed nothing on the VPS that
the predecessor doesn't already cover — same release path, same
credentials, same `deploy-vps.yml` pipeline.

| Component                           | State at loop-2 close                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` HEAD                         | `e5fd09617c8dbe599eadb2597fafa0b00263b647` (PR #236 squash-merge)                                                                                                    |
| `deploy-vps.yml`                    | `run #229` green at `f6e1f5c`. `run #230` in-flight at `e5fd096` (web kasir uppercase codes).                                                                        |
| Backend `payment_method` allow-list | **Live** — both legacy lowercase (`cash`/`card`/`qris`) and 15 canonical Android codes accepted. 27-case integration test guards against regression.                 |
| Web kasir wire format               | **Live after `run #230` completes** — `cash` → `CASH`, `card` → `EDC`, `qris` → `QRIS_STATIC`. Display labels remain Indonesian (Tunai / EDC / QRIS).                |
| Android client                      | **Unchanged** — PR #233 (cart-aware decorator) still shipped _unwired_ per `PosModule`. The Hilt swap waits on a `CartContext` provider per the original carry-over. |
| Credentials rotation                | **Unchanged** since the morning's handoff (Postgres superuser + vipos_app, Redis, JWT, Sentry).                                                                      |

## Critical infrastructure context (delta vs. predecessor)

- **Secret persistence still unreliable across sessions.** This
  session opened with `GIT_PAT` empty (canonical org-scope secret
  per §3 of the master doc, but didn't carry over). User had to
  re-provide via `request_secret`. Same happened with
  `VPS_SSH_PASSWORD` (len=0 at handoff time — couldn't run the VPS
  health check from this session). Whatever caused this in the
  morning's session is recurring; the master doc claim "persisten
  org-scope" is not dependable in practice. Workaround unchanged:
  founder re-provides on first prompt, session continues.
- **No new chicken-egg/proxy/deploy-script changes** — `tools/scripts/deploy.sh`
  untouched in this loop, so no `workflow_dispatch` was needed.

## Outstanding backlog (refreshed for next session)

### Tier 1 — no founder input needed

| Task                                                                                                                                                                     | Risk   | Est. | Notes                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire `CartAwarePaymentMethodCatalog` ke `PosModule` lewat `CartContext` provider                                                                                         | yellow | 0.5d | Android-only. Decorator shipped unwired in #233; needs Hilt @Provides binding + a CartContext that publishes the live cart total to the catalog.          |
| Backend `/api/v1/payment/qris` mint endpoint                                                                                                                             | yellow | 1d   | Prereq for P3-08 slice 5. Spec lives in P3 docs. Risk yellow due to potential payment-provider integration touchpoints.                                   |
| Backend `/api/v1/payment/qris/:ref_id/status` poll endpoint                                                                                                              | yellow | 1d   | Pairs with mint above; needed for kasir flow QRIS dynamic settlement.                                                                                     |
| **P3-08 slice 5** — wire kasir flow + transaction commit + QRIS poll loop                                                                                                | yellow | 1–2d | Big task. Depends on the two QRIS endpoints above and the CartAwarePaymentMethodCatalog wiring. Risk yellow due to user-facing finalization in the kasir. |
| Audit + add `lib/payment-methods.test.mjs` cases that hammer `Object.freeze` mutability + `for...of` ordering of `listKnownPaymentMethodCodes()` (defensive, micro-test) | green  | 0.5d | Optional but cheap. Covers the contract that `PaymentMethod.kt` enum order can never silently drift from the backend allow-list.                          |
| Add `apps/web/src/__tests__/CashierPage.test.jsx` covering the new `toWireCode()` integration in the request body (mock axios, assert wire format)                       | green  | 0.5d | Pairs with PR #236; would protect against a future regression that drops the translation. Currently only the helper has tests.                            |

### Tier 2 — blocked on founder input

| Task                                              | Why blocked                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| HTTPS domain pick (still pending from morning)    | Needs founder to commit on a domain (subdomain.alviarts.id vs. dedicated). Cert / DNS provisioning blocked. |
| Sidebar role visibility for non-admin tenants     | Pre-existing Tier-2 carry. Needs product decision on which menus a `kasir` role sees vs. admin.             |
| Receipt branding update for new outlet onboarding | Pre-existing Tier-2 carry. Needs founder to provide the new outlet logo + tagline copy.                     |

## Files modified this session

```
 apps/backend/src/__tests__/transactions-payment-method-allowlist.test.mjs | 245 ++++++++++++++++ (new)
 apps/web/src/__tests__/paymentMethod.test.js                              |  87 ++++++ (new)
 apps/web/src/utils/paymentMethod.js                                       |  68 ++++++ (new)
 apps/web/src/pages/CashierPage.jsx                                        |   4 +- (edit)
 apps/web/src/pages/TransactionsPage.jsx                                   |   8 +- (edit)
 docs/handoff/2026-05-07-tier1-loop-2-allowlist-followups.md               |  XX ++++ (this file, will land via PR)
```

## Operational notes for next session

1. **Re-request `GIT_PAT` and `VPS_SSH_PASSWORD` immediately** if `echo
"${#GIT_PAT} ${#VPS_SSH_PASSWORD}"` shows zeros. Both have hit the
   "persistent org-scope but not auto-injected" pothole twice today.
   The morning's session re-provisioned `GIT_PAT`; this session also
   had to re-prompt. `VPS_SSH_PASSWORD` was empty at this close (no
   VPS verification possible from inside this session).
2. **Backend allow-list lib (`apps/backend/src/lib/payment-methods.js`)
   is the canonical source.** Any change to the enum requires:
   - Editing `apps/android/feature/pos/src/main/java/.../PaymentMethod.kt`
   - Editing `apps/backend/src/lib/payment-methods.js` (`ANDROID_CANONICAL_CODES`)
   - Adding the new code to `EXPECTED_ALLOWED` in
     `apps/backend/src/__tests__/transactions-payment-method-allowlist.test.mjs`
   - Adding a friendly label to `PAYMENT_METHOD_LABELS` in
     `apps/web/src/utils/paymentMethod.js`
     The integration test will fail loudly until all four are aligned —
     that's the contract.
3. **Web kasir submit body now sends canonical uppercase.** When
   debugging POSTs to `/api/transactions`, expect `payment_method` to
   look like `"CASH"` not `"cash"` for any transaction created post
   `run #230` (PR #236 deploy). Pre-#236 transactions still carry
   lowercase codes and render correctly via `formatPaymentMethodLabel()`.
4. **Hilt wiring carry-over still open.** PR #233's
   `CartAwarePaymentMethodCatalog` is shipped but not bound. Any
   Android session looking to enable it needs a `CartContext`
   provider — currently no upstream consumer exists. KDoc on the
   decorator class spells out the contract.
5. **Smoke recipe captured but not yet committed as a SKILL.md.** The
   `suggest_skill_pr` for `.agents/skills/testing-vipos-backend-routes/SKILL.md`
   is on the user's timeline pending review. If approved before next
   session, it becomes the canonical recipe for future backend route
   smokes.
