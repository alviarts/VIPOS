package id.alviarts.vipos.feature.pos.domain

/**
 * Per-cart context that gates a few [PaymentMethod] entries.
 *
 * Captured at picker-render time and passed through
 * [CartAwarePaymentMethodCatalog]. Three predicates currently
 * matter:
 *
 *  - **Credit (`piutang`)** is only offered for a registered
 *    customer. A walk-in (no customer record on the cart) can't
 *    settle on credit because there's no party to bill later.
 *  - **Deposit** requires the customer's deposit balance to be
 *    strictly positive — settling against a `Rp 0` balance
 *    would only enqueue a top-up, not pay the bill.
 *  - **Loyalty point** requires the customer's accumulated
 *    points to meet the merchant's redeem threshold. Below the
 *    threshold, the option is hidden so the kasir doesn't pick
 *    it and have the backend reject the redemption at commit
 *    time.
 *
 * The other twelve [PaymentMethod] entries (cash, EDC, QRIS,
 * e-wallets, bank transfer, voucher, other) don't depend on
 * cart state, so they pass through unchanged from the inner
 * catalogue.
 */
data class CartContext(
    /** `true` if the cart has no associated customer (anonymous walk-in). */
    val isWalkInCustomer: Boolean,
    /**
     * The customer's available deposit balance in IDR
     * (whole-rupiah). Zero or negative means the customer
     * can't settle by deposit on this cart.
     */
    val customerDepositBalanceIdr: Long,
    /**
     * Loyalty points the customer has accumulated. Compared
     * against [loyaltyPointsRedeemThreshold] to decide whether
     * the LOYALTY_POINT method is offered.
     */
    val customerLoyaltyPoints: Long,
    /**
     * Merchant-configured minimum points before redemption is
     * allowed. Defaults to `0` so a fresh merchant config doesn't
     * accidentally disable the option for everyone.
     */
    val loyaltyPointsRedeemThreshold: Long = 0,
) {
    companion object {
        /**
         * Sensible default for an anonymous walk-in cart with no
         * customer record attached. Filters out CREDIT, DEPOSIT,
         * and LOYALTY_POINT.
         */
        val WALK_IN: CartContext = CartContext(
            isWalkInCustomer = true,
            customerDepositBalanceIdr = 0L,
            customerLoyaltyPoints = 0L,
            loyaltyPointsRedeemThreshold = 0L,
        )
    }
}

/**
 * [PaymentMethodCatalog] decorator that further filters the
 * output of an [inner] catalogue using per-cart predicates.
 *
 * The inner catalogue typically [DefaultPaymentMethodCatalog]
 * (gates on `isOnline`); this decorator chains on top and
 * additionally drops:
 *
 *  - [PaymentMethod.CREDIT] when [CartContext.isWalkInCustomer]
 *    is `true`.
 *  - [PaymentMethod.DEPOSIT] when
 *    [CartContext.customerDepositBalanceIdr] `<= 0`.
 *  - [PaymentMethod.LOYALTY_POINT] when
 *    [CartContext.customerLoyaltyPoints]
 *    `<` [CartContext.loyaltyPointsRedeemThreshold].
 *
 * The constructor takes a [contextProvider] (rather than a
 * frozen [CartContext]) so a single [PaymentMethodCatalog]
 * binding can serve every cart through its lifetime — the
 * provider is queried per `availableMethods` call. This matches
 * the way Hilt expects to bind catalogues at the singleton
 * scope while still letting the cart layer push fresh state
 * each time the picker re-renders.
 *
 * Order from the inner catalogue is preserved (filters can only
 * remove entries, never re-order them) so the picker layout
 * stays deterministic across cart-context changes.
 */
class CartAwarePaymentMethodCatalog(
    private val inner: PaymentMethodCatalog,
    private val contextProvider: () -> CartContext,
) : PaymentMethodCatalog {

    override fun availableMethods(isOnline: Boolean): List<PaymentMethod> {
        val context = contextProvider()
        return inner.availableMethods(isOnline).filter { method -> isAllowed(method, context) }
    }

    private fun isAllowed(method: PaymentMethod, context: CartContext): Boolean = when (method) {
        PaymentMethod.CREDIT -> !context.isWalkInCustomer
        PaymentMethod.DEPOSIT -> context.customerDepositBalanceIdr > 0L
        PaymentMethod.LOYALTY_POINT ->
            context.customerLoyaltyPoints >= context.loyaltyPointsRedeemThreshold &&
                context.loyaltyPointsRedeemThreshold > 0L
        else -> true
    }
}
