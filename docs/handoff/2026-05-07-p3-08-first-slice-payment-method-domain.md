# Handoff — 2026-05-07: P3-08 first slice (payment-method enum + catalog domain)

> **Closed**: 2026-05-07 ~14:15 UTC.
> **Devin session**: <https://app.devin.ai/sessions/d68f67bb2c8140f7812a7b2cecf80fd4>
> **Mode**: Continuous-automation (`docs/v3/workflow/devin_continuous_automation.md`) — auto-merge ON for risk ≤ yellow.

## TL;DR

Started P3-08 (POS checkout payment-method picker, 6–7 d in
`phase_3_android_kasir_mvp.md`) by landing the first slice — the
data-layer foundation only. Same slicing pattern as P3-07: keep
each PR small enough to ship, test, and merge without
introducing a UI surface or behavior change. **PR #222** went
green on first try (no CI bounces this rotation — the slice
ships zero callers, so the K2 redeclaration / OptIn-propagation
class of errors that bit slice 5 last rotation can't fire here).

`main` HEAD: `1995c5e` (PR #222 squash-merge).

## PRs merged this session (P3-08 phase only — see prior handoff for P3-07 closure)

| PR   | Branch                                                | Subject                                                         | Status |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------- | ------ |
| #222 | `devin/1778163015-p3-08-slice1-payment-method-domain` | feat(P3-08): first slice — payment-method enum + catalog domain | merged |

Created via REST API (proxy 403 on `git_create_pr`, same posture
as the last four rotations). Squash-merged via REST API after CI
green. Single commit on the branch — clean.

CI matrix on the merge commit (4 checks): all green on the first
push. No iteration this rotation.

## P3-08 slicing plan (5 slices, mirroring P3-07)

For visibility — locked in before slice 1 went out so future
sessions don't have to re-derive the breakdown:

| Slice | Scope                                                                                                                                                                      | Risk   | Status                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| 1     | **Data layer**: `PaymentMethod` enum + `PaymentMethodCatalog` interface + default impl                                                                                     | green  | **DONE** — PR #222 (this rotation) |
| 2     | **ViewModel + UiState**: `CheckoutViewModel` + `CheckoutUiState`, picker state-machine, merchant allow-list filter, cart-aware filters (credit, deposit, loyalty)          | yellow | next                               |
| 3     | **Method-specific input state**: cash tendered + change math, EDC ref-no entry, QRIS Dynamic poll loop, split-bill row state                                               | yellow | pending                            |
| 4     | **Stateless Compose UI**: `PaymentMethodGrid`, `CashPaymentDialog`, `EDCPaymentDialog`, `QRISPaymentDialog`, `SplitBillScreen` + `@Preview`s                               | yellow | pending                            |
| 5     | **Wire to kasir flow**: `PosScreen` "Bayar" button → opens checkout, on settle → triggers transaction commit (existing `apps/backend/src/routes/transactions.js` endpoint) | yellow | pending                            |

(Subject to revision if slice 2 / 3 turn out to be too big to
land in one PR each; in that case sub-slice the same way the
prior P3-07 rotation evolved.)

## What slice 1 actually shipped

```
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/domain/
  PaymentMethod.kt           (NEW, 70 lines)
  PaymentMethodCatalog.kt    (NEW, 75 lines)

apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/domain/
  PaymentMethodCatalogTest.kt (NEW, 128 lines, 10 cases)
```

### `PaymentMethod` enum

15 entries aligned 1:1 with `docs/v2/14_PAYMENT_METHODS.md` §1:

- `CASH` / `EDC` / `QRIS_STATIC` / `QRIS_DYNAMIC`
- `GOPAY` / `OVO` / `DANA` / `SHOPEEPAY` / `LINKAJA`
- `BANK_TRANSFER` / `CREDIT` / `DEPOSIT` / `VOUCHER` / `LOYALTY_POINT`
- `OTHER`

Each entry carries:

- `code: String` — the literal stored on the backend's
  `transactions.payment_method` column. Matches the v2 spec
  literals verbatim (regression-tested in
  `code matches the v2-14 catalog literal`).
- `displayLabel: String` — Indonesian picker label. Asserted
  non-blank for every entry.
- `requiresOnline: Boolean` — gate for the offline fallback.
  Cash / EDC manual / QRIS Statis / Bank transfer / Credit /
  Deposit / Voucher / Loyalty / Other = `false`. QRIS Dynamic
  - e-wallets = `true`.

`PaymentMethod.fromCode(code)` returns `null` (not throws) on
unknown codes so wire-deserialise paths stay tolerant to
backend rows from older schemas.

### `PaymentMethodCatalog`

`fun interface` with a single
`availableMethods(isOnline: Boolean): List<PaymentMethod>`. The
seam where global enum membership is filtered down to "what's
pickable for the current request". Layered filters (merchant
allow-list, cart-aware credit/deposit/loyalty) come in slice 2.

`DefaultPaymentMethodCatalog` is the no-merchant-allow-list /
no-cart variant: every entry online, online-required entries
filtered offline. Order is the canonical kasir-flow priority
encoded as the enum declaration order — re-ordering the enum
re-orders the picker (test `online catalogue order matches enum
declaration order` asserts this contract).

### 10 unit tests

- `fromCode round-trips every enum entry`
- `fromCode returns null for unknown code`
- `available methods online includes every entry`
- `available methods offline filters online-required`
- `cash is always available even when offline`
- `qris dynamic and e-wallets are filtered offline`
- `qris statis stays available offline`
- `online catalogue order matches enum declaration order`
- `every method has a non-blank display label`
- `code matches the v2-14 catalog literal`

## Production state per close

### VPS

**Not touched this session**. PR #222 is path-filtered to
`apps/android/**`, so `tools/scripts/deploy.sh` was not invoked,
no `workflow_dispatch` was triggered, no SSH session was opened.

### Sentry

**Not touched this session**.

### Credentials state

| Component          | State                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GIT_PAT`          | Org-scope secret. Persisted from prior rotation. Functional this session — used for all push + REST flows. |
| `VPS_SSH_PASSWORD` | Org-scope secret per protocol §3. Not requested this session.                                              |
| Postgres / Redis   | Not touched this session.                                                                                  |
| Sentry build env   | Not touched this session.                                                                                  |

## Critical infrastructure context (active workarounds)

No new workarounds this rotation. All standing items remain:

1. **Devin org-scope secrets carry over correctly** — `list_secrets` non-empty at session start.
2. **Proxy 403 on `git push`** — PAT-fallback recipe still required.
3. **`git_create_pr`, `git_pr_checks`, `git_ci_job_logs` tools 403** — all routed through GitHub REST API + `${GIT_PAT}`.
4. **`android.yml` + `deploy-vps.yml` clean of `head -N` / SIGPIPE pattern**, audited 2026-05-07 morning rotation.
5. **`update_environment_config` suggestion approved** — future Devin VMs land with `node_modules/` cached.
6. **Devin VM has no Android SDK** — every Kotlin compile error first-detected in CI. Cheap mitigations: small diffs, OptIn propagation through default args, no duplicate top-level `private class` across test files in the same package (KT-15514).

## Outstanding backlog

### Tier 1 (no founder input needed)

| Task                                                                               | Estimate | Risk   | Notes                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P3-08 slice 2 — `CheckoutViewModel` + `CheckoutUiState` + picker state-machine** | 1–2 d    | yellow | Next-up. Consumes `PaymentMethodCatalog` from slice 1. Adds merchant-allow-list filter + cart-aware filters (credit, deposit, loyalty).                                                    |
| P3-08 slice 3 — method-specific input state                                        | 1–2 d    | yellow | Cash tendered + change math, EDC ref-no, QRIS Dynamic poll loop, split-bill row state.                                                                                                     |
| P3-08 slice 4 — stateless Compose UI                                               | 1–2 d    | yellow | `PaymentMethodGrid`, three method dialogs, `SplitBillScreen` + `@Preview`s.                                                                                                                |
| P3-08 slice 5 — wire to kasir flow                                                 | 0.5–1 d  | yellow | `PosScreen` "Bayar" button → opens checkout, on settle → triggers transaction commit.                                                                                                      |
| Backend tighten `transactions.payment_method` to enum allow-list                   | 0.5 d    | yellow | Separate backend PR after slice 5 lands. Currently `apps/backend/src/routes/transactions.js` accepts arbitrary string + defaults to `cash`. Tightening = enum check + 400 on unknown code. |
| Skip-sheet-for-no-variant-products optimization                                    | 1–2 d    | yellow | Carry-over. Backend payload addition (`has_variants`) + Android-side conditional sheet open.                                                                                               |
| Sweep older handoff docs for stale `GITHUB_PAT_VIPOS` / `VPS_PASSWORD` refs        | 0.5–1 h  | green  | Carry-over.                                                                                                                                                                                |

### Tier 1.5 — `phase_3_android_kasir_mvp.md` line items

P3-07 is **CLOSED**. P3-08 is **IN PROGRESS** (1 of 5 slices
shipped). Other workflow-doc items unchanged from prior handoff:

| Task   | Title                                                                                | Estimate (workflow doc) | Notes                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P3-07  | POS cart UI + modifier sheet                                                         | 4–5 d                   | **CLOSED** — five slices shipped end-to-end (#214 → #215 → #216 → #218 → #220). Cart now carries uplift + option labels per line. |
| P3-08  | POS checkout — payment method picker (cash/EDC/QRIS/e-wallet/deposit/voucher)        | 6–7 d                   | **IN PROGRESS** — slice 1 of 5 shipped (#222). Slice 2 next-up.                                                                   |
| P3-09  | Outbox pattern + WorkManager sync                                                    | 3–4 d                   | Real `phase_3` P3-09; the handoff "P3-09" we shipped earlier was a CI guard, separate concern.                                    |
| P3-10  | Bluetooth thermal printer integration                                                | 4–5 d                   | Real `phase_3` P3-10; the handoff "P3-10" we shipped was unit tests, separate concern. Needs runtime BLE permissions matrix.      |
| P3-11+ | Barcode scanner / EDC ECR / receipt rendering / open-shift / promos / customer / etc | varies                  | All sequential dependencies on P3-08/09 landing first.                                                                            |

### Tier 2 (blocked on founder input)

| Task   | Need                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-01f | Firebase project + `google-services.json` to enable Crashlytics. Founder must create the Firebase project under `id.alviarts.vipos` (and `.dev` + `.staging` siblings) and upload JSONs. |
| P3-07b | Upload keystore (`.jks`) for the staging + prod release variants. Founder must generate via `keytool` and store the password as `VIPOS_ANDROID_UPLOAD_KEYSTORE_PASSWORD` org-secret.     |

## Files modified this session (P3-08 phase)

```
PR #222 (P3-08 first slice — payment-method enum + catalog domain) — 3 files, +273 / -0
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/domain/PaymentMethod.kt
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/domain/PaymentMethodCatalog.kt
  apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/domain/PaymentMethodCatalogTest.kt
```

This handoff doc adds:

```
docs/handoff/2026-05-07-p3-08-first-slice-payment-method-domain.md
```

## Smoke test infrastructure

No new browser-driven smoke tests added or run this session. The
new domain types are unit-tested
(`PaymentMethodCatalogTest`, 10 cases). UI smoke tests will land
with slice 4 (Compose UI) — `androidx.compose.ui.test` is still
not in the version catalogue and is a separate green-risk
follow-up worth its own PR.

## Operational notes for next session

1. **Slice 2 next** — `CheckoutViewModel` + `CheckoutUiState`. Consume `PaymentMethodCatalog`. Layer merchant allow-list filter (later — slice 2 likely just plumbs the catalogue through; the merchant filter probably needs a backend column or org-config that doesn't exist yet, so it'll be a TODO comment + a green-risk follow-up). Also layer cart-aware filters (credit needs non-walk-in customer, deposit needs balance>0, loyalty needs points≥threshold). Pattern: mirror `PosVariantViewModel` — `StateFlow<CheckoutUiState>`, `select(method)` reducer, derived `selectedMethod` / `isReadyToCommit` flags.

2. **`PaymentMethod.entries.toList()` is the canonical picker order** — re-ordering the enum re-orders the picker. Documented + asserted in `online catalogue order matches enum declaration order` test. If a future tweak wants a different order without touching the enum, add an explicit `displayOrder: Int` field rather than building a separate ordering map.

3. **Backend allow-list tightening is Tier-1 follow-up after slice 5** — `apps/backend/src/routes/transactions.js` accepts an arbitrary string today. The Android enum is the stricter contract. Tightening backend = enum check + 400 on unknown code. Worth doing, but doesn't block P3-08 slice 2–5 since the `code` literals match the spec already.

4. **No CI bounces on slice 1** — first push went green on all 4 jobs. The K2 redeclaration / OptIn-propagation class of errors that bit slice 5 last rotation can't fire on a slice that adds zero callers + zero new test helpers shared with existing test files. Future slices will likely bounce CI again — keep a steady cadence of small diffs.

5. **No smoke testing this rotation** — domain types only, nothing to click. Slice 4 will be the first slice with a UI surface to preview; expect smoke testing to resume there.
