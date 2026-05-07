package id.alviarts.vipos.feature.pos.domain

/**
 * Canonical inventory of payment methods the kasir can pick at
 * checkout (P3-08 first slice — data layer).
 *
 * The enum entries mirror the `code` column from
 * `docs/v2/14_PAYMENT_METHODS.md` §1 verbatim. The same code is
 * stored on the backend's `transactions.payment_method` column
 * and on every `transaction_payments` row, so any new entry here
 * MUST also be added to the backend's allow-list before merge —
 * otherwise the kasir can pick a method that the server rejects
 * at commit time. The current backend route
 * (`apps/backend/src/routes/transactions.js`) accepts an
 * arbitrary string and defaults to `cash`, so the enum is the
 * stricter contract until the backend gains its own validation.
 *
 * Methods that require a live network connection
 * ([requiresOnline] = `true`) are filtered out of the catalogue
 * when the device is offline; see [PaymentMethodCatalog]. Methods
 * that don't (cash, EDC manual, QRIS Statis, deposit, voucher,
 * loyalty point, custom) stay available even on a flaky link so
 * the kasir can keep ringing transactions through.
 *
 * Per-merchant availability (e.g. a kedai-kopi merchant only
 * enables cash + QRIS Dynamic + GoPay) is layered on top of this
 * inventory in a later slice — this enum is the *superset* that
 * the platform supports, not the *subset* a particular merchant
 * has turned on.
 */
enum class PaymentMethod(
    /** Stable code persisted to the backend (snake-screaming). */
    val code: String,
    /** Indonesian display label shown in the picker. */
    val displayLabel: String,
    /** `true` if the method needs a live HTTP round-trip to settle. */
    val requiresOnline: Boolean,
) {
    CASH(code = "CASH", displayLabel = "Tunai", requiresOnline = false),
    EDC(code = "EDC", displayLabel = "Kartu (EDC)", requiresOnline = false),
    QRIS_STATIC(code = "QRIS_STATIC", displayLabel = "QRIS Statis", requiresOnline = false),
    QRIS_DYNAMIC(code = "QRIS_DYNAMIC", displayLabel = "QRIS Dinamis", requiresOnline = true),
    GOPAY(code = "GOPAY", displayLabel = "GoPay", requiresOnline = true),
    OVO(code = "OVO", displayLabel = "OVO", requiresOnline = true),
    DANA(code = "DANA", displayLabel = "DANA", requiresOnline = true),
    SHOPEEPAY(code = "SHOPEEPAY", displayLabel = "ShopeePay", requiresOnline = true),
    LINKAJA(code = "LINKAJA", displayLabel = "LinkAja", requiresOnline = true),
    BANK_TRANSFER(code = "BANK_TRANSFER", displayLabel = "Transfer Bank", requiresOnline = false),
    CREDIT(code = "CREDIT", displayLabel = "Piutang", requiresOnline = false),
    DEPOSIT(code = "DEPOSIT", displayLabel = "Deposit", requiresOnline = false),
    VOUCHER(code = "VOUCHER", displayLabel = "Voucher", requiresOnline = false),
    LOYALTY_POINT(code = "LOYALTY_POINT", displayLabel = "Poin Loyalty", requiresOnline = false),
    OTHER(code = "OTHER", displayLabel = "Lainnya", requiresOnline = false),
    ;

    companion object {
        /**
         * Resolve a code string back to its enum entry.
         *
         * Returns `null` for an unknown code rather than throwing
         * so the caller can decide whether an unfamiliar code is a
         * hard error (e.g. a bug to surface) or a soft fallback
         * (e.g. show "Lainnya" with the raw label as a hint).
         */
        fun fromCode(code: String): PaymentMethod? =
            entries.firstOrNull { it.code == code }
    }
}
