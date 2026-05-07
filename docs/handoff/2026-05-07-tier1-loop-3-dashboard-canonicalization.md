# Handoff — VIPOS continuous-automation Tier-1 loop #3 (dashboard canonicalization + defensive tests)

> **Closed**: 2026-05-07 ~18:00 UTC
> **Devin session**: https://app.devin.ai/sessions/e52f931332514c11b0a55ce03629b4f9
> **Mode**: continuous-automation (per `docs/v3/workflow/devin_continuous_automation.md`)
> **Predecessor handoff**: [`docs/handoff/2026-05-07-tier1-loop-2-allowlist-followups.md`](2026-05-07-tier1-loop-2-allowlist-followups.md)

## TL;DR

Loop #3 closed: **3 follow-up PRs merged** locking the
`payment_method` allow-list and aggregation contracts end-to-end.
PR #238 adds defensive invariants to the allow-list lib (`Object.freeze`
mutability + iteration-order pinning). PR #239 ships an axios-mocked
`CashierPage.test.jsx` proving the kasir POST body now carries the
canonical wire codes from PR #236. PR #240 (the meatier one) fixes a
real user-visible regression introduced by the legacy/canonical
co-existence: dashboard pie chart and reports cashflow were splitting
the same logical method across two rows (one slice for `cash`, one for
`CASH`) — now canonicalised SQL-side via a `CASE LOWER(...)` wrapper
plus a symmetric param canonicalisation in `appendPaymentFilter()`.
CI 3/3 + 3/3 + 3/3 green; all three merged via REST API + auto-deployed
through `deploy-vps.yml` to `2d44e70` on the VPS. Backend pm2 healthy
(db 46ms, redis 5ms).

## PRs merged this session

| PR                                                 | Branch                                                      | Subject                                                                        | Risk   | CI  |
| -------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | --- |
| [#238](https://github.com/alviarts/VIPOS/pull/238) | `devin/1778173xxx-payment-methods-defensive-tests`          | test(backend): defensive invariants for payment-methods allow-list             | green  | 3/3 |
| [#239](https://github.com/alviarts/VIPOS/pull/239) | `devin/1778174xxx-cashierpage-towirecode-test`              | test(web): CashierPage integration test for toWireCode() POST body translation | green  | 3/3 |
| [#240](https://github.com/alviarts/VIPOS/pull/240) | `devin/1778175461-canonicalize-payment-method-aggregations` | fix(backend): canonicalize payment_method in dashboard + reports aggregations  | yellow | 3/3 |

All squash-merged into `main`; branches deleted on merge per repo
default. `deploy-vps.yml` auto-deployed each merge; production HEAD at
close is `2d44e70` (PR #240). Health endpoint reports
`{"status":"ok",...,"db":{"ok":true,"latency_ms":46},"redis":{"ok":true,"latency_ms":5}}`.

## Root cause analysis — PR #240

**Symptom**. After PR #236 (web kasir starts emitting canonical
uppercase payment-method codes) the `transactions.payment_method`
column ended up with a mix of casings: pre-PR-#236 rows are lowercase
(`cash`/`card`/`qris`), post-PR-#236 rows are canonical
(`CASH`/`EDC`/`QRIS_STATIC`). Three aggregation endpoints did
`GROUP BY payment_method` over that column verbatim, producing two
rows per logical method. Dashboard pie chart showed "Tunai" twice;
the cashflow report showed doubled rows; the reports filter
`?payment_method=cash` silently dropped post-#236 rows (and vice
versa).

**Root cause**. Three GROUP BY sites:

- `apps/backend/src/routes/dashboard.js` — `/payment-methods` endpoint
- `apps/backend/src/routes/reports.js` — `/sales-summary` payment_breakdown
- `apps/backend/src/routes/reports.js` — `/sales-by-payment-method`

… plus one filter helper (`appendPaymentFilter` in `reports.js`)
treated the column as canonical-only. The MDR-enrichment lookup in
`/sales-by-payment-method` was also keyed on the raw row casing, so
canonical `EDC` rows missed the legacy `card` MDR config.

**Fix**. Added three reusable primitives to
`apps/backend/src/lib/payment-methods.js`:

- `LEGACY_TO_CANONICAL` — frozen map (`cash → CASH`, `card → EDC`,
  `qris → QRIS_STATIC`)
- `canonicalizePaymentMethod(code)` — JS-side normaliser
- `canonicalPaymentMethodSql(column)` — SQL `CASE LOWER(${column})`
  fragment for in-DB normalisation

Applied them in `dashboard.js` + `reports.js` GROUP BY/SELECT plus the
`appendPaymentFilter()` helper (canonicalising both the column AND
the param so a filter `cash` matches `CASH` rows). The MDR-lookup acc
in `/sales-by-payment-method` now seeds canonical buckets with their
legacy MDR config via the inverse of `LEGACY_TO_CANONICAL`, so an
`EDC` row inherits the `card` row's `fee_percent`.

**Verification**. 8-case integration test
(`apps/backend/src/__tests__/dashboard-payment-methods-canonicalization.test.mjs`)
seeds a deliberate legacy + canonical mix per logical method and
asserts the post-fix row shape on all three endpoints + the filter
contract on both casings. 15 unit tests in
`apps/backend/src/lib/payment-methods.test.mjs` pin the new exports
(map content, JS-side normalisation, SQL fragment shape, idempotence).

**Rollback recipe** (yellow risk per protocol §1). Revert PR #240
on `main`; the public API shape pre-#240 is restored — endpoints will
again return one row per casing. No DB schema or row contents touched
by this PR; revert is safe and fast.

## Smoke test infrastructure

PR #238 ships `apps/backend/src/lib/payment-methods.test.mjs` (8 new
defensive cases) covering:

- The two source arrays + the union set are `Object.frozen` (push throws)
- `KNOWN_PAYMENT_METHOD_CODES` membership is exhaustive vs. the
  union of the two source arrays
- `listKnownPaymentMethodCodes()` iteration order matches
  `[...legacy, ...canonical]` exactly (an Android `PaymentMethod.kt`
  enum reorder would fail this loud)

PR #239 ships `apps/web/src/__tests__/CashierPage.test.jsx` (1 case

- axios mock plumbing). Mounts CashierPage under MemoryRouter,
  populates a cart of two products at price/quantity that hit `cash`
