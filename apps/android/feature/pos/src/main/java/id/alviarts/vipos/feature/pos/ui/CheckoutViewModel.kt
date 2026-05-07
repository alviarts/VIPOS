package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

/**
 * Drives the payment-method picker (P3-08 second slice) +
 * method-specific input state (P3-08 third slice).
 *
 * Responsibilities (this slice and the previous):
 *  - Open the picker for a given cart subtotal — snapshots the
 *    subtotal + the available-methods projection from
 *    [PaymentMethodCatalog] for the current online state.
 *  - Maintain the [CheckoutUiState] picker lifecycle. The
 *    picker is purely client-side — there's no fetch — so the
 *    lifecycle is a deterministic `Idle → Picking → Picked`
 *    state machine driven by the kasir's taps.
 *  - Let the kasir change their pick mid-Picking; replacing
 *    [CheckoutUiState.selectedMethod] in place is a no-op
 *    against the picker lifecycle.
 *  - **Slice 3** — initialise the per-method
 *    [CheckoutInputState] on [confirmSelection] so the slice-4
 *    UI has a non-null state to render its input dialog
 *    against, and expose narrow mutators for each method's
 *    input shape (cash tendered, EDC approval ref + last4,
 *    QRIS Dynamic poll status).
 *
 * What's intentionally NOT here (slice 4+):
 *  - Compose UI for the picker grid + per-method input dialogs.
 *  - The actual QRIS Dynamic poll loop — the backend doesn't
 *    expose a `/api/v1/payment/qris/:ref_id/status` endpoint
 *    yet. The state shape exists; the
 *    `viewModelScope`-bound poll lands with slice 5 wire-up.
 *  - Split-bill flow — split-bill isn't a [PaymentMethod] enum
 *    entry, so it can't be driven by the same `selectedMethod`
 *    pivot. It needs its own picker-mode toggle + UI surface
 *    and is layered on in a follow-up slice.
 *  - Transaction commit — the existing
 *    `apps/backend/src/routes/transactions.js` endpoint isn't
 *    wired through the checkout flow until slice 5.
 *  - Cart-aware filters (credit only allowed for non-walk-in
 *    customer, deposit only allowed when balance > 0, loyalty
 *    point only when points ≥ threshold). The catalogue
 *    indirection is already in place to layer those on top —
 *    a future slice will inject a cart-aware
 *    [PaymentMethodCatalog] decorator that further filters the
 *    output of [DefaultPaymentMethodCatalog].
 *  - Per-merchant allow-list filter — same indirection. Needs
 *    a backend org-config column or settings endpoint that
 *    doesn't exist yet; tracked as a green-risk follow-up.
 *
 * The catalogue is injected as a constructor arg so the
 * production Hilt graph wires the standard impl while unit
 * tests can pass a fake. The Hilt binding is provided in
 * `PosModule` (slice 2 — see
 * `apps/android/feature/pos/src/main/java/id/alviarts/vipos/feature/pos/di/PosModule.kt`).
 */
