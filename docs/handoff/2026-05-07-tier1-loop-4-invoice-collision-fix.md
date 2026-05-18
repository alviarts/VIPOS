# Handoff — VIPOS continuous-automation Tier-1 loop #4 (invoice-number collision fix)

> **Closed**: 2026-05-07 ~18:16 UTC
> **Devin session**: https://app.devin.ai/sessions/e52f931332514c11b0a55ce03629b4f9
> **Mode**: continuous-automation (per `docs/v3/workflow/devin_continuous_automation.md`)
> **Predecessor handoff**: [`docs/handoff/2026-05-07-tier1-loop-3-dashboard-canonicalization.md`](2026-05-07-tier1-loop-3-dashboard-canonicalization.md)

## TL;DR

Loop #4 closed: **1 follow-up PR merged** addressing the
invoice-number collision flake documented in the predecessor's
operational notes. PR #242 hardens `generateInvoiceNumber()` in
`apps/backend/src/routes/transactions.js` with a per-second
monotonic counter (3 digits) plus a 6-digit random tail (was 3),
eliminating same-process intra-second collisions entirely and
dropping cross-process intra-second collisions from ~13% per 17-burst
to <0.001%. CI 3/3 green; auto-deployed via `deploy-vps.yml` to
`c323450` on the VPS. Backend pm2 healthy (db 40ms, redis 4ms).

