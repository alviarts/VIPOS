package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for online order queue (P4-01) and
 * reservation/appointment (P4-02).
 */

// -- Online orders (P4-01) ------------------------------------

@Serializable
data class OnlineOrderDto(
    @SerialName("id") val id: Long,
    @SerialName("order_number") val orderNumber: String,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("status") val status: String = "pending",
    @SerialName("total_amount") val totalAmount: Long = 0,
    @SerialName("notes") val notes: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("items") val items: List<OnlineOrderItemDto> = emptyList(),
)

@Serializable
data class OnlineOrderItemDto(
    @SerialName("product_name") val productName: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("price") val price: Long,
)

@Serializable
data class OnlineOrderListResponseDto(
    @SerialName("data") val data: List<OnlineOrderDto>,
    @SerialName("total") val total: Int = 0,
)

@Serializable
data class OnlineOrderActionRequestDto(
    @SerialName("action") val action: String, // "accept", "reject", "ready"
    @SerialName("reason") val reason: String? = null,
)

// -- Reservations / Appointments (P4-02) ----------------------

@Serializable
data class AppointmentDto(
    @SerialName("id") val id: Long,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("service_name") val serviceName: String? = null,
    @SerialName("date") val date: String,
    @SerialName("time") val time: String? = null,
    @SerialName("status") val status: String = "confirmed",
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class AppointmentListResponseDto(
    @SerialName("data") val data: List<AppointmentDto>,
    @SerialName("total") val total: Int = 0,
)
