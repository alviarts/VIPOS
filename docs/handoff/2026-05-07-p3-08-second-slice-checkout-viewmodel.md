# Handoff — 2026-05-07: P3-08 second slice (CheckoutViewModel + UiState picker state-machine)

> **Closed**: 2026-05-07 ~14:30 UTC.
> **Devin session**: <https://app.devin.ai/sessions/d68f67bb2c8140f7812a7b2cecf80fd4>
> **Mode**: Continuous-automation (`docs/v3/workflow/devin_continuous_automation.md`) — auto-merge ON for risk ≤ yellow.

## TL;DR

Shipped the second slice of P3-08: `CheckoutViewModel` +
`CheckoutUiState` + the deterministic `Idle → Picking → Picked`
picker lifecycle on top of slice 1's `PaymentMethodCatalog`
domain seam. **PR #224** went green on first try across all 4 CI
jobs (no bounces — same outcome as slice 1; the slice ships zero
callers + zero shared test helpers, so the K2 redeclaration /
OptIn-propagation class of errors can't fire). 16 unit tests
landed in `CheckoutViewModelTest` covering every state
transition + the snapshot-stability contract.

`main` HEAD: `eb0841c` (PR #224 squash-merge).

## PRs merged this rotation

| PR   | Branch                                             | Subject                                                                      | Status |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| #224 | `devin/1778163840-p3-08-slice2-checkout-viewmodel` | feat(P3-08): second slice — CheckoutViewModel + UiState picker state-machine | merged |

Created via REST API. Squash-merged via REST API after CI
green. Single commit on the branch — clean.

## What slice 2 actually shipped

```
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/
  CheckoutUiState.kt           (NEW, 96 lines)
  CheckoutViewModel.kt         (NEW, 175 lines)
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/di/
  PosModule.kt                 (MODIFIED, +18 / -3 — single new @Provides)
apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/ui/
  CheckoutViewModelTest.kt     (NEW, 261 lines, 16 cases)
```

### `CheckoutUiState`

Four orthogonal axes:

- `cartSubtotalIdr: Long` — total to settle, snapshotted at
  `start` from `PosCatalogueUiState.cartSubtotalIdr`.
- `availableMethods: List<PaymentMethod>` — slice-1 catalogue
  projection at `start` time. **Stable for the lifetime of the
  open picker** — a flaky network can't yank a method out from
  under the kasir mid-pick.
- `pickerStatus: CheckoutPickerStatus` — sealed
  `Idle / Picking / Picked` lifecycle. `Picking ↔ Picked`
  reversible via `confirmSelection` / `reopenPicker`.
- `selectedMethod: PaymentMethod?` — currently-picked, or `null`.

Two derived predicates:

- `isReadyToCommit` — `Picking` + `selectedMethod != null` +
  `cartSubtotalIdr > 0`. **Means "ready to advance to method-
  specific input step"**, not "ready to fire transaction
  commit". Slice 3 layers the actual commit-ready predicate on
  top of method-specific input state.
- `isPickerOpen` — `pickerStatus is Picking`.

### `CheckoutViewModel`

`@HiltViewModel` consuming an injected `PaymentMethodCatalog`.

Surface (6 methods):

- `start(cartSubtotalIdr, isOnline)` — open picker for fresh
  cart. Snapshots subtotal + catalogue. Treats re-call as
  "void cart, restart" (clears prior pick, re-opens picker
  with fresh subtotal + re-snapshotted catalogue).
- `selectMethod(method)` — replace pick in place. Defensive
  no-op when picker closed or method outside `availableMethods`.
- `clearSelection()` — return to no-pick without leaving picker.
- `confirmSelection()` — `Picking → Picked`. No-op iff not
  `isReadyToCommit`.
- `reopenPicker()` — `Picked → Picking` preserving prior pick.
  No-op when not `Picked`.
- `cancel()` — reset to fresh `Idle` (kasir dismisses checkout).

### `PosModule` Hilt binding

Added `providePaymentMethodCatalog(): PaymentMethodCatalog =
DefaultPaymentMethodCatalog` as a `@Singleton` `@Provides`.
Future slices swap the binding for a cart-aware decorator
(filters credit/deposit/loyalty on cart-state predicates)
without touching `CheckoutViewModel`.

### 16 unit tests

- `initial state is Idle with empty cart and no methods`
- `start opens picker and snapshots subtotal plus methods`
- `start offline filters online-required methods`
- `selectMethod sets selectedMethod when picker is open`
- `selectMethod replaces previous pick in place`
- `selectMethod is no-op before start`
- `selectMethod is no-op for method outside availableMethods`
- `clearSelection returns to no-pick`
- `confirmSelection advances to Picked when ready`
- `confirmSelection is no-op when nothing picked`
- `confirmSelection is no-op when subtotal is zero`
- `reopenPicker restores Picking and keeps selection`
- `reopenPicker is no-op when not Picked`
- `cancel resets to fresh Idle`
- `start re-opens with fresh subtotal and clears prior pick`
- `catalogue snapshot is stable across the picker open lifetime` (counting fake)
- `fake catalogue plumbs through to availableMethods` (subset filter)

## P3-08 slicing plan — status update

| Slice | Scope                                                                                                                                    | Risk   | Status                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| 1     | Data layer: `PaymentMethod` enum + `PaymentMethodCatalog` interface + default impl                                                       | green  | DONE — PR #222                     |
| 2     | **ViewModel + UiState picker state-machine**                                                                                             | yellow | **DONE — PR #224 (this rotation)** |
| 3     | Method-specific input state: cash tendered + change math, EDC ref-no, QRIS Dynamic poll loop, split-bill row state                       | yellow | next                               |
| 4     | Stateless Compose UI: `PaymentMethodGrid`, `CashPaymentDialog`, `EDCPaymentDialog`, `QRISPaymentDialog`, `SplitBillScreen` + `@Preview`s | yellow | pending                            |
| 5     | Wire to kasir flow: `PosScreen` "Bayar" button → opens checkout, on settle → triggers transaction commit                                 | yellow | pending                            |

P3-08 progress: 2 of 5 slices shipped.

## Production state per close

### VPS

**Not touched this session**. PR #224 is path-filtered to
`apps/android/**`.

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
4. **`android.yml` + `deploy-vps.yml` clean of `head -N` / SIGPIPE pattern**.
5. **`update_environment_config` suggestion approved** — future Devin VMs land with `node_modules/` cached.
6. **Devin VM has no Android SDK** — every Kotlin compile error first-detected in CI. Cheap mitigations: small diffs, OptIn propagation through default args, no duplicate top-level `private class` across test files in the same package (KT-15514). **Slice 2 had zero CI bounces** because the slice ships zero callers + zero shared test helpers; expect the same green-on-first-try outcome for any slice that adds purely additive types in a feature module without consumers.

## Outstanding backlog

### Tier 1 (no founder input needed)

| Task                                                                        | Estimate | Risk   | Notes                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P3-08 slice 3 — method-specific input state**                             | 1–2 d    | yellow | Next-up. Cash tendered + change math, EDC ref-no, QRIS Dynamic poll loop, split-bill row state. Likely a new `CheckoutInputState` sealed-class hierarchy hung off `CheckoutUiState` keyed by `selectedMethod`.                |
| P3-08 slice 4 — stateless Compose UI                                        | 1–2 d    | yellow | `PaymentMethodGrid`, three method dialogs, `SplitBillScreen` + `@Preview`s.                                                                                                                                                   |
| P3-08 slice 5 — wire to kasir flow                                          | 0.5–1 d  | yellow | `PosScreen` "Bayar" button → opens checkout, on settle → triggers transaction commit.                                                                                                                                         |
| Backend tighten `transactions.payment_method` to enum allow-list            | 0.5 d    | yellow | Separate backend PR after slice 5 lands.                                                                                                                                                                                      |
| Cart-aware filter decorator for `PaymentMethodCatalog`                      | 0.5–1 d  | green  | Plug in at the `PosModule` `@Provides` site. Filters credit (non-walk-in customer required), deposit (balance > 0), loyalty (points ≥ threshold). Doesn't block slice 3+ since the catalogue indirection is already in place. |
| Per-merchant allow-list filter                                              | tbd      | yellow | Blocked on a backend org-config column or settings endpoint that doesn't exist yet. Tier 2 promotion candidate if the backend work is non-trivial.                                                                            |
| Skip-sheet-for-no-variant-products optimization                             | 1–2 d    | yellow | Carry-over.                                                                                                                                                                                                                   |
| Sweep older handoff docs for stale `GITHUB_PAT_VIPOS` / `VPS_PASSWORD` refs | 0.5–1 h  | green  | Carry-over.                                                                                                                                                                                                                   |

### Tier 1.5 — `phase_3_android_kasir_mvp.md` line items

P3-07 is **CLOSED**. P3-08 is **IN PROGRESS** (2 of 5 slices
shipped). Other workflow-doc items unchanged.

### Tier 2 (blocked on founder input)

| Task   | Need                                                              |
| ------ | ----------------------------------------------------------------- |
| P3-01f | Firebase project + `google-services.json` to enable Crashlytics.  |
| P3-07b | Upload keystore (`.jks`) for the staging + prod release variants. |

## Files modified this session (cumulative across both rotations of the day)

P3-07 fifth slice (#220) + handoff (#221) — already documented
in `2026-05-07-p3-07-fifth-slice-wired.md`.

P3-08 first slice (#222) + handoff (#223) — already documented
in `2026-05-07-p3-08-first-slice-payment-method-domain.md`.

P3-08 second slice (this handoff):

```
PR #224 (P3-08 second slice — CheckoutViewModel + UiState) — 4 files, +556 / -6
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/CheckoutUiState.kt
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/CheckoutViewModel.kt
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/di/PosModule.kt
  apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/ui/CheckoutViewModelTest.kt
```

This handoff doc adds:

```
docs/handoff/2026-05-07-p3-08-second-slice-checkout-viewmodel.md
```

## Smoke test infrastructure

No new browser-driven smoke tests added or run this rotation.
The new ViewModel surface is unit-tested
(`CheckoutViewModelTest`, 16 cases). UI smoke tests will land
with slice 4 (Compose UI).

## Operational notes for next session

1. **Slice 3 next** — method-specific input state. Likely
   shape: `sealed interface CheckoutInputState` with one
   `data class` per method (`CashInput(tenderedIdr, …)`,
   `EdcInput(approvalRef, last4)`, `QrisDynamicInput(refId,
pollStatus)`, `SplitInput(rows: List<SplitRow>)`). Hung off
   `CheckoutUiState` as a `Map<PaymentMethod, CheckoutInputState>`
   so the kasir's tendered amount survives a method-pivot back
   and forth (or just keep the input state as a `CheckoutInputState?`
   that resets on every `selectMethod` — TBD per UX call). The
   slice should add a `commitReadyPredicate` that gates on the
   method-specific input being valid (tendered ≥ subtotal,
   QRIS poll = PAID, etc.) — supersedes the slice-2
   `isReadyToCommit` for the actual commit gate.

2. **`PaymentMethodCatalog` is a single-method `fun interface`** —
   the slice-1 binding is `DefaultPaymentMethodCatalog`. To
   layer cart-aware filters (credit/deposit/loyalty), wrap the
   default in a decorator that takes the cart state and
   filters at `availableMethods` time. Plug in at the
   `PosModule.providePaymentMethodCatalog` site without
   touching `CheckoutViewModel` — that's the indirection's
   payoff.

3. **Snapshot-stability contract is asserted by the
   `catalogue snapshot is stable across the picker open lifetime`
   test** — uses a counting fake to confirm the catalogue is
   queried exactly once per `start`. If a future change moves
   the catalogue query from `start` to per-mutation, this test
   must be updated deliberately (the kasir-flow UX assumption
   is "the picker doesn't change methods on you mid-tap"). Don't
   silently update the test — write a follow-up note.

4. **Hilt binding additive — no breaking change** — slice 2's
   `PosModule` change adds a new `@Provides`. Existing
   `providePosApi` is untouched. No call site for
   `hiltViewModel<CheckoutViewModel>()` exists yet, so the
   binding is unreferenced until slice 5; revert is safe.

5. **Slice 2 had zero CI bounces** — same as slice 1. Pattern:
   slices that ship purely additive types in a feature module
   without consumers don't trigger the K2 redeclaration /
   OptIn-propagation errors. Slices 4 (Compose UI) and 5 (wire)
   are likely to bounce again.

6. **No smoke testing this rotation** — ViewModel surface only,
   nothing to click. Slice 4 will be the first slice with a UI
   surface to preview.