@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val catalog: PaymentMethodCatalog,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CheckoutUiState())
    val uiState: StateFlow<CheckoutUiState> = _uiState.asStateFlow()

    /**
     * Open the picker for a fresh cart.
     *
     * Snapshots [cartSubtotalIdr] + the catalogue projection at
     * the time of the call. Subsequent network state changes
     * (e.g. WiFi drops mid-pick) do NOT shrink the available
     * methods — the kasir's view of the picker stays stable
     * until [cancel] resets it.
     *
     * Calling [start] on a [CheckoutPickerStatus.Picking] or
     * [CheckoutPickerStatus.Picked] state is treated as a
     * "re-open with a fresh cart" — the previous selection is
     * cleared and the picker re-opens with the new subtotal +
     * a re-snapshotted catalogue. Useful when the kasir voids
     * the cart and starts a new transaction without leaving the
     * checkout flow.
     *
     * Calling [start] with a non-positive [cartSubtotalIdr] is
     * supported but the [CheckoutUiState.isReadyToCommit]
     * predicate stays `false` — the kasir would have to add
     * something to the cart before settling. The empty-cart
     * UX (showing a "cart kosong" banner instead of the picker
     * grid) is the slice-4 UI's call.
     */
    fun start(cartSubtotalIdr: Long, isOnline: Boolean) {
        _uiState.update {
            CheckoutUiState(
                cartSubtotalIdr = cartSubtotalIdr,
                availableMethods = catalog.availableMethods(isOnline = isOnline),
                pickerStatus = CheckoutPickerStatus.Picking,
                selectedMethod = null,
            )
        }
    }

    /**
     * Pick [method] in the open picker.
     *
     * Replaces any previous selection. Silently no-ops if:
     *  - the picker isn't open
     *    ([CheckoutPickerStatus.Picking] is the only writable
     *    state); or
     *  - [method] isn't in the snapshotted
     *    [CheckoutUiState.availableMethods] (defensive against
     *    a UI tap firing for a method that's been filtered out
     *    by the catalogue but still rendered in a stale frame).
     */
    fun selectMethod(method: PaymentMethod) {
        _uiState.update { state ->
            if (state.pickerStatus !is CheckoutPickerStatus.Picking) return@update state
            if (method !in state.availableMethods) return@update state
            state.copy(selectedMethod = method)
        }
    }

    /**
     * Clear the current pick without leaving the picker. The
     * kasir taps the highlighted card a second time (or hits a
     * "Reset" affordance) and the grid returns to the
     * unselected state.
     *
     * No-op when nothing is picked, or when the picker is not
     * open.
     */
    fun clearSelection() {
        _uiState.update { state ->
            if (state.pickerStatus !is CheckoutPickerStatus.Picking) return@update state
            if (state.selectedMethod == null) return@update state
            state.copy(selectedMethod = null)
        }
    }

    /**
     * Confirm the current pick and advance to the
     * method-specific input step.
     *
     * Lifecycle: `Picking → Picked`.
     *
     * Slice 3 — also seeds [CheckoutUiState.inputState] with a
     * fresh per-method default for the methods that need one
     * (cash, EDC, QRIS Dynamic). Methods that don't need a
     * per-method input (QRIS Statis, bank transfer, credit,
     * deposit, voucher, loyalty, other) advance to Picked with
     * [CheckoutUiState.inputState] left as `null`; the slice-4
     * UI surfaces a single-tap settle dialog for those instead.
     *
     * No-op when nothing is picked or when the picker is not
     * open. The slice-4 UI gates the CTA on
     * [CheckoutUiState.isReadyToConfirmMethod] so this path is
     * only exercisable from a valid state.
     */
    fun confirmSelection() {
        _uiState.update { state ->
            if (!state.isReadyToConfirmMethod) return@update state
            state.copy(
                pickerStatus = CheckoutPickerStatus.Picked,
                inputState = freshInputStateFor(state.selectedMethod),
            )
        }
    }

    /**
     * Re-open the picker after a [confirmSelection] without
     * losing the kasir's previous pick. Used by the slice-4 UI
     * "back" affordance to let the kasir change their method
     * after seeing the method-specific dialog.
     *
     * Lifecycle: `Picked → Picking`. Clears any
     * [CheckoutUiState.inputState] the kasir had filled in for
     * the previous method — re-confirming the same method
     * starts the input state fresh, since persisting half-typed
     * tendered amounts across method-pivots leads to "huh, why
     * does the cash dialog already have a number?" UX
     * confusion.
     *
     * No-op when not in [CheckoutPickerStatus.Picked] (i.e. the
     * picker is already open or the flow hasn't started yet).
     */
    fun reopenPicker() {
        _uiState.update { state ->
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            state.copy(
                pickerStatus = CheckoutPickerStatus.Picking,
                inputState = null,
            )
        }
    }

    /**
     * Update tendered IDR for an in-flight cash payment.
     *
     * No-op when the picker hasn't advanced past
     * [CheckoutPickerStatus.Picked] for [PaymentMethod.CASH] or
     * when [CheckoutUiState.inputState] isn't a
     * [CheckoutInputState.CashInput]. Negative tendered values
     * are clamped to zero so the cash dialog can never show a
     * negative tendered field.
     */
    fun setCashTendered(tenderedIdr: Long) {
        val clamped = if (tenderedIdr < 0L) 0L else tenderedIdr
        _uiState.update { state ->
            val current = state.inputState
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            if (current !is CheckoutInputState.CashInput) return@update state
            state.copy(inputState = current.copy(tenderedIdr = clamped))
        }
    }

    /**
     * Update the EDC approval/ref number for an in-flight EDC
     * payment.
     *
     * No-op when [CheckoutUiState.inputState] isn't a
     * [CheckoutInputState.EdcInput] or when the picker hasn't
     * advanced past [CheckoutPickerStatus.Picked]. The string
     * is stored verbatim — leading/trailing whitespace is only
     * trimmed at validation time so the kasir can paste a ref
     * with a trailing newline without the field rejecting it.
     */
    fun setEdcApprovalRef(approvalRef: String) {
        _uiState.update { state ->
            val current = state.inputState
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            if (current !is CheckoutInputState.EdcInput) return@update state
            state.copy(inputState = current.copy(approvalRef = approvalRef))
        }
    }

    /**
     * Update the optional last-4-of-card field for an in-flight
     * EDC payment. Pass `null` to clear it.
     *
     * No-op when the slice-4 dialog isn't open against a
     * [CheckoutInputState.EdcInput]. Length validation is the
     * UI's job — this just persists whatever the kasir typed.
     */
    fun setEdcLast4(last4: String?) {
        _uiState.update { state ->
            val current = state.inputState
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            if (current !is CheckoutInputState.EdcInput) return@update state
            state.copy(inputState = current.copy(last4 = last4))
        }
    }

    /**
     * Persist a gateway-reported QRIS Dynamic poll status into
     * the in-flight checkout state.
     *
     * The full poll loop ([viewModelScope]-bound, owns the
     * timer + retry logic) lands with slice 5 wire-up; this
     * mutator is what each poll tick calls into. Slice-4 tests
     * also drive it directly to simulate the gateway timeline.
     *
     * No-op when the slice-4 dialog isn't open against a
     * [CheckoutInputState.QrisDynamicInput].
     */
    fun setQrisStatus(refId: String?, status: QrisPollStatus) {
        _uiState.update { state ->
            val current = state.inputState
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            if (current !is CheckoutInputState.QrisDynamicInput) return@update state
            state.copy(inputState = current.copy(refId = refId, status = status))
        }
    }

    /**
     * Reset the entire flow back to [CheckoutPickerStatus.Idle].
     * Called when the kasir dismisses the checkout sheet/screen.
     * Clears the snapshotted subtotal + available methods so a
     * subsequent [start] always sees a fresh state.
     */
    fun cancel() {
        _uiState.update { CheckoutUiState() }
    }

    /**
     * Map a confirmed [PaymentMethod] to the per-method input
     * state shape the slice-4 UI expects. Returns `null` for
     * methods that don't need a per-method input (single-tap
     * settle in slice 4).
     */
    private fun freshInputStateFor(method: PaymentMethod?): CheckoutInputState? = when (method) {
        PaymentMethod.CASH -> CheckoutInputState.CashInput()
        PaymentMethod.EDC -> CheckoutInputState.EdcInput()
        PaymentMethod.QRIS_DYNAMIC -> CheckoutInputState.QrisDynamicInput()
        else -> null
    }
}
