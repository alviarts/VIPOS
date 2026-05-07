# 2026-05-07 — Tier-1 continuous-automation loop #9 (P3-08 slice 5a — mount CheckoutSheet)

> **Closed**: 2026-05-07 19:47 UTC.
>
> **Devin session**: <https://app.devin.ai/sessions/e5ac1a74a5d641478c24115f83b4e8a3>
>
> **Mode**: continuous-automation. Loop #8 (`/api/v1/version` smoke gate)
> closed at 19:30 UTC; founder picked
> `Lanjut loop #9 — P3-08 slice 5 (kasir QRIS poll loop, ~1-2d — mungkin
perlu split jadi sub-slice biar 1 sesi muat)` so this loop ships the
> first of three planned sub-slices (5a, 5b, 5c) for P3-08 slice 5.
>
> **Successor entry point**: read THIS file plus the slice-4 handoff
> at `docs/handoff/2026-05-07-p3-08-fourth-slice-checkout-ui.md` and
> the loop-5 handoff at
> `docs/handoff/2026-05-07-tier1-loop-5-qris-stub.md` (backend stub
> for slice 5c).

---

## TL;DR

One PR shipped: **#250** (`feat(P3-08): slice 5a — mount CheckoutSheet
from PosCatalogueRoute`). The kasir `Bayar` button now mounts the
slice-4 `CheckoutSheet` and drives the picker / per-method input
flow against the existing `CheckoutViewModel`. **Zero CI bounces**
(predicted 1-2 in slice-4 handoff §8.5 — first cross-module-internal
call site for `CheckoutSheet`); the OptIn already covered both sheets
and no new test file means no KT-15514 risk surface.

`onCommit` and `onDismiss` both currently route to `cancel()` — slice
5b will replace `onCommit` with a `TransactionRepository` call against
`POST /api/v1/transactions`, and slice 5c will add the QRIS Dynamic
mint + 3s poll loop driven by the loop-5 stub (PR #244).

`main` HEAD: `3e2922b03106190692ffc2fa5afdab67236e8ff2` (PR #250
squash-merge). Production state unchanged from loop #8 (slice 5a is
Android-only — `apps/android/**` only — no backend / VPS surface
touched).

---

## §1 — PRs merged this session

| #          | Branch                                       | Subject                                                            | Status              |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------ | ------------------- |
| 250        | `devin/1778182836-p3-08-slice5a-mount-sheet` | feat(P3-08): slice 5a — mount CheckoutSheet from PosCatalogueRoute | merged              |
| _this doc_ | `devin/1778183222-handoff-loop-9-slice5a`    | docs(handoff): 2026-05-07 loop #9 — P3-08 slice 5a (PR #250)       | merged (pending CI) |

---

## §2 — What slice 5a actually shipped

### Code surface (single file modified)

`apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/PosCatalogueScreen.kt`:

```diff
 fun PosCatalogueRoute(
     onBack: () -> Unit,
     catalogueViewModel: PosCatalogueViewModel = hiltViewModel(),
     variantViewModel: PosVariantViewModel = hiltViewModel(),
+    checkoutViewModel: CheckoutViewModel = hiltViewModel(),
 ) {
     ...
     val variantState by variantViewModel.uiState.collectAsStateWithLifecycle()
+    val checkoutState by checkoutViewModel.uiState.collectAsStateWithLifecycle()
     ...
     onCheckout = {
-        // P3-06 no-op placeholder.
+        checkoutViewModel.start(state.cartSubtotalIdr, isOnline = true)
     },
     ...
+    if (checkoutState.pickerStatus !is CheckoutPickerStatus.Idle) {
+        CheckoutSheet(
+            state = checkoutState,
+            onSelectMethod = checkoutViewModel::selectMethod,
+            onClearSelection = checkoutViewModel::clearSelection,
+            onConfirmSelection = checkoutViewModel::confirmSelection,
+            onReopenPicker = checkoutViewModel::reopenPicker,
+            onSetCashTendered = checkoutViewModel::setCashTendered,
+            onSetEdcApprovalRef = checkoutViewModel::setEdcApprovalRef,
+            onSetEdcLast4 = checkoutViewModel::setEdcLast4,
+            onCommit = { checkoutViewModel.cancel() }, // slice 5b
+            onDismiss = checkoutViewModel::cancel,
+        )
+    }
```

CTA copy on `CartPanel`'s primary `Button` switched from
`"Lanjut ke pembayaran (P3-08)"` to `"Bayar"` since the button is
now actually wired through to a real flow.

### What slice 5a does NOT do (deferred)

- **Slice 5b — backend transaction commit.** `onCommit` will POST to
  `/api/v1/transactions` with `(payment_method, payment_payload, items)`
  derived from `checkoutState.inputState` + `state.cart`, and on
  success will (a) clear the catalogue cart, (b) toast a receipt
  summary, (c) reset the `CheckoutViewModel`.
- **Slice 5c — QRIS Dynamic mint + 3s poll loop.** On
  `confirmSelection` for `QRIS_DYNAMIC`, kick off a
  `viewModelScope`-bound coroutine that POSTs to
  `/api/v1/payment/qris/dynamic` (loop-5 stub from PR #244, in-memory
  Map keyed by `ref_id`) → seeds `QrisDynamicInput.refId`, then polls
  `GET /api/v1/payment/qris/:ref_id/status` every 3s until status is
  `Paid` / `Expired` / `Failed`. The slice-4 dialog already routes
  off `QrisPollStatus` so this is a pure VM-side change with no UI
  edits.
- Cart-aware online-state detection. `isOnline = true` is hardcoded
  in slice 5a — a real network signal lands later.
- `CartAwarePaymentMethodCatalog` Hilt wiring. Already shipped as a
  class (loop #4 carry-over) but not yet bound in `PosModule`.
  Independent Tier-1 task — recommended to land before slice 5c so
  the picker's offline-method filtering matches reality.

### P3-08 slicing plan — final shape

| Slice  | Scope                                                               | Risk   | Status                         |
| ------ | ------------------------------------------------------------------- | ------ | ------------------------------ |
| 1      | Data layer: `PaymentMethod` + `PaymentMethodCatalog`                | green  | DONE — PR #222                 |
| 2      | ViewModel + UiState picker state-machine                            | yellow | DONE — PR #224                 |
| 3      | Method-specific input state (Cash / EDC / QRIS Dynamic)             | yellow | DONE — PR #226                 |
| 4      | Stateless Compose UI (sheet + per-method dialogs + 11 previews)     | yellow | DONE — PR #228                 |
| **5a** | **Mount sheet from PosCatalogueRoute (this loop)**                  | yellow | **DONE — PR #250 (this loop)** |
| 5b     | `TransactionRepository` + `POST /api/v1/transactions` on `onCommit` | yellow | next                           |
| 5c     | QRIS Dynamic mint + 3s poll loop (driven by loop-5 backend stub)    | yellow | after 5b                       |

P3-08 progress: 5 of 7 milestones shipped (slices 1, 2, 3, 4, 5a).

---

## §3 — CI surprise — zero bounces

The slice-4 handoff §8.5 predicted 1-2 CI bounces for slice 5 because
this is the first cross-module-internal call site that imports
`CheckoutSheet`, `CheckoutViewModel`, `CheckoutPickerStatus`, etc.
from inside the same `feature/pos` module. None materialised:

```
[1] RUNNING|done=0/4|fails=[]|running=[android, web, lint, test]
...
[3] RUNNING|done=1/4|fails=[]|running=[android, web, test]
[6] RUNNING|done=2/4|fails=[]|running=[android, test]
[7] RUNNING|done=3/4|fails=[]|running=[test]
[11] ALL_GREEN|done=4/4|fails=[]|running=[]
```

Mitigations that paid off:

1. **OptIn already in place** — the route had `@OptIn(ExperimentalMaterial3Api::class)` from slice-1 `PosVariantSheet` integration. `CheckoutSheet` reuses the same `SheetState = rememberModalBottomSheetState(...)` default-arg pattern, so the existing OptIn covers it; no new annotation needed.

2. **Same package** — `CheckoutSheet`, `CheckoutViewModel`, and `CheckoutPickerStatus` all live in `id.alviarts.vipos.feature.pos.ui`, the same package as `PosCatalogueRoute`. No cross-module imports needed → no risk of unresolved `import` or `INVISIBLE_REFERENCE` from `internal` visibility modifiers.

3. **No new test file** — the slice doesn't add a Robolectric / Compose UI test, so KT-15514 (duplicate top-level private classes across files) is not on the surface. Existing `CheckoutViewModelTest` already covers all the public ViewModel methods this slice wires through.

4. **Method references over lambdas** — using `checkoutViewModel::selectMethod` etc. instead of `{ method -> checkoutViewModel.selectMethod(method) }` keeps the diff small and avoids any bridging-function compilation that may be sensitive to K2 semantics.

The slice-4 prediction stands for slice 5b (will add a network call site → new `TransactionRepository` interface + Retrofit definition; first cross-module test if Retrofit-mocking helpers are added) and slice 5c (`viewModelScope`-bound coroutine + Flow timing test, classic K2 flake territory).

---

## §4 — Production state per close

Unchanged from loop #8 (slice 5a is Android-only):

```
$ curl -fsS http://103.74.5.44/vipos/api/v1/version
{"sha":"9b139f40aabb26acb3a53ab491eda9bf92197272","builtAt":"2026-05-07T19:28:41Z","env":"production"}
```

Deployed sha is loop-8's `9b139f40`. The `main` HEAD is now
`3e2922b` (PR #250 squash-merge) but slice 5a is path-filtered to
`apps/android/**` so neither `deploy-vps.yml` nor `tools/scripts/deploy.sh`
fired on this push (the filter at the workflow level deliberately
skips deploy when only Android files change — same as slice 4).

VPS is healthy at close (last verified at 19:29 UTC):

- `vipos-backend` pm2 online, db 40 ms / redis 4 ms.
- `/api/v1/version` returning the loop-8 deploy sha + builtAt as
  expected.
- No new Sentry releases this loop.

Credentials state unchanged. Postgres / Redis pwds last rotated
2026-05-05.

---

## §5 — Critical infrastructure context

No changes from loop #8. Active workarounds carry over:

1. **Smoke-test timing rule** — N/A this loop (no deploy).
2. **PAT-fallback push** — used for both PR #250 push and this
   handoff doc push.
3. **Chicken-egg deploy.sh** — N/A this loop.
4. **Secret-persistence pothole** — `GIT_PAT` came back `len=0`
   again at session start; aliased from `GITHUB_PAT_ALVIARTS`
   (`len=40`) in the alias-on-empty pattern. The repo-level env
   config suggested in loop #8 pin will fix this once approved.
5. **`git_create_pr` / `git_pr_checks` tools don't see this repo** —
   REST API fallback used for everything (PR #250 + this handoff).
6. **VPS_SSH_PASSWORD** — `len=0` this session; not needed for
   slice 5a (Android-only). If slice 5b needs to run a backend
   integration test against the live VPS, ask the founder via
   `request_secret`.

---

## §6 — Outstanding backlog

### Tier 1 — no founder input needed (risk≤yellow)

| Task                                                                                 | Estimate | Risk   | Notes                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P3-08 slice 5b — `TransactionRepository` + `POST /api/v1/transactions` on commit** | 0.5–1 d  | yellow | Next-up. Replace the `onCommit = { checkoutViewModel.cancel() }` placeholder with a Hilt-injected repository call. On success, clear catalogue cart + toast receipt + reset `CheckoutViewModel`. May bounce CI 1-2x (first Retrofit mock test in `feature/pos`).         |
| **P3-08 slice 5c — QRIS Dynamic mint + 3s poll loop**                                | 0.5–1 d  | yellow | After 5b. `viewModelScope`-bound coroutine — POST `/api/v1/payment/qris/dynamic` to seed `refId`, poll `/:ref_id/status` every 3s until `Paid` / `Expired` / `Failed`. Cancel on `reopenPicker` / `cancel`. Classic K2 coroutine flake territory; budget 2-3 CI bounces. |
| **Wire `CartAwarePaymentMethodCatalog` into `PosModule` via `CartContext` provider** | 0.5 d    | yellow | Carry-over. Recommend landing before slice 5c so the picker's offline-method filtering reflects reality (currently `isOnline = true` is hardcoded in `PosCatalogueRoute.onCheckout` at slice 5a).                                                                        |
| **Migrate pre-#236 lowercase `transactions.payment_method` rows to canonical**       | 0.25 d   | yellow | Cosmetic. Idempotent UPDATE. Needs `VPS_SSH_PASSWORD` to run on VPS.                                                                                                                                                                                                     |
| **Replace QRIS in-memory stub with `qris_dynamic_invocations` table**                | 0.5 d    | yellow | Pre-req: Tier-2 gateway pick.                                                                                                                                                                                                                                            |

**Removed** (closed in loop #8): `Add /api/v1/version smoke gate to deploy-vps.yml` — PR #248.

### Tier 2 — blocked on founder input (unchanged)

- **Pick QRIS gateway provider** (Midtrans / Xendit / DOKU). Unblocks slice 5c with a real provider; the in-memory stub keeps slice 5c functional in dev but the stub clears on every pm2 restart.
- **HTTPS domain + cert provisioning strategy.**
- **Sidebar role visibility decisions.**
- **Receipt branding** (logo / address / footer).

---

## §7 — Files modified this session

```
$ git diff --merge-base origin/main --stat   (cumulative across both PRs in the loop)

# PR #250 (merged 3e2922b)
apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/ui/PosCatalogueScreen.kt | 70 +++++++++++++++++++++++++++++++++++++--

# This handoff doc (pending merge)
docs/handoff/2026-05-07-tier1-loop-9-slice5a-mount-sheet.md  | <this file>
```

PR #250 surface (single file, +59 lines / -11 lines):

- `PosCatalogueRoute` — added `checkoutViewModel: CheckoutViewModel = hiltViewModel()` parameter, `val checkoutState by ...collectAsStateWithLifecycle()`, replaced `onCheckout` no-op with `checkoutViewModel.start(state.cartSubtotalIdr, isOnline = true)`, mounted `CheckoutSheet` conditionally on `pickerStatus !is Idle` with all narrow callbacks fanned out to existing ViewModel methods.
- `CartPanel` — primary CTA copy: `"Lanjut ke pembayaran (P3-08)"` → `"Bayar"`.

No edits to `CheckoutViewModel`, `CheckoutSheet`, `CheckoutUiState`,
`PaymentMethod`, `PaymentMethodCatalog`, or any test file. The
slice is pure call-site wiring.

---

## §8 — Smoke test infrastructure

No new browser-driven smoke tests added this loop. Slice 5a is
Compose-only and the `@Preview` shapes from slice 4 (11 of them)
remain the design-eyeballing surface.

End-to-end integration testing (kasir flow → picker → method → settle
→ commit → DB row) still pending — recommend landing it together
with slice 5b once the backend round-trip is wired. The loop-5
backdoor (`POST /api/v1/payment/qris/:ref_id/_test/mark-paid`) lets
the QRIS Dynamic path be tested end-to-end without a real gateway.

---

## §9 — Operational notes for next session

1. **Slice 5b next** — `TransactionRepository` + `POST /api/v1/transactions`:
   - Existing backend route is at `apps/backend/src/routes/transactions.js`.
   - Body shape per slice-4 handoff §8.1: `{ payment_method, payment_payload, items }`.
   - Add a `TransactionRepository` interface in `feature/pos/data/` mirroring the `PosApi` Retrofit pattern.
   - Inject via `PosModule` (`@Provides @Singleton fun provideTransactionRepository(...)`).
   - On `onCommit` in `PosCatalogueRoute`: launch a coroutine, call repository, on success → clear catalogue cart (`catalogueViewModel.clearCart()` if it exists, else add it) + reset `CheckoutViewModel` + toast.
   - On failure → toast + leave the sheet open so the kasir can retry.
   - Use `(productId, unitPriceUpliftIdr)` tuple for cart-line identity (P3-07 slice 5 contract).
   - **First Retrofit mock test in `feature/pos`** — budget 1-2 CI bounces. Use the `OkHttp MockWebServer` pattern from `:core:network` if it exists; otherwise plain `MockK` against the Retrofit interface.

2. **Slice 5c — QRIS Dynamic poll loop** — `viewModelScope`-bound coroutine:
   - `confirmSelection` for `QRIS_DYNAMIC` already seeds `QrisDynamicInput(refId = null, status = Generating)`.
   - Add a `mintAndPoll(amount: Long)` method on `CheckoutViewModel` that:
     1. POSTs `{amount}` to `/api/v1/payment/qris/dynamic` (loop-5 stub) → `setQrisStatus(refId, Awaiting)`.
     2. Polls `GET /api/v1/payment/qris/:ref_id/status` every 3s. On `Paid` → break; on `Expired` / `Failed` → break with status; on `404` → treat as expired (loop-5 in-memory store can clear on pm2 restart).
     3. Cancellation: hook `viewModelScope.cancel()` on `cancel()` and `reopenPicker()`.
   - Use `kotlinx.coroutines.delay(3_000)` not `Timer` so the test doubles work via `runTest { advanceTimeBy(3_000) }`.
   - **Classic K2 coroutine test flake territory** — budget 2-3 CI bounces. Use `StandardTestDispatcher` + `runTest` per the
     coroutines testing guide; avoid `runBlockingTest` (deprecated).

3. **Order of operations recommendation**:
   - Slice 5b first (backend wiring is independent of QRIS).
   - Then `CartAwarePaymentMethodCatalog` Hilt wiring (small, unblocks better default behaviour).
   - Then slice 5c (QRIS poll — depends on a slice-5b-complete commit flow so `Paid` actually settles a real transaction).

4. **The CI green-on-first-try outcome was unexpected**. The slice-4
   handoff was conservative; this slice's in-package call-site pattern
   was easier to nail than predicted. The prediction should hold up
   for slice 5b/5c which add cross-module data layer + coroutine
   timing tests.

5. **`isOnline = true` is hardcoded** in slice 5a's `onCheckout`. Add
   a real network signal in slice 5c (or as a quick green-risk
   followup): `:core:network` already has a connectivity observer
   (`ConnectivityObserver` somewhere — search). Pipe its `Flow<Boolean>`
   through to `PosCatalogueViewModel.isOnline` and pass it to
   `checkoutViewModel.start(...)`.

---

\_Prepared by Devin sesi continuous-automation 2026-05-07 (loop #9
P3-08 slice 5a — mount CheckoutSheet from PosCatalogueRoute). Per
`docs/v3/workflow/devin_continuous_automation.md` §6, this doc WILL
merge to `main` via PR + squash before session close. PR #250 already
merged 3e2922b; this is the doc-only follow-up.\_