This same Devin session also closed loops #3a / #3b / #3c earlier
in the day (see predecessor handoff for PRs #238, #239, #240, #241).
Total session count: **5 PRs merged + 1 handoff merged + 1 fresh
handoff (this file)** in one continuous-automation run.

## PRs merged this session (delta vs. predecessor)

| PR                                                 | Branch                                             | Subject                                                                                    | Risk   | CI  |
| -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ | --- |
| [#242](https://github.com/alviarts/VIPOS/pull/242) | `devin/1778177270-harden-invoice-number-collision` | fix(backend): harden generateInvoiceNumber() against (tenant_id, invoice_number) collision | yellow | 3/3 |

Squash-merged into `main`; branch deleted on merge per repo default.
`deploy-vps.yml` auto-deployed at `c323450`.

## Root cause analysis — PR #242

**Symptom**. CI run on PR #240 first attempt failed at
`apps/backend/src/__tests__/transactions-payment-method-allowlist.test.mjs > TC-2 > "OTHER"`
with `expected 500 to be 201`. The first 14/15 codes in TC-2 passed;
"OTHER" (the last in the for-of loop) hit a 500 from the route. Re-running
the failed jobs via the Actions REST API was clean — flake fingerprint.

**Root cause**. `generateInvoiceNumber()` minted invoice numbers as
`INV<yymmddhhmmss><Math.random()*1000 padded to 3 digits>`. With ~17
invoices minted in TC-1 + TC-2 of the allow-list test in the same
wall-clock second (vitest singleFork), birthday-collision probability
on 1000 buckets is `1 - exp(-17*16/(2*1000)) ≈ 12.7%` per CI run.
When two invoices in the same tenant within the same second drew the
same random tail, the `(tenant_id, invoice_number)` UNIQUE INDEX
(introduced by `prisma/migrations/20260505400000_per_tenant_unique_indexes`)
fired, the route catch returned 500 with the Postgres error message,
and the test failed.

**Fix**.

- Added a per-second monotonic counter (3 digits, padded) that
  increments on every call within the same wall-clock second. Resets
  to 0 when the second rolls over (the `_lastSecondKey` module-level
  state is updated in lockstep so consecutive calls in different
  seconds always start counter=0).
- Bumped the random tail from 3 digits to 6 digits.

Combined effect:

- Same-process / same-second: counter guarantees uniqueness —
  collisions impossible.
- Cross-process / same-second (e.g. clustered backend, none currently
  but future-proofing): 6-digit rand drops the collision rate from
  ~13% per 17-burst to <0.001%.
- Cross-second: yymmddhhmmss already uniquifies.

Format changed from `INV<12 digits>` (15 chars total) to `INV<21 digits>`
(24 chars total). No downstream consumer parses the format — verified
by grepping all `invoice_number` usages: every UI / report / Android
path treats it as opaque `font-mono` text.

**Verification**. Added
`apps/backend/src/__tests__/generate-invoice-number.test.mjs` (5 cases,
~1.1s):

- Format pin: regex `/^INV\d{21}$/`
- 1000-call burst inside a single test: all unique
- Two back-to-back calls: distinct
- Counter reset on second-boundary cross (1.05s sleep + assertion that
  counter portion is `'000'` after the boundary)
- 6-digit rand diversity sanity check (≥95/100 unique tails)

All 5 pass; 0 lint / prettier issues.

**Rollback recipe** (yellow risk per protocol §1). Revert PR #242
on `main`; the previous generator returns. Existing rows continue to
work. The transactions table schema is untouched, so no DB rollback
is needed. The bug-flake comes back as well — that's the trade-off.

## Smoke test infrastructure

PR #242 ships `apps/backend/src/__tests__/generate-invoice-number.test.mjs`
(5 unit cases, 1.1s) on top of the existing
`transactions-payment-method-allowlist.test.mjs` integration suite
(27 cases) which exercises the same code path through HTTP. Together
they protect against both the rand-collision regression specifically
AND any future refactor that drops the per-second counter.

The unit suite imports `generateInvoiceNumber` via a side-export added
to `routes/transactions.js`:

```js
module.exports = router;
module.exports.generateInvoiceNumber = generateInvoiceNumber;
```

This is the codebase's first instance of side-exporting an internal
helper from a route file. The pattern is fine — it doesn't shape-break
the default `require` (the `router` object is still the primary
export, the side-property is for tests only) and the comment above
the export spells out the contract.

## Production state per close

| Component                       | State at loop-4 close                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `main` HEAD                     | `c323450616f0e6a2b0adc00f862c3cbb973ceeab` (PR #242 squash-merge)                                                                    |
| VPS git HEAD                    | `c323450` matches main (auto-deploy via `deploy-vps.yml`)                                                                            |
| Backend pm2                     | `vipos-backend` online (5m uptime at close — fresh restart from auto-deploy, 100mb RSS); `vipos-worker` online (55.6mb)              |
| Backend health                  | `db.ok=true latency=40ms`, `redis.ok=true latency=4ms`                                                                               |
| Invoice-number generator        | **Live, hardened** — 21-digit suffix (yymmddhhmmss + counter + rand). 5-case unit suite + 27-case integration suite gate regressions |
| Web kasir wire format           | **Unchanged from loop #3 close** — `cash` → `CASH`, `card` → `EDC`, `qris` → `QRIS_STATIC` via `toWireCode()`                        |
| Dashboard / reports aggregation | **Unchanged from loop #3 close** — canonicalised at read time via `canonicalPaymentMethodSql()`                                      |
| Android client                  | **Unchanged** — PR #233 cart-aware decorator still shipped unwired                                                                   |
| Credentials rotation            | **Unchanged** since loop #3 close                                                                                                    |

## Critical infrastructure context (delta vs. predecessor)

- **Environment config suggestion sent for `alviarts/VIPOS` repo.**
  Adds `sudo apt-get install -y sshpass` to `initialize` so future
  sessions don't waste 2 seconds on the first VPS interaction.
  Includes reference knowledge entries for lint/test/build commands
  - the secret-persistence pothole + the PAT-fallback push recipe.
    **Pending founder approval in the timeline** — until applied, future
    Devin sessions still need to install sshpass on demand.
- **CI flake mitigated, not just observed.** Loop #3 documented the
  `OTHER` test flake as an operational note + Tier-1 backlog entry;
  loop #4 fixed it. Future sessions will not need to rerun-failed-jobs
  for this case. Other CI flakes (network, DB pull) may still occur —
  the rerun-failed-jobs recipe in the predecessor handoff still
  applies.

## Outstanding backlog (refreshed for next session)

### Tier 1 — no founder input needed

| Task                                                                                         | Risk   | Est.  | Notes                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire `CartAwarePaymentMethodCatalog` ke `PosModule` lewat `CartContext` provider             | yellow | 0.5d  | Android-only. Decorator shipped unwired in #233; needs Hilt @Provides binding + a CartContext that publishes the live cart total to the catalog.          |
| Backend `/api/v1/payment/qris` mint endpoint                                                 | yellow | 1d    | Prereq for P3-08 slice 5. Spec lives in P3 docs. Risk yellow due to potential payment-provider integration touchpoints.                                   |
| Backend `/api/v1/payment/qris/:ref_id/status` poll endpoint                                  | yellow | 1d    | Pairs with mint above; needed for kasir flow QRIS dynamic settlement.                                                                                     |
| **P3-08 slice 5** — wire kasir flow + transaction commit + QRIS poll loop                    | yellow | 1–2d  | Big task. Depends on the two QRIS endpoints above and the CartAwarePaymentMethodCatalog wiring. Risk yellow due to user-facing finalization in the kasir. |
| Migrate pre-#236 lowercase `transactions.payment_method` rows to canonical (one-shot UPDATE) | yellow | 0.25d | Optional — Loop #3 already canonicalises at read time, so this is purely cosmetic for direct DB inspection. Schema-safe (no constraint change).           |

### Tier 2 — blocked on founder input

| Task                                              | Why blocked                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| HTTPS domain pick (still pending from morning)    | Needs founder to commit on a domain (subdomain.alviarts.id vs. dedicated). Cert / DNS provisioning blocked. |
| Sidebar role visibility for non-admin tenants     | Pre-existing Tier-2 carry. Needs product decision on which menus a `kasir` role sees vs. admin.             |
| Receipt branding update for new outlet onboarding | Pre-existing Tier-2 carry. Needs founder to provide the new outlet logo + tagline copy.                     |

## Files modified this session (loop #4 only)

```
 apps/backend/src/routes/transactions.js                          |  32 ++- (edit, +per-second counter, +6-digit rand, +side-export)
 apps/backend/src/__tests__/generate-invoice-number.test.mjs       |  87 +++ (new, 5 unit cases)
 docs/handoff/2026-05-07-tier1-loop-4-invoice-collision-fix.md     | XXX ++++ (this file, lands via PR)
```

For loops #3a / #3b / #3c file lists, see the predecessor handoff.

## Operational notes for next session

1. **Re-request `GIT_PAT` and `VPS_SSH_PASSWORD` immediately** if `echo
"${#GIT_PAT} ${#VPS_SSH_PASSWORD}"` shows zeros. Pothole still
   active across all 4 loops today (didn't fire in this session, but
   remains the canonical first-thing-check at LANGKAH 0).
2. **`sshpass` is in the pending env config.** If the founder has
   approved the `alviarts/VIPOS` repo env config suggestion in the
   timeline, fresh VMs will have sshpass pre-installed. Otherwise:
   `sudo apt-get install -y sshpass` (verified working this session).
3. **Invoice-number format is now 21 digits after `INV` prefix.** When
   debugging row dumps or building new tooling that processes invoice
   numbers, expect format `INV<yymmddhhmmss><000-padded counter><6-digit rand>`.
   The format is documented in the comment block above the
   `generateInvoiceNumber()` function in `routes/transactions.js`.
4. **`generateInvoiceNumber` is now side-exported from
   `routes/transactions.js`.** The export pattern (`module.exports.foo =
foo` after the default `module.exports = router`) is the codebase's
   first instance — pattern is fine, but if you find yourself adding a
   second testable helper to the same route file, consider extracting
   to `lib/invoice.js` instead to keep the route file lean.
5. **Module-level state caveat for tests.** The `_lastSecondKey` and
   `_withinSecondCounter` module-level variables in
   `routes/transactions.js` accumulate across the lifetime of the
   process. Tests that import `generateInvoiceNumber` directly will
   share state with any concurrent backend route invocations in the
   same vitest worker. This is fine in practice (vitest singleFork +
   our integration tests use HTTP, not the helper directly) but worth
   knowing if a future test pattern changes.
