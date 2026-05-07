package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.PaymentMethod

/**
 * UI state for the checkout / payment-method picker
 * (P3-08 second slice — picker state-machine; third slice —
 * method-specific input state).
 *
 * The checkout flow is opened from the kasir-flow "Bayar"
 * button on [PosCatalogueScreen]; the ViewModel that owns this
 * state is [CheckoutViewModel] and survives configuration change
 * but not the checkout sheet/screen being dismissed.
 *
 * The state holds five orthogonal axes:
 *
 *  - [cartSubtotalIdr] — the total to settle, snapshotted from
 *    the catalogue at "Bayar" tap. Stays fixed for the life of
 *    this state instance; modifying the cart from inside the
 *    checkout screen is out of scope (cart edits land in the
 *    catalogue route, not here).
 *  - [availableMethods] — the methods currently pickable in this
 *    runtime (online state, merchant allow-list, cart-aware
 *    filters). Snapshotted on [CheckoutPickerStatus.Idle] →
 *    [CheckoutPickerStatus.Picking] transition; never re-derived
 *    while the picker is open so a network blip doesn't yank a
 *    method out from under the kasir mid-pick.
 *  - [pickerStatus] — the lifecycle of the picker. The picker is
 *    purely client-side (no fetch needed; the [availableMethods]
 *    list is computed from the slice-1
 *    [id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog]),
 *    so the lifecycle is `Idle → Picking → Picked`.
 *  - [selectedMethod] — the currently-picked method, or `null`
 *    when nothing is picked yet. The Compose layer that lands
 *    in slice 4 reads this to highlight the chosen card in the
 *    grid.
 *  - [inputState] — method-specific input state captured during
 *    the second step of the flow (cash tendered, EDC ref, QRIS
 *    poll status, split rows). `null` while the picker is open
 *    or the picked method doesn't need a per-method input
 *    (slice 4 surfaces a single-tap settle for those). Reset
 *    on every method-pivot — see [CheckoutViewModel.selectMethod]
 *    + [CheckoutViewModel.reopenPicker].
 *
 * Readiness predicates are derived properties so the UI layer
 * has a single source of truth.
 */
data class CheckoutUiState(
    val cartSubtotalIdr: Long = 0,
    val availableMethods: List<PaymentMethod> = emptyList(),
    val pickerStatus: CheckoutPickerStatus = CheckoutPickerStatus.Idle,
    val selectedMethod: PaymentMethod? = null,
    val inputState: CheckoutInputState? = null,
) {
    /**
     * `true` when the kasir has picked a method and the cart is
     * non-empty. Gates the "Lanjut" CTA on the picker screen —
     * slice-4 UI work.
     *
     * "Ready to confirm method" means "ready to advance to the
     * method-specific input step" (e.g. cash tendered entry,
     * QRIS QR display); the actual transaction commit gate is
     * [isReadyForCommit], which additionally validates the
     * filled-in [inputState].
     */
    val isReadyToConfirmMethod: Boolean
        get() = pickerStatus is CheckoutPickerStatus.Picking &&
            selectedMethod != null &&
            cartSubtotalIdr > 0

    /**
     * Back-compat alias for the slice-2 name. Kept so the
     * slice-2 contract stays stable for any reader (no consumer
     * yet — the picker UI lands in slice 4). New code should
     * prefer [isReadyToConfirmMethod] for the picker step + the
     * dedicated [isReadyForCommit] for the actual commit gate.
     */
    val isReadyToCommit: Boolean
        get() = isReadyToConfirmMethod

    /**
     * `true` when the picker has advanced to the per-method
     * input step *and* the input state validates against the
     * snapshotted [cartSubtotalIdr]:
     *
     *  - Cash:    tendered > 0 *and* tendered ≥ subtotal.
     *  - EDC:     approval ref non-blank.
     *  - QRIS:    poll status == [QrisPollStatus.Paid].
     *  - Split:   rows non-empty, every row > 0, sum == subtotal.
     *
     * Drives the slice-4 "Bayar" CTA on the per-method dialog.
     * Stays `false` while [pickerStatus] is [CheckoutPickerStatus.Picking];
     * the kasir must confirm the method before any commit is
     * possible.
     */
    val isReadyForCommit: Boolean
        get() = pickerStatus is CheckoutPickerStatus.Picked &&
            selectedMethod != null &&
            cartSubtotalIdr > 0 &&
            (inputState?.isValid(cartSubtotalIdr) ?: !selectedMethodRequiresInput())

    /**
     * `true` when the runtime is in a state where the picker grid
     * should be visible. False before [CheckoutViewModel.start]
     * has been called (Idle) and false again after the kasir has
     * dismissed/cancelled the picker.
     */
    val isPickerOpen: Boolean
        get() = pickerStatus is CheckoutPickerStatus.Picking

    /**
     * Methods that need the kasir to type something / wait for
     * the gateway before committing. All other methods are
     * single-tap settle and don't carry an [inputState] (slice 4
     * UI shows a confirmation dialog instead of an input form).
     *
     * Split-bill isn't a [PaymentMethod] entry — it's a parallel
     * flow that distributes the subtotal across several methods —
     * and is wired in a separate follow-up slice (see slice 3
     * handoff notes).
     */
    private fun selectedMethodRequiresInput(): Boolean = when (selectedMethod) {
        PaymentMethod.CASH,
        PaymentMethod.EDC,
        PaymentMethod.QRIS_DYNAMIC,
        -> true
        else -> false
    }
}

/**
 * Sealed lifecycle for the payment-method picker.
 *
 *  - [Idle]    — the ViewModel was constructed but no checkout
 *                has been started yet (e.g. the kasir hasn't
 *                tapped "Bayar"). The picker grid should NOT be
 *                rendered.
 *  - [Picking] — checkout has started; the picker grid is
 *                rendered and the kasir can pick or change
 *                their method. [CheckoutUiState.availableMethods]
 *                is populated and stable for the duration of
 *                this state.
 *  - [Picked]  — the kasir has confirmed their pick and advanced
 *                to the method-specific input step (slice 3).
 *                The picker grid should NOT re-render. Going
 *                back from Picked to Picking re-opens the grid
 *                with the previous selection still highlighted.
 */
sealed interface CheckoutPickerStatus {
    data object Idle : CheckoutPickerStatus
    data object Picking : CheckoutPickerStatus
    data object Picked : CheckoutPickerStatus
}
