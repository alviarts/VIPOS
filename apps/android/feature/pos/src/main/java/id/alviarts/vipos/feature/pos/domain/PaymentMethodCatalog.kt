package id.alviarts.vipos.feature.pos.domain

/**
 * Source of the [PaymentMethod] entries that are *currently
 * pickable* in the kasir-flow checkout (P3-08 first slice).
 *
 * The catalogue is the place where global enum membership
 * ([PaymentMethod] entries) is filtered down to the subset that
 * makes sense for the *current request* — the kasir's network
 * state, the merchant's enabled-method allow-list (later slice),
 * and any per-cart constraints (e.g. credit only allowed for a
 * non-walk-in customer; deposit only allowed when the customer
 * has a positive balance).
 *
 * This first slice ships the no-merchant-allow-list / no-cart
 * variant: every entry in [PaymentMethod] is in scope, gated
 * only on whether the device has working connectivity. The
 * cart-aware filters (credit, deposit, loyalty point) and the
 * merchant-allow-list filter (kedai-kopi enables a subset) are
 * layered on in the ViewModel slice.
 */
fun interface PaymentMethodCatalog {
    /**
     * Snapshot of the currently-pickable methods, ordered for
     * presentation in a top-down picker grid (most-used first
     * → least-used last). Returns an empty list iff the runtime
     * is in a state where no method can possibly settle, which
     * shouldn't happen for the default impl since cash is always
     * available.
     *
     * @param isOnline whether the device currently has reachable
     *   network. When `false`, methods with
     *   [PaymentMethod.requiresOnline] = `true` are filtered out.
     */
    fun availableMethods(isOnline: Boolean): List<PaymentMethod>
}

/**
 * Default in-memory [PaymentMethodCatalog] backed by the static
 * [PaymentMethod] enum.
 *
 * Order is the canonical kasir-flow priority, derived from
 * `docs/v2/14_PAYMENT_METHODS.md` §1 plus the ordering convention
 * used elsewhere in the workflow docs:
 *
 * 1. Cash — universal default, fastest path.
 * 2. EDC — second most common across F&B + retail.
 * 3. QRIS Dinamis — preferred QR channel (auto-verifies).
 * 4. QRIS Statis — fallback for merchants without dynamic gateway.
 * 5. GoPay / OVO / DANA / ShopeePay / LinkAja — e-wallets in
 *    market-share order (GoPay first per most recent
 *    Snapshot.id-based ranking).
 * 6. Bank Transfer — typical for B2B / repeat-customer flows.
 * 7. Credit / Deposit / Voucher / Loyalty — internal-credit
 *    flows, less frequent in walk-in retail.
 * 8. Other — manual catch-all.
 *
 * The ordering is encoded as the iteration order of [PaymentMethod.entries]
 * (Kotlin enums preserve declaration order), which is why
 * [PaymentMethod] is laid out the way it is. Re-ordering the enum
 * re-orders the picker.
 */
object DefaultPaymentMethodCatalog : PaymentMethodCatalog {
    override fun availableMethods(isOnline: Boolean): List<PaymentMethod> =
        if (isOnline) {
            PaymentMethod.entries.toList()
        } else {
            PaymentMethod.entries.filterNot { it.requiresOnline }
        }
}
