package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the `GET /api/v1/transactions` endpoint
 * (P4-05).
 *
 * Mirrors the backend handler in `apps/backend/src/routes/transactions.js`.
 * The endpoint returns a paged envelope with transaction list and pagination metadata.
 */
@Serializable
data class TransactionHistoryItemDto(
    @SerialName("id") val id: Long,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("user_id") val userId: Long,
    @SerialName("cashier_name") val cashierName: String? = null,
    @SerialName("total_amount") val totalAmount: Long,
    @SerialName("payment_amount") val paymentAmount: Long,
    @SerialName("change_amount") val changeAmount: Long,
    @SerialName("payment_method") val paymentMethod: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("cashier_shift_id") val cashierShiftId: Long? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class TransactionHistoryPaginationDto(
    @SerialName("total") val total: Long,
    @SerialName("page") val page: Int,
    @SerialName("limit") val limit: Int,
    @SerialName("total_pages") val totalPages: Int,
)

@Serializable
data class TransactionHistoryResponseDto(
    @SerialName("data") val data: List<TransactionHistoryItemDto> = emptyList(),
    @SerialName("pagination") val pagination: TransactionHistoryPaginationDto,
)

/**
 * Transaction detail with items (for single transaction view).
 */
@Serializable
data class TransactionItemDto(
    @SerialName("id") val id: Long,
    @SerialName("transaction_id") val transactionId: Long,
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("price") val price: Long,
    @SerialName("subtotal") val subtotal: Long,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class TransactionDetailDto(
    @SerialName("id") val id: Long,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("user_id") val userId: Long,
    @SerialName("cashier_name") val cashierName: String? = null,
    @SerialName("total_amount") val totalAmount: Long,
    @SerialName("payment_amount") val paymentAmount: Long,
    @SerialName("change_amount") val changeAmount: Long,
    @SerialName("payment_method") val paymentMethod: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("cashier_shift_id") val cashierShiftId: Long? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("items") val items: List<TransactionItemDto> = emptyList(),
)
