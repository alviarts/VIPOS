package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the `POST /api/v1/transactions` endpoint
 * (P3-08 slice 5b).
 *
 * Mirrors the backend handler in `apps/backend/src/routes/transactions.js`:
 *
 *  - Request body: `{ items: [{product_id, price, quantity}],
 *    payment_amount, payment_method?, notes? }`
 *  - Response 201: `{ id, invoice_number, total_amount,
 *    payment_amount, change_amount, payment_method, notes,
 *    status, created_at, cashier_name, items: [...] }`
 *
 * The backend only validates a small subset of these fields
 * (allow-list on `payment_method` per
 * `apps/backend/src/lib/payment-methods.js`, stock + payment
 * arithmetic on the items). The kasir UI consumes even less —
 * only `invoice_number`, `total_amount`, and `change_amount` are
 * surfaced to the cashier on the success toast — so the response
 * DTO models just those plus `id` (for follow-up queries) and
 * `payment_method` (sanity-check that the server canonicalised
 * the code we sent). Unknown fields are silently dropped via
 * `NetworkClientFactory.json`'s `ignoreUnknownKeys = true`.
 */

/**
 * One item line on the commit payload. Backend computes
 * `subtotal = price * quantity` server-side, so we only send the
 * unit price (post-uplift) and quantity.
 */
@Serializable
data class TransactionRequestItemDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("price") val price: Long,
    @SerialName("quantity") val quantity: Int,
)

/**
 * Body of `POST /api/v1/transactions`.
 *
 * `paymentAmount` is the IDR the kasir collected. For cash this
 * is the tendered amount (≥ subtotal so the backend can compute
 * change); for non-cash methods it equals the cart subtotal
 * exactly (the gateway / EDC took the full amount, no change
 * due). The backend rejects with 400 if `paymentAmount <
 * sum(items.price * items.quantity)`.
 *
 * `paymentMethod` is the canonical Android code (e.g. `"CASH"`,
 * `"QRIS_DYNAMIC"`); the backend's allow-list (loop #3 PR #236)
 * accepts both legacy lowercase + canonical uppercase. The
 * Android side always sends canonical.
 */
@Serializable
data class TransactionRequestDto(
    @SerialName("items") val items: List<TransactionRequestItemDto>,
    @SerialName("payment_amount") val paymentAmount: Long,
    @SerialName("payment_method") val paymentMethod: String,
    @SerialName("notes") val notes: String? = null,
)

/**
 * 201 response from `POST /api/v1/transactions`. Only the fields
 * the kasir actually surfaces on the receipt toast are modelled;
 * the rest of the row (created_at, status, cashier_name, items
 * detail, etc.) is silently dropped by the `ignoreUnknownKeys`
 * converter.
 */
@Serializable
data class TransactionResponseDto(
    @SerialName("id") val id: Long,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("total_amount") val totalAmount: Long,
    @SerialName("payment_amount") val paymentAmount: Long,
    @SerialName("change_amount") val changeAmount: Long,
    @SerialName("payment_method") val paymentMethod: String,
)