- `qris` paths, and asserts the captured `payments-mockable`
  adapter saw `payment_method: 'CASH'` and `payment_method:
'QRIS_STATIC'` respectively (NOT the lowercase keys used in the
  React state). This pairs with the existing 28-case
  `paymentMethod.test.js` unit suite that covers `toWireCode()` /
  `formatPaymentMethodLabel()` in isolation.

PR #240 ships `apps/backend/src/__tests__/dashboard-payment-methods-canonicalization.test.mjs`
(8 cases, 879ms) plus 15 unit cases in the lib test. Together they
codify the canonicalisation contract across SQL + JS + filter +
MDR-lookup paths.

## Production state per close

Source of truth: this session's work + the predecessor handoff for
infra unchanged.

| Component                           | State at loop-3 close                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` HEAD                         | `2d44e70bdd17d903501276b9e39ce337ff6c5b83` (PR #240 squash-merge)                                                                                                                                         |
| VPS git HEAD                        | `2d44e70` matches main (auto-deploy via `deploy-vps.yml`)                                                                                                                                                 |
| `deploy-vps.yml`                    | All three merges auto-deployed; runs landed cleanly                                                                                                                                                       |
| Backend `payment_method` allow-list | **Live** — both legacy lowercase (`cash`/`card`/`qris`) and 15 canonical Android codes accepted. 27 + 23 + 8 cases now guarding regression                                                                |
| Web kasir wire format               | **Live** — `cash` → `CASH`, `card` → `EDC`, `qris` → `QRIS_STATIC` via `toWireCode()`. CashierPage integration test now pins this contract                                                                |
| Dashboard / reports aggregation     | **Live, fixed** — `GROUP BY payment_method` canonicalised; legacy + canonical pairs roll up into a single row per logical method. Filter accepts both casings. MDR enrichment works for canonical buckets |
| Backend pm2                         | `vipos-backend` online (23m uptime at close, 103.4mb RSS); `vipos-worker` online (55.2mb)                                                                                                                 |
| Backend health                      | `db.ok=true latency=46ms`, `redis.ok=true latency=5ms`                                                                                                                                                    |
| Android client                      | **Unchanged** — PR #233 cart-aware decorator still shipped unwired                                                                                                                                        |
| Credentials rotation                | **Unchanged** since predecessor handoff                                                                                                                                                                   |

## Critical infrastructure context (delta vs. predecessor)

- **Secret persistence pothole same as predecessor.** This session
  opened with `GIT_PAT` and `VPS_SSH_PASSWORD` populated (40 / 6 chars
  respectively), but the persistence is still flaky in the broader
  pattern documented across loops #1 + #2. Keep the LANGKAH 0
  `echo "${#GIT_PAT} ${#VPS_SSH_PASSWORD}"` check at session open.
- **`sshpass` is NOT pre-installed on Devin VMs** — observed in this
  session. Had to `sudo apt-get install -y sshpass` before SSHing to
  the VPS. Add to org-scope environment config initialize step or
  expect a 2-second install at first VPS check.
- **Test-suite flake observed: invoice-number collision in
  `transactions-payment-method-allowlist.test.mjs > TC-2 > OTHER`.**
  `generateInvoiceNumber()` in `routes/transactions.js` uses
  `INV<yymmddhhmmss><rand 0..999>`. With ~17 inserts in the same
  second across TC-1 + TC-2, a `Math.random()*1000` collision → the
  unique constraint `(tenant_id, invoice_number)` on `transactions`
  fires → the route catch returns 500. Reproduced once in this
  session on PR #240 first run; second run via Actions
  rerun-failed-jobs API was clean. **No production code change yet
  for this** — left as a follow-up because (a) the fix is a 1-line
  generator change with risk yellow (touches the production POST
  path), and (b) the rerun-failed-jobs API is a known mitigation.
  Add a Tier-1 backlog entry below.

## Outstanding backlog (refreshed for next session)

### Tier 1 — no founder input needed

| Task                                                                                                       | Risk   | Est.  | Notes                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wire `CartAwarePaymentMethodCatalog` ke `PosModule` lewat `CartContext` provider                           | yellow | 0.5d  | Android-only. Decorator shipped unwired in #233; needs Hilt @Provides binding + a CartContext that publishes the live cart total to the catalog.             |
| Backend `/api/v1/payment/qris` mint endpoint                                                               | yellow | 1d    | Prereq for P3-08 slice 5. Spec lives in P3 docs. Risk yellow due to potential payment-provider integration touchpoints.                                      |
| Backend `/api/v1/payment/qris/:ref_id/status` poll endpoint                                                | yellow | 1d    | Pairs with mint above; needed for kasir flow QRIS dynamic settlement.                                                                                        |
| **P3-08 slice 5** — wire kasir flow + transaction commit + QRIS poll loop                                  | yellow | 1–2d  | Big task. Depends on the two QRIS endpoints above and the CartAwarePaymentMethodCatalog wiring. Risk yellow due to user-facing finalization in the kasir.    |
| Harden `generateInvoiceNumber()` against collision (extend rand to 6 digits or append a monotonic counter) | yellow | 0.5d  | New this loop. Documented flake in `transactions-payment-method-allowlist.test.mjs > TC-2 > "OTHER"`. CI mitigated via rerun, prod risk negligible but real. |
| Migrate pre-#236 lowercase `transactions.payment_method` rows to canonical (one-shot UPDATE)               | yellow | 0.25d | Optional — Loop #3 already canonicalises at read time, so this is purely cosmetic for direct DB inspection. Schema-safe (no constraint change).              |

### Tier 2 — blocked on founder input

| Task                                              | Why blocked                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| HTTPS domain pick (still pending from morning)    | Needs founder to commit on a domain (subdomain.alviarts.id vs. dedicated). Cert / DNS provisioning blocked. |
| Sidebar role visibility for non-admin tenants     | Pre-existing Tier-2 carry. Needs product decision on which menus a `kasir` role sees vs. admin.             |
| Receipt branding update for new outlet onboarding | Pre-existing Tier-2 carry. Needs founder to provide the new outlet logo + tagline copy.                     |

## Files modified this session

```
 apps/backend/src/lib/payment-methods.js                                              |  43 ++++ (edit, +exports)
 apps/backend/src/lib/payment-methods.test.mjs                                        | 100 +++++++ (edit, +15 cases for canonicalization + 8 cases for defensive)
 apps/backend/src/routes/dashboard.js                                                 |  13 +- (edit, canonicalised /payment-methods GROUP BY)
 apps/backend/src/routes/reports.js                                                   |  44 ++- (edit, canonicalised 3 sites + filter + MDR lookup)
 apps/backend/src/__tests__/dashboard-payment-methods-canonicalization.test.mjs       | 325 ++++++++++++ (new, 8 cases)
 apps/web/src/__tests__/CashierPage.test.jsx                                          | 200 ++++++++ (new, 1 integration case + axios mock)
 docs/handoff/2026-05-07-tier1-loop-3-dashboard-canonicalization.md                   |  XXX ++++ (this file, lands via PR)
