package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

/**
 * Drives the payment-method picker (P3-08 second slice).
 *
 * Responsibilities (this slice):
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
 *
 * What's intentionally NOT here (slice 3+):
 *  - Method-specific input state (cash tendered + change math,
 *    EDC ref-no entry, QRIS Dynamic poll loop, split-bill row
 *    state).
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
 * `PosModule` (this slice — see
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
     * method-specific input step (slice 3 territory — this slice
     * just flips the lifecycle from `Picking` to `Picked`).
     *
     * No-op when nothing is picked or when the picker is not
     * open. The slice-4 UI gates the CTA on
     * [CheckoutUiState.isReadyToCommit] so this path is only
     * exercisable from a valid state.
     */
    fun confirmSelection() {
        _uiState.update { state ->
            if (!state.isReadyToCommit) return@update state
            state.copy(pickerStatus = CheckoutPickerStatus.Picked)
        }
    }

    /**
     * Re-open the picker after a [confirmSelection] without
     * losing the kasir's previous pick. Used by the slice-4 UI
     * "back" affordance to let the kasir change their method
     * after seeing the method-specific dialog.
     *
     * No-op when not in [CheckoutPickerStatus.Picked] (i.e. the
     * picker is already open or the flow hasn't started yet).
     */
    fun reopenPicker() {
        _uiState.update { state ->
            if (state.pickerStatus !is CheckoutPickerStatus.Picked) return@update state
            state.copy(pickerStatus = CheckoutPickerStatus.Picking)
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
}
