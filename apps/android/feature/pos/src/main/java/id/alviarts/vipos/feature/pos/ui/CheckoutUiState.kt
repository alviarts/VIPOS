package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.PaymentMethod

/**
 * UI state for the checkout / payment-method picker
 * (P3-08 second slice — picker state-machine).
 *
 * The checkout flow is opened from the kasir-flow "Bayar"
 * button on [PosCatalogueScreen]; the ViewModel that owns this
 * state is [CheckoutViewModel] and survives configuration change
 * but not the checkout sheet/screen being dismissed.
 *
 * The state holds four orthogonal axes:
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
 *    so the lifecycle is `Idle → Picking → Picked`. The slice-3
 *    method-specific input state (cash tendered, QRIS poll,
 *    etc.) lands in a separate sub-state owned by
 *    [CheckoutViewModel].
 *  - [selectedMethod] — the currently-picked method, or `null`
 *    when nothing is picked yet. The Compose layer that lands
 *    in slice 4 reads this to highlight the chosen card in the
 *    grid.
 *
 * Readiness predicates are derived properties so the UI layer
 * has a single source of truth.
 */
data class CheckoutUiState(
    val cartSubtotalIdr: Long = 0,
    val availableMethods: List<PaymentMethod> = emptyList(),
    val pickerStatus: CheckoutPickerStatus = CheckoutPickerStatus.Idle,
    val selectedMethod: PaymentMethod? = null,
) {
    /**
     * `true` when the kasir has picked a method and the cart is
     * non-empty. Gates the "Lanjut" / "Bayar" CTA on the picker
     * screen — slice-4 UI work.
     *
     * Note that "ready to commit" here means "ready to advance to
     * the method-specific input step" (e.g. cash tendered entry,
     * QRIS QR display); the actual transaction commit only fires
     * once the slice-3 method-specific state has filled in (e.g.
     * tendered ≥ subtotal for cash).
     */
    val isReadyToCommit: Boolean
        get() = pickerStatus is CheckoutPickerStatus.Picking &&
            selectedMethod != null &&
            cartSubtotalIdr > 0

    /**
     * `true` when the runtime is in a state where the picker grid
     * should be visible. False before [CheckoutViewModel.start]
     * has been called (Idle) and false again after the kasir has
     * dismissed/cancelled the picker.
     */
    val isPickerOpen: Boolean
        get() = pickerStatus is CheckoutPickerStatus.Picking
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