```

## Operational notes for next session

1. **Re-request `GIT_PAT` and `VPS_SSH_PASSWORD` immediately** if `echo
"${#GIT_PAT} ${#VPS_SSH_PASSWORD}"` shows zeros. Pothole still
   active across all 3 loops today.
2. **Add `sshpass` install to env config initialize step** (org-scope)
   — `sudo apt-get install -y sshpass`. Currently a 2-second hit at
   first VPS interaction in every fresh VM.
3. **`apps/backend/src/lib/payment-methods.js` is the canonical source.**
   Any change to the enum requires editing 4 sites (Android enum,
   backend lib, integration test EXPECTED_ALLOWED, web utils labels).
   The integration test fails loud until aligned — that's the contract.
4. **Aggregation now canonicalises at read time.** When debugging
   `/api/dashboard/payment-methods` or
   `/api/reports/sales-by-payment-method` results, expect canonical
   uppercase keys on the wire even if the underlying row casing is
   lowercase. The SQL CASE wrapper is in `lib/payment-methods.js#canonicalPaymentMethodSql`.
5. **CI flake mitigation: use the GitHub Actions
   `rerun-failed-jobs` REST endpoint** when the
   `transactions-payment-method-allowlist.test.mjs > TC-2 > "OTHER"`
   test fails sporadically (invoice-number collision):
   ```bash
   curl -sS -X POST -H "Authorization: Bearer ${GIT_PAT}" \
     -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/alviarts/VIPOS/actions/runs/<run_id>/rerun-failed-jobs"
   ```
   The proper fix (extend rand to 6 digits) is in the Tier-1 backlog
   above.
6. **CashierPage integration test pattern is reusable.** Mounts
   under `MemoryRouter`, vi-mocks `../api/axios`, asserts the
   captured `axios.post(/transactions, body)` body shape. Apply the
   same pattern to e.g. a future `RefundPage.jsx` if/when it ships.
