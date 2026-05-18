package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for Kitchen Display System (P5-01 through P5-04).
 *
 * The KDS shows incoming order tickets from the POS and lets
 * kitchen staff bump them through status stages:
 *   NEW -> IN_PROGRESS -> READY -> SERVED
 */

@Serializable
data class KdsTicketDto(
    @SerialName("id") val id: Long,
    @SerialName("order_number") val orderNumber: String,
    @SerialName("table_number") val tableNumber: String? = null,
    @SerialName("status") val status: String = "NEW",
    @SerialName("items") val items: List<KdsTicketItemDto> = emptyList(),
    @SerialName("notes") val notes: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("priority") val priority: Int = 0,
)

@Serializable
data class KdsTicketItemDto(
    @SerialName("product_name") val productName: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("modifiers") val modifiers: String? = null,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class KdsTicketListResponseDto(
    @SerialName("data") val data: List<KdsTicketDto>,
)

@Serializable
data class KdsBumpRequestDto(
    @SerialName("status") val status: String, // "IN_PROGRESS", "READY", "SERVED"
)
