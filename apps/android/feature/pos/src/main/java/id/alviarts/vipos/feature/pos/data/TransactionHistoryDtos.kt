package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for transaction history (P4-05).
 */

@Serializable
data class TransactionListItemDto(
    @SerialName("id") val id: Long,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("total_amount") val totalAmount: Long,
    @SerialName("payment_method") val paymentMethod: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("cashier_name") val cashierName: String? = null,
)

@Serializable
data class TransactionListResponseDto(
    @SerialName("data") val data: List<TransactionListItemDto>,
    @SerialName("total") val total: Int = 0,
    @SerialName("page") val page: Int = 1,
)
