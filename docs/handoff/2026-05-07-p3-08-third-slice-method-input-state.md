# Handoff — 2026-05-07: P3-08 third slice (method-specific input state)

> **Closed**: 2026-05-07 ~14:50 UTC.
> **Devin session**: <https://app.devin.ai/sessions/d68f67bb2c8140f7812a7b2cecf80fd4>
> **Mode**: Continuous-automation (`docs/v3/workflow/devin_continuous_automation.md`) — auto-merge ON for risk ≤ yellow.

## TL;DR

Shipped the third slice of P3-08: method-specific input state
on top of the slice-2 picker state-machine. `confirmSelection`
now seeds `CheckoutUiState.inputState` with a fresh per-method
default for cash / EDC / QRIS Dynamic; methods that don't need
a per-method input (QRIS Statis, bank transfer, credit,
deposit, voucher, loyalty, other) advance to `Picked` with
`inputState = null` and the slice-4 UI surfaces a
single-tap-settle dialog for those. **PR #226** went green on
first try across all 4 CI jobs (no bounces — same outcome as
slices 1 + 2; the slice ships zero callers + zero shared test
helpers, so the K2 redeclaration / OptIn-propagation class of
errors can't fire).

`main` HEAD: `527fc49` (PR #226 squash-merge).

## PRs merged this rotation

| PR   | Branch                                             | Subject                                                                            | Status |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| #226 | `devin/1778164808-p3-08-slice3-method-input-state` | feat(P3-08): third slice — method-specific input state (cash / EDC / QRIS Dynamic) | merged |

Created via REST API. Squash-merged via REST API after CI
green. Single commit on the branch — clean.

## What slice 3 actually shipped

```
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/domain/
  CheckoutInputState.kt        (NEW, 169 lines)
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/
  CheckoutUiState.kt           (MODIFIED, +83 / -19)
  CheckoutViewModel.kt         (MODIFIED, +135 / -10)
apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/ui/
  CheckoutViewModelTest.kt     (MODIFIED, +318 / -3 — 16 new cases, 32 total)
```

### `CheckoutInputState`

Sealed interface with three concrete subtypes (split-bill is
out-of-scope for this slice — see "Out of scope" below):

- `CashInput(tenderedIdr: Long = 0L)` — tendered amount in
  IDR, with a `changeIdr(cartSubtotalIdr)` method that returns
  0 when tendered < subtotal so the dialog never shows a
  negative number.
- `EdcInput(approvalRef: String = "", last4: String? = null)` —
  EDC approval/ref number + optional last 4 of the card.
  Stored verbatim (whitespace not trimmed at write time) so
  paste-from-clipboard with a trailing newline doesn't get
  munged; trimmed only at validation time.
- `QrisDynamicInput(refId: String? = null, status:
QrisPollStatus = Generating)` — gateway-issued ref id +
  poll lifecycle.

Plus `QrisPollStatus` (sealed: `Generating`, `Awaiting`,
`Paid`, `Expired`, `Failed(message)`).

Each subtype exposes `isValid(cartSubtotalIdr: Long): Boolean`
gating commit:

| Method                     | inputState seed                      | isReadyForCommit when                                |
| -------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `CASH`                     | `CashInput(0)`                       | tendered > 0 _and_ tendered ≥ subtotal               |
| `EDC`                      | `EdcInput("", null)`                 | approvalRef.trim().isNotEmpty()                      |
| `QRIS_DYNAMIC`             | `QrisDynamicInput(null, Generating)` | status == `Paid`                                     |
| Single-tap-settle (others) | `null`                               | picker advanced to `Picked` (input is implicitly OK) |

### `CheckoutUiState` derived predicates

Two new predicates + one back-compat alias:

- `isReadyToConfirmMethod` — gates the picker → input-step CTA
  (was the slice-2 `isReadyToCommit`).
- `isReadyForCommit` — gates the actual transaction commit.
  Validates the per-method input against the snapshotted
  `cartSubtotalIdr`. `false` while picker is still
  `Picking` — kasir must confirm method before any commit is
  possible.
- `isReadyToCommit` — back-compat alias for
  `isReadyToConfirmMethod` so any reader of the slice-2
  contract keeps compiling. New code should prefer the
  dedicated `isReadyToConfirmMethod` (picker → input step) +
  `isReadyForCommit` (input → transaction commit).

### `CheckoutViewModel` mutators

4 new mutators, all defensively no-op when picker isn't
`Picked` or input shape doesn't match:

- `setCashTendered(idr: Long)` — clamps negatives to 0.
- `setEdcApprovalRef(approvalRef: String)` — stored verbatim,
  trimmed at validation.
- `setEdcLast4(last4: String?)` — pass `null` to clear.
- `setQrisStatus(refId: String?, status: QrisPollStatus)` —
  drives the poll lifecycle.

`confirmSelection` extended to seed `inputState` per method.
`reopenPicker` extended to clear `inputState` — re-confirming
the same method seeds a fresh per-method default. Keeps
half-typed tendered amounts from surviving a method-pivot.

### 16 new unit tests (32 total)

- `confirmSelection seeds CashInput for CASH`
- `confirmSelection seeds EdcInput for EDC`
- `confirmSelection seeds QrisDynamicInput for QRIS_DYNAMIC`
- `confirmSelection leaves inputState null for single-tap-settle methods` (parametrised over 7 methods)
- `setCashTendered updates tendered and gates isReadyForCommit`
- `setCashTendered clamps negatives to zero`
- `setCashTendered is no-op when not in CashInput state`
- `setCashTendered is no-op while picker is still open`
- `setEdcApprovalRef updates approvalRef and gates isReadyForCommit`
- `setEdcApprovalRef does not trim whitespace at write time`
- `setEdcApprovalRef whitespace-only is not valid`
- `setEdcLast4 updates last4 independently of approvalRef`
- `setQrisStatus advances through poll lifecycle` (Generating → Awaiting → Paid → Expired → Failed)
- `setQrisStatus is no-op when input shape is not QrisDynamic`
- `reopenPicker clears in-flight inputState`
- `re-confirming after reopenPicker re-seeds fresh inputState`
- `cancel clears inputState`
- `isReadyForCommit is false while picker is still open`
- `isReadyToCommit alias still tracks the picker step`

(Some are intentionally a touch redundant for clarity; they
all run in well under a second.)

## P3-08 slicing plan — status update

| Slice | Scope                                                                                                                                           | Risk   | Status                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| 1     | Data layer: `PaymentMethod` enum + `PaymentMethodCatalog` interface + default impl                                                              | green  | DONE — PR #222                     |
| 2     | ViewModel + UiState picker state-machine                                                                                                        | yellow | DONE — PR #224                     |
| 3     | **Method-specific input state: CashInput + EdcInput + QrisDynamicInput**                                                                        | yellow | **DONE — PR #226 (this rotation)** |
| 4     | Stateless Compose UI: `PaymentMethodGrid`, `CashPaymentDialog`, `EDCPaymentDialog`, `QRISPaymentDialog`, single-tap-settle dialog + `@Preview`s | yellow | next                               |
| 5     | Wire to kasir flow + transaction commit + QRIS Dynamic poll loop                                                                                | yellow | pending                            |

P3-08 progress: 3 of 5 slices shipped.

> **Note on slicing**: split-bill is no longer a sub-slice of
> slice 3 — it became a follow-up slice after seeing the
> `PaymentMethod` enum doesn't carry a `SPLIT` entry (slice
> 1's data layer treats split as a parallel flow, not a
> method). It needs its own picker-mode toggle + UI surface,
> so it's pulled out into a follow-up slice (post slice 5).

## Production state per close

### VPS

**Not touched this session**. PR #226 is path-filtered to
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
6. **Devin VM has no Android SDK** — every Kotlin compile error first-detected in CI. Cheap mitigations: small diffs, OptIn propagation through default args, no duplicate top-level `private class` across test files in the same package (KT-15514). **Slices 1 + 2 + 3 had zero CI bounces** because each slice ships zero callers + zero shared test helpers; expect the same green-on-first-try outcome for any slice that adds purely additive types in a feature module without consumers.

## Outstanding backlog

### Tier 1 (no founder input needed)

| Task                                                                        | Estimate | Risk   | Notes                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P3-08 slice 4 — stateless Compose UI**                                    | 1–2 d    | yellow | Next-up. `PaymentMethodGrid` + per-method dialogs (`CashPaymentDialog`, `EDCPaymentDialog`, `QRISPaymentDialog`) + single-tap-settle confirmation dialog + `@Preview` shapes for every state. Will likely bounce CI 1-2x — Compose UI slices historically trip the OptIn-propagation / K2-redeclaration class of errors.                    |
| P3-08 slice 5 — wire to kasir flow + transaction commit + QRIS poll loop    | 1–2 d    | yellow | `PosScreen` "Bayar" button → opens checkout, on settle → triggers `apps/backend/src/routes/transactions.js`. QRIS Dynamic poll loop (`viewModelScope`-bound timer + `/api/v1/payment/qris/:ref_id/status` calls) lands here — the backend gateway endpoint doesn't exist yet, so this slice may need a separate backend PR ahead of itself. |
| P3-08 follow-up — split-bill flow                                           | 1–2 d    | yellow | Pulled out of slice 3. Split-bill isn't a `PaymentMethod` enum entry, so it can't be driven by the same `selectedMethod` pivot. Needs its own picker-mode toggle (`PickerMode.Single` ↔ `PickerMode.Split`) + UI surface to add/remove rows. Layered on after the single-method flow is stable.                                             |
| Backend tighten `transactions.payment_method` to enum allow-list            | 0.5 d    | yellow | Separate backend PR after slice 5 lands.                                                                                                                                                                                                                                                                                                    |
| Backend `/api/v1/payment/qris` mint + `/:ref_id/status` poll endpoints      | 1–2 d    | yellow | Prereq for slice 5 QRIS Dynamic flow. The gateway integration spec lives in `docs/v2/14_PAYMENT_METHODS.md` §6 — Devin can implement against a stub gateway client, real provider key plug-in is a Tier-2 founder decision.                                                                                                                 |
| Cart-aware filter decorator for `PaymentMethodCatalog`                      | 0.5–1 d  | green  | Plug in at the `PosModule` `@Provides` site. Filters credit (non-walk-in customer required), deposit (balance > 0), loyalty (points ≥ threshold). Doesn't block slice 4+ since the catalogue indirection is already in place.                                                                                                               |
| Per-merchant allow-list filter                                              | tbd      | yellow | Blocked on a backend org-config column or settings endpoint that doesn't exist yet. Tier 2 promotion candidate if the backend work is non-trivial.                                                                                                                                                                                          |
| Skip-sheet-for-no-variant-products optimization                             | 1–2 d    | yellow | Carry-over.                                                                                                                                                                                                                                                                                                                                 |
| Sweep older handoff docs for stale `GITHUB_PAT_VIPOS` / `VPS_PASSWORD` refs | 0.5–1 h  | green  | Carry-over.                                                                                                                                                                                                                                                                                                                                 |

### Tier 1.5 — `phase_3_android_kasir_mvp.md` line items

P3-07 is **CLOSED**. P3-08 is **IN PROGRESS** (3 of 5 slices
shipped). Other workflow-doc items unchanged.

### Tier 2 (blocked on founder input)

| Task         | Need                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P3-01f       | Firebase project + `google-services.json` to enable Crashlytics.                                                                           |
| P3-07b       | Upload keystore (`.jks`) for the staging + prod release variants.                                                                          |
| QRIS gateway | Production credentials (e.g. Midtrans / Xendit / DOKU) for the slice-5 QRIS Dynamic mint + poll. Devin can stub against a fake until then. |

## Files modified this session (cumulative across all rotations of the day)

P3-07 fifth slice (#220) + handoff (#221) — already documented
in `2026-05-07-p3-07-fifth-slice-wired.md`.

P3-08 first slice (#222) + handoff (#223) — already documented
in `2026-05-07-p3-08-first-slice-payment-method-domain.md`.

P3-08 second slice (#224) + handoff (#225) — already documented
in `2026-05-07-p3-08-second-slice-checkout-viewmodel.md`.

P3-08 third slice (this handoff):

```
PR #226 (P3-08 third slice — method-specific input state) — 4 files, +716 / -32
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/domain/CheckoutInputState.kt   (new, 169)
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/CheckoutUiState.kt          (modified, +83 / -19)
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/CheckoutViewModel.kt        (modified, +135 / -10)
  apps/android/feature/pos/src/test/java/id/alviarts/vipos/feature/pos/ui/CheckoutViewModelTest.kt    (modified, +318 / -3)
```

This handoff doc adds:

```
docs/handoff/2026-05-07-p3-08-third-slice-method-input-state.md
```

## Smoke test infrastructure

No new browser-driven smoke tests added or run this rotation.
The new ViewModel surface is unit-tested
(`CheckoutViewModelTest`, 32 cases). UI smoke tests will land
with slice 4 (Compose UI).

## Operational notes for next session

1. **Slice 4 next** — stateless Compose UI:
   - `PaymentMethodGrid` — renders the slice-2
     `availableMethods` as a grid of cards. Selected card
     highlighted, tap → `selectMethod`. CTA gated on
     `isReadyToConfirmMethod`.
   - `CashPaymentDialog` — number-keyboard tendered field +
     auto-quick-amounts (50k, 100k, etc.). Mirrors
     `setCashTendered`. Shows derived `changeIdr`. CTA
     gated on `isReadyForCommit`.
   - `EDCPaymentDialog` — approval-ref field + optional
     last-4 field. Mirrors `setEdcApprovalRef` + `setEdcLast4`.
   - `QRISPaymentDialog` — QR rendering area + status badge
     ("Menunggu pembayaran…", "Lunas", "Kedaluwarsa", error).
     Drives `setQrisStatus` via the slice-5 poll loop.
   - Single-tap-settle confirmation dialog for the
     no-input-state methods.
   - All composables stateless + `@Preview`-able. Mirror the
     P3-07 `PosVariantSheet` idiom for state hoisting.

2. **Compose UI slice will likely bounce CI 1-2x** based on
   P3-07 fifth slice precedent (see
   `2026-05-07-p3-07-fifth-slice-wired.md`):
   - `@OptIn(ExperimentalMaterial3Api::class)` propagates
     through default-arg `SheetState` parameters; every
     call site needs the opt-in too, not just the inner
     composable.
   - K2 KT-15514 blocks duplicate top-level `private class`
     in the same package across test files; rename helpers
     uniquely (e.g. `CheckoutSynchronousExecutorService`).

3. **No backend work in slice 4** — slice 4 is pure Compose
   UI, no API calls. Slice 5 is where the backend
   `/api/v1/payment/qris` endpoint becomes a prerequisite. If
   that endpoint isn't in place by slice 5, the QRIS Dynamic
   path can ship behind a feature flag (state machine works
   fine; the dialog just shows a "QRIS Dinamis belum
   tersedia" banner).

4. **Split-bill is now a follow-up slice**, not a sub-slice of
   slice 3. It needs:
   - A `PickerMode` enum (`Single` / `Split`) on
     `CheckoutUiState` so the picker can be in either
     single-method or split-row mode.
   - A `SplitInput` shape (deferred from slice 3 — see
     PR #226 commit body).
   - A different UI surface (table-style row editor instead
     of the single-method dialog).
   - Decision on whether the kasir can mix online + offline
     methods in a split (probably yes).

5. **Slice 3 had zero CI bounces** — same as slices 1 + 2.
   Pattern: slices that ship purely additive types in a
   feature module without consumers don't trigger the K2
   redeclaration / OptIn-propagation errors. **Slice 4 is the
   first slice with consumers** (the new
   `PaymentMethodGrid` / `CashPaymentDialog` / etc. will
   reference the slice-3 mutators + predicates), so expect
   the bounce-rate to revert to the historical pattern.

6. **`isReadyToCommit` back-compat alias** — slice-2 readers
   referencing the old name keep compiling. New code should
   prefer the dedicated `isReadyToConfirmMethod` (picker →
   input step) + `isReadyForCommit` (input → transaction
   commit). Plan to retire the alias in slice 5 once all
   call sites have been updated.

7. **No smoke testing this rotation** — ViewModel surface
   only, nothing to click. Slice 4 will be the first slice
   with a UI surface to preview.
