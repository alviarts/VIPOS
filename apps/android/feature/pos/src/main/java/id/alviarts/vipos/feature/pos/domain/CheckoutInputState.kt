package id.alviarts.vipos.feature.pos.domain

/**
 * Method-specific input state captured during the second step
 * of the checkout flow (P3-08 third slice).
 *
 * The picker (slice 2) is the kasir's first step — they choose
 * *which* method (cash / EDC / QRIS Dynamic / …). Once
 * confirmed, the flow advances to a per-method input dialog
 * where they fill in whatever the method needs to settle:
 *
 *  - **Cash** — enter tendered amount, see computed change.
 *  - **EDC manual** — enter approval ref, optionally last 4 of
 *    the card.
 *  - **QRIS Dynamic** — wait for the gateway to mint a QR, then
 *    poll the gateway for paid / expired status.
 *
 * Other methods either don't need a per-method input state
 * (QRIS Statis = manual confirm; Bank transfer / Credit /
 * Deposit / Voucher / Loyalty / Other = single-tap settle in
 * the slice-4 UI) or are layered on later (e-wallet variants
 * ride QRIS Dynamic per the v2 spec recommendation §7).
 *
 * **Out of scope for slice 3**: split-bill flow. Split-bill
 * isn't a [PaymentMethod] enum entry — it's a parallel flow
 * that distributes the cart subtotal across multiple methods,
 * each row carrying its own [PaymentMethod] + amount. It needs
 * its own picker mode + UI surface (toggling between
 * "single-method" and "split" picker shapes) and is layered on
 * in a follow-up slice once the single-method flow is stable.
 *
 * The input state lives as a nullable field on
 * [id.alviarts.vipos.feature.pos.ui.CheckoutUiState];
 * [id.alviarts.vipos.feature.pos.ui.CheckoutViewModel.confirmSelection]
 * initialises it with the freshest per-method default + the
 * snapshotted cart subtotal, and the slice-4 UI mutates it
 * through the dedicated `setCash…` / `setEdc…` / `setQris…`
 * ViewModel methods.
 *
 * Each entry exposes:
 *  - `isValid(cartSubtotalIdr)` — predicate gating the actual
 *    transaction commit. Used by
 *    [id.alviarts.vipos.feature.pos.ui.CheckoutUiState.isReadyForCommit]
 *    so the slice-4 UI can colour the "Bayar" CTA.
 *  - `changeIdr(cartSubtotalIdr)` (cash only) — derived change
 *    due. Returned `0` when tendered < subtotal so the cash
 *    dialog never displays a negative change line; the gating
 *    predicate is what actually blocks commit.
 *
 * Validation is intentionally *advisory* in the data layer —
 * the ViewModel's mutators don't refuse out-of-range inputs
 * (e.g. tendered < subtotal still gets stored). The Compose
 * UI in slice 4 reads the derived `isValid` predicate to gate
 * the CTA + render the inline error banner. Keeping the data
 * shape permissive lets the kasir type a partial number
 * without the input field rejecting keystrokes.
 */
sealed interface CheckoutInputState {

    /**
     * `true` iff the input state is sufficient for the
     * transaction commit to fire, given the current
     * [cartSubtotalIdr]. The slice-4 UI gates the "Bayar" CTA
     * on this predicate.
     */
    fun isValid(cartSubtotalIdr: Long): Boolean

    /**
     * Cash payment — kasir types tendered amount, app shows
     * change.
     *
     * @property tenderedIdr tendered amount in IDR (whole
     *   rupiah). 0 by default so the dialog opens with an
     *   empty field. The "kasir hasn't typed yet" state is
     *   `0L` rather than nullable to keep the Compose
     *   keyboard binding simple.
     */
    data class CashInput(
        val tenderedIdr: Long = 0L,
    ) : CheckoutInputState {

        /**
         * Change due back to the customer. Returns 0 when
         * tendered < subtotal so the dialog never shows a
         * negative number; the [isValid] predicate is what
         * actually gates commit in that case.
         */
        fun changeIdr(cartSubtotalIdr: Long): Long {
            val raw = tenderedIdr - cartSubtotalIdr
            return if (raw < 0L) 0L else raw
        }

        override fun isValid(cartSubtotalIdr: Long): Boolean =
            tenderedIdr >= cartSubtotalIdr && tenderedIdr > 0L
    }

    /**
     * EDC card payment in manual mode — kasir processes the
     * card on the EDC machine itself, then types the approval
     * reference (and optionally the last 4 digits) into the
     * app for the receipt + settlement reconciliation log.
     *
     * @property approvalRef the EDC's approval/ref number.
     *   Required to commit; trimmed before validation.
     * @property last4 last 4 digits of the card. Optional —
     *   improves reconciliation but isn't required.
     */
    data class EdcInput(
        val approvalRef: String = "",
        val last4: String? = null,
    ) : CheckoutInputState {

        override fun isValid(cartSubtotalIdr: Long): Boolean =
            cartSubtotalIdr > 0L && approvalRef.trim().isNotEmpty()
    }

    /**
     * QRIS Dynamic payment — gateway mints a per-transaction
     * QR keyed on a `refId`, app renders QR + polls
     * `/api/v1/payment/qris/:ref_id/status` until the gateway
     * confirms paid / expired.
     *
     * The mutators in the ViewModel just persist the latest
     * gateway-reported state into [status]; the actual
     * `viewModelScope`-bound polling loop lands with the
     * slice-5 wire-up since it needs the gateway endpoint
     * (which the backend doesn't expose yet — see
     * `docs/handoff/2026-05-07-p3-08-second-slice-checkout-viewmodel.md`
     * Outstanding backlog).
     *
     * @property refId gateway-issued reference id. `null`
     *   while [status] is [QrisPollStatus.Generating]; set
     *   once the gateway mint succeeds.
     * @property status the lifecycle of the QR. Drives the
     *   slice-4 UI's "loading / awaiting payment / paid /
     *   expired / failed" state machine.
     */
    data class QrisDynamicInput(
        val refId: String? = null,
        val status: QrisPollStatus = QrisPollStatus.Generating,
    ) : CheckoutInputState {

        override fun isValid(cartSubtotalIdr: Long): Boolean =
            cartSubtotalIdr > 0L && status == QrisPollStatus.Paid
    }
}

/**
 * Sealed lifecycle for the QRIS Dynamic poll loop.
 *
 *  - [Generating] — waiting for the gateway to mint a QR. The
 *    slice-4 UI shows a spinner and the QR area is empty.
 *  - [Awaiting]   — QR rendered, waiting for the customer to
 *    scan + pay. Poll is in flight in the background.
 *  - [Paid]       — gateway confirmed the customer paid.
 *    Terminal success state.
 *  - [Expired]    — QR aged out (default 5 min per v2-14 §6).
 *    Slice-4 UI lets the kasir regenerate.
 *  - [Failed]     — gateway returned an unrecoverable error.
 *    Carries a user-facing message for the error banner.
 */
sealed interface QrisPollStatus {
    data object Generating : QrisPollStatus
    data object Awaiting : QrisPollStatus
    data object Paid : QrisPollStatus
    data object Expired : QrisPollStatus
    data class Failed(val message: String) : QrisPollStatus
}
