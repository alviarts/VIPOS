# Handoff — 2026-05-07: P3-08 fourth slice (checkout Compose UI)

> **Closed**: 2026-05-07 ~15:08 UTC.
> **Devin session**: <https://app.devin.ai/sessions/d68f67bb2c8140f7812a7b2cecf80fd4>
> **Mode**: Continuous-automation (`docs/v3/workflow/devin_continuous_automation.md`) — auto-merge ON for risk ≤ yellow.

## TL;DR

Shipped the fourth slice of P3-08: stateless Compose UI for
the checkout flow (`CheckoutSheet` + body composables for
picker grid + per-method input dialogs + 11 `@Preview`
shapes). **PR #228** went green on first try across all 4 CI
jobs (no bounces — surprise outcome compared to the slice-4
precedent set by P3-07; the slice ships zero callers + zero
shared test helpers and the OptIn propagation through
default-arg `SheetState` was tightened up against the P3-07
fifth-slice CI bounce class). UI is fully isolated until
slice 5 wires it to `PosCatalogueScreen`.

`main` HEAD: `bd9456f` (PR #228 squash-merge).

## PRs merged this rotation

| PR   | Branch                                      | Subject                                                                          | Status |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| #228 | `devin/1778165962-p3-08-slice4-checkout-ui` | feat(P3-08): fourth slice — Compose UI for checkout sheet (stateless + previews) | merged |

Created via REST API. Squash-merged via REST API after CI
green. Single commit on the branch — clean.

## What slice 4 actually shipped

```
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/
  CheckoutSheet.kt           (NEW, 1141 lines)
```

### Public entry points (composables)

| Composable              | Purpose                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `CheckoutSheet`         | Full `ModalBottomSheet` wrapper. Drag-down + scrim → `onDismiss`. Mounts from the kasir screen.                          |
| `CheckoutSheetContent`  | Bare body without sheet chrome. Used by previews / tests / tablet inline panels.                                         |
| `PaymentMethodGrid`     | Picker grid (`FilterChip`, 2-per-row).                                                                                   |
| `CashPaymentDialog`     | Tendered field + quick-amount `AssistChip`s + change-due readout.                                                        |
| `EdcPaymentDialog`      | Approval-ref + last4 fields.                                                                                             |
| `QrisPaymentDialog`     | QR placeholder + status badge, routed by `QrisPollStatus` (Generating / Awaiting / Paid / Expired / Failed).             |
| `SingleTapSettleDialog` | Confirmation for `inputState=null` methods (QRIS Statis / bank transfer / credit / deposit / voucher / loyalty / other). |

### Body routing per `CheckoutPickerStatus`

| Status    | Body                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Idle`    | Defensive fallback (`"Belum ada keranjang aktif."`). Calling screen owns visibility — should dismiss the sheet on Idle.                                                                          |
| `Picking` | `PaymentMethodGrid` + "Lanjut" CTA gated on `isReadyToConfirmMethod`.                                                                                                                            |
| `Picked`  | Per-method dialog routed by `inputState` shape (see table above). Each dialog has "← Ubah metode" header → `onReopenPicker` + "Bayar" / "Konfirmasi pembayaran" CTA gated on `isReadyForCommit`. |

### 11 `@Preview` shapes

- `CheckoutSheetContentPickingPreview` — picker, online (15 methods).
- `CheckoutSheetContentPickingOfflinePreview` — picker, offline (8 methods, online-required filtered out).
- `CheckoutSheetContentCashEmptyPreview` — Cash dialog, tendered = 0.
- `CheckoutSheetContentCashChangePreview` — Cash dialog, tendered > subtotal (change due).
- `CheckoutSheetContentCashShortPreview` — Cash dialog, tendered < subtotal (still short).
- `CheckoutSheetContentEdcPreview` — EDC dialog, approval-ref + last4 populated.
- `CheckoutSheetContentQrisGeneratingPreview` — QRIS, Generating.
- `CheckoutSheetContentQrisAwaitingPreview` — QRIS, Awaiting.
- `CheckoutSheetContentQrisPaidPreview` — QRIS, Paid.
- `CheckoutSheetContentQrisFailedPreview` — QRIS, Failed("gateway timeout").
- `CheckoutSheetContentSingleTapSettlePreview` — Bank Transfer single-tap settle.

### Indonesian copy + IDR formatting

All visible strings in Indonesian. IDR formatted via locale-
aware `NumberFormat("id-ID")` with no fractional digits — same
helper pattern as `PosCatalogueScreen` + `PosVariantSheet`
(kept local to file for slice scope; planned to extract to a
shared `core-designsystem` helper post slice 5).

## P3-08 slicing plan — status update

| Slice | Scope                                                                                                                                               | Risk   | Status                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------- |
| 1     | Data layer: `PaymentMethod` enum + `PaymentMethodCatalog` interface + default impl                                                                  | green  | DONE — PR #222                     |
| 2     | ViewModel + UiState picker state-machine                                                                                                            | yellow | DONE — PR #224                     |
| 3     | Method-specific input state: `CashInput` + `EdcInput` + `QrisDynamicInput`                                                                          | yellow | DONE — PR #226                     |
| 4     | **Stateless Compose UI: `PaymentMethodGrid`, `CashPaymentDialog`, `EdcPaymentDialog`, `QrisPaymentDialog`, single-tap-settle dialog + `@Preview`s** | yellow | **DONE — PR #228 (this rotation)** |
| 5     | Wire to kasir flow + transaction commit + QRIS Dynamic poll loop                                                                                    | yellow | next                               |

P3-08 progress: 4 of 5 slices shipped.

## Production state per close

### VPS

**Not touched this session**. PR #228 is path-filtered to
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
6. **Devin VM has no Android SDK** — every Kotlin compile error first-detected in CI. **Slice 4 surprise**: zero CI bounces despite the historical pattern (P3-07 fifth slice bounced 2x). Mitigations applied that paid off:
   - `@OptIn(ExperimentalMaterial3Api::class)` on every composable that takes a `SheetState` default-arg or calls `FilterChip` / `AssistChip` / `OutlinedTextField` / `ModalBottomSheet`.
   - No duplicate top-level `private class` across files (KT-15514) — slice 4 has no test file with helpers, eliminating that class of error.
   - Single self-contained file mirroring `PosVariantSheet.kt` idiom — no cross-file imports of newly-added types.

## Outstanding backlog

### Tier 1 (no founder input needed)

| Task                                                                         | Estimate | Risk   | Notes                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P3-08 slice 5 — wire to kasir flow + transaction commit + QRIS poll loop** | 1–2 d    | yellow | Next-up. `PosCatalogueScreen` "Bayar" button → opens `CheckoutSheet`, on commit → calls backend `POST /api/v1/transactions`. QRIS Dynamic poll loop (`viewModelScope`-bound timer + `/api/v1/payment/qris/:ref_id/status` calls) lands here. Likely needs a stub gateway client until the backend QRIS endpoints exist. May bounce CI 1-2x. |
| Backend `/api/v1/payment/qris` mint + `/:ref_id/status` poll endpoints       | 1–2 d    | yellow | Prereq for slice 5 QRIS Dynamic flow. The gateway integration spec lives in `docs/v2/14_PAYMENT_METHODS.md` §6 — Devin can implement against a stub gateway client, real provider key plug-in is a Tier-2 founder decision.                                                                                                                 |
| Backend tighten `transactions.payment_method` to enum allow-list             | 0.5 d    | yellow | Separate backend PR after slice 5 lands.                                                                                                                                                                                                                                                                                                    |
| P3-08 follow-up — split-bill flow                                            | 1–2 d    | yellow | Pulled out of slice 3. Split-bill isn't a `PaymentMethod` enum entry, so it can't be driven by the same `selectedMethod` pivot. Needs its own picker-mode toggle (`PickerMode.Single` ↔ `PickerMode.Split`) + UI surface to add/remove rows. Layered on after the single-method flow is stable.                                             |
| Cart-aware filter decorator for `PaymentMethodCatalog`                       | 0.5–1 d  | green  | Plug in at the `PosModule` `@Provides` site. Filters credit (non-walk-in customer required), deposit (balance > 0), loyalty (points ≥ threshold). Doesn't block slice 5+ since the catalogue indirection is already in place.                                                                                                               |
| Per-merchant allow-list filter                                               | tbd      | yellow | Blocked on a backend org-config column or settings endpoint that doesn't exist yet. Tier 2 promotion candidate if the backend work is non-trivial.                                                                                                                                                                                          |
| Skip-sheet-for-no-variant-products optimization                              | 1–2 d    | yellow | Carry-over.                                                                                                                                                                                                                                                                                                                                 |
| Extract `formatIdrLabel` to shared `core-designsystem` helper                | 0.5 h    | green  | `PosCatalogueScreen`, `PosVariantSheet`, and `CheckoutSheet` now have three identical `Locale("id","ID")` formatters. Trivial refactor, low risk.                                                                                                                                                                                           |
| Sweep older handoff docs for stale `GITHUB_PAT_VIPOS` / `VPS_PASSWORD` refs  | 0.5–1 h  | green  | Carry-over.                                                                                                                                                                                                                                                                                                                                 |

### Tier 1.5 — `phase_3_android_kasir_mvp.md` line items

P3-07 is **CLOSED**. P3-08 is **IN PROGRESS** (4 of 5 slices
shipped). Slice 5 closes the loop.

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

P3-08 third slice (#226) + handoff (#227) — already documented
in `2026-05-07-p3-08-third-slice-method-input-state.md`.

P3-08 fourth slice (this handoff):

```
PR #228 (P3-08 fourth slice — checkout Compose UI) — 1 file, +1141
  apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/CheckoutSheet.kt   (new, 1141)
```

This handoff doc adds:

```
docs/handoff/2026-05-07-p3-08-fourth-slice-checkout-ui.md
```

## Smoke test infrastructure

No new browser-driven smoke tests added or run this rotation.
The Compose UI is unit-test-light by design — `@Preview`
shapes are the design-eyeballing surface, screenshot tests
land with slice 5 once the UI has consumers. End-to-end
smoke against the running app lands post slice 5 with the
"Bayar" button wiring.

## Operational notes for next session

1. **Slice 5 next** — kasir-flow wiring + transaction commit + QRIS poll loop:
   - **`PosCatalogueScreen` "Bayar" button**:
     - Currently the cart line bottom-bar shows a "Total: Rp X" readout. Needs a "Bayar" button that, when tapped with a non-empty cart, calls `checkoutViewModel.start(cartSubtotalIdr, isOnline)` and shows the sheet.
     - The sheet is dismissed on `cancel()` (drag-down / scrim) and on `commit()` success.
   - **Transaction commit**:
     - Backend route is `POST /api/v1/transactions` (see `apps/backend/src/routes/transactions.js`).
     - Body shape: `{ payment_method, payment_payload (per-method JSON), items }`.
     - Currently the route accepts an arbitrary string for `payment_method` and defaults to `cash` — slice 5 should send `PaymentMethod.code` for compatibility, and a follow-up PR tightens the backend to an enum allow-list.
   - **QRIS Dynamic poll loop**:
     - On `confirmSelection()` for `QRIS_DYNAMIC`, kick off a `viewModelScope`-bound coroutine that:
       1. Calls `POST /api/v1/payment/qris/mint` (TBD — backend doesn't exist yet) → seeds `QrisDynamicInput.refId` + status `Awaiting`.
       2. Polls `GET /api/v1/payment/qris/:ref_id/status` every 3s until status is `Paid` / `Expired` / `Failed`.
       3. On `cancel()` / `reopenPicker()`, cancels the coroutine.
   - **If the backend QRIS endpoints aren't ready by slice 5**, the QRIS Dynamic path can ship behind a feature flag (state machine works fine; the dialog shows a "QRIS Dinamis belum tersedia" banner). Cash + EDC + single-tap settle all ship without the backend QRIS dependency.

2. **Slice 5 will likely bounce CI 1-2x** based on P3-07 fifth-slice precedent:
   - `@OptIn(ExperimentalMaterial3Api::class)` propagates through default-arg `SheetState`. Slice 5 mounts `CheckoutSheet` from `PosCatalogueScreen` — the `PosCatalogueRoute` and any Compose function that calls `CheckoutSheet(...)` with the default `sheetState` arg will need the OptIn too.
   - K2 KT-15514 — if slice 5 adds test helpers, name them uniquely (e.g. `CheckoutSynchronousExecutorService` not `SynchronousExecutorService`).
   - Cart line identity is the tuple `(productId, unitPriceUpliftIdr)` introduced by P3-07 slice 5 — slice 5 commit should send that tuple so that P3-07 modifier uplift carries through to the transaction line.

3. **Real QR rendering in slice 5**:
   - Need a QR codec library. Options: `com.google.zxing:core` (Apache 2.0, ubiquitous) or `io.github.g0dkar:qrcode-kotlin` (MIT, Compose-friendly). `zxing` is the safer pick — well-known, used by every Android app that renders QRs.
   - The placeholder rect already lives in slice 4 — slice 5 swaps it out for a `Canvas { drawQr(...) }` against the gateway-issued payload.

4. **Split-bill is still a follow-up slice**, not a sub-slice of slice 5. Plan unchanged from slice 3 handoff:
   - `PickerMode` enum (`Single` / `Split`) on `CheckoutUiState`.
   - `SplitInput` shape (deferred from slice 3).
   - Different UI surface (table-style row editor instead of single-method dialog).

5. **Slice 4 had zero CI bounces** — surprise outcome compared to P3-07 fifth-slice precedent. The mitigations that paid off:
   - Slice 4 ships zero callers (no `PosCatalogueScreen` integration), so the OptIn propagation through call sites isn't yet exercised. Slice 5 reverses this — the bounce-rate will revert to historical pattern.
   - Single self-contained file (no cross-file imports of newly-added types). Slice 5 imports `CheckoutSheet`, `CheckoutViewModel`, `CheckoutInputState`, `QrisPollStatus` into `PosCatalogueScreen` — first cross-module-internal use, may surface unexpected import issues.
   - No test file (no risk of duplicate `private class` collisions). If slice 5 adds tests, prefix unique names per `CheckoutSynchronousExecutorService` precedent.

6. **`CheckoutSheet` consumer surface**:
   - 9 callbacks (`onSelectMethod`, `onClearSelection`, `onConfirmSelection`, `onReopenPicker`, `onSetCashTendered`, `onSetEdcApprovalRef`, `onSetEdcLast4`, `onCommit`, `onDismiss`). Wide but not unmanageable.
   - Each maps 1:1 to a `CheckoutViewModel` mutator (or lifecycle method) — slice 5 can wire them with a single `remember` of the VM and direct lambda forwards.
   - The picker `Lanjut` CTA fires `onConfirmSelection`; the per-method dialog `Bayar` / `Konfirmasi pembayaran` CTAs fire `onCommit`. Slice 5 wires `onCommit` to a new `CheckoutViewModel.commit()` method that calls the backend transaction route + observes the result.

7. **No smoke testing this rotation** — UI still has no consumers, nothing to click. Slice 5 lands the consumer + a 'live demo' end-to-end test.
