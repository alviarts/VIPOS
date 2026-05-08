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
    @SerialName("ref_no") val refNo: String,
    @SerialName("channel") val channel: String? = null,
    @SerialName("external_ref") val externalRef: String? = null,
    @SerialName("order_type") val orderType: String? = null,
    @SerialName("table_no") val tableNo: String? = null,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("customer_address") val customerAddress: String? = null,
    @SerialName("delivery_zone") val deliveryZone: String? = null,
    @SerialName("delivery_fee") val deliveryFee: Long = 0,
    @SerialName("subtotal") val subtotal: Long = 0,
    @SerialName("discount") val discount: Long = 0,
    @SerialName("service_charge") val serviceCharge: Long = 0,
    @SerialName("tax") val tax: Long = 0,
    @SerialName("total") val total: Long = 0,
    @SerialName("payment_method") val paymentMethod: String? = null,
    @SerialName("payment_status") val paymentStatus: String? = null,
    @SerialName("status") val status: String = "NEW",
    @SerialName("sla_minutes") val slaMinutes: Int? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("accepted_at") val acceptedAt: String? = null,
    @SerialName("ready_at") val readyAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("cancelled_at") val cancelledAt: String? = null,
    @SerialName("cancel_reason") val cancelReason: String? = null,
    @SerialName("reject_reason") val rejectReason: String? = null,
    @SerialName("item_count") val itemCount: Int = 0,
    @SerialName("items") val items: List<OnlineOrderItemDto> = emptyList(),
)

@Serializable
data class OnlineOrderItemDto(
    @SerialName("id") val id: Long? = null,
    @SerialName("order_id") val orderId: Long? = null,
    @SerialName("product_id") val productId: Long? = null,
    @SerialName("product_name") val productName: String,
    @SerialName("qty") val qty: Int,
    @SerialName("price") val price: Long,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class OnlineOrderListResponseDto(
    @SerialName("items") val items: List<OnlineOrderDto>,
    @SerialName("total") val total: Int = 0,
)

@Serializable
data class OnlineOrderActionRequestDto(
    @SerialName("action") val action: String? = null,
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
