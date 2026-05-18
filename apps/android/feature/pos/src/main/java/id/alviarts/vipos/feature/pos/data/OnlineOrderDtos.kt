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
    @SerialName("ref_no") val refNo: String,
    @SerialName("customer_id") val customerId: Long? = null,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("customer_email") val customerEmail: String? = null,
    @SerialName("staff_id") val staffId: Long? = null,
    @SerialName("staff_name") val staffName: String? = null,
    @SerialName("staff_color") val staffColor: String? = null,
    @SerialName("resource_id") val resourceId: Long? = null,
    @SerialName("resource_name") val resourceName: String? = null,
    @SerialName("start_at") val startAt: String,
    @SerialName("end_at") val endAt: String? = null,
    @SerialName("duration_minutes") val durationMinutes: Int? = null,
    @SerialName("status") val status: String = "PENDING",
    @SerialName("deposit_amount") val depositAmount: Long = 0,
    @SerialName("deposit_paid") val depositPaid: Boolean = false,
    @SerialName("total") val totalAmount: Long = 0, // Backend uses "total" not "total_amount"
    @SerialName("notes") val notes: String? = null,
    @SerialName("internal_notes") val internalNotes: String? = null,
    @SerialName("cancel_reason") val cancelReason: String? = null,
    @SerialName("transaction_id") val transactionId: Long? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("confirmed_at") val confirmedAt: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("cancelled_at") val cancelledAt: String? = null,
    @SerialName("services") val services: List<AppointmentServiceDto> = emptyList(),
)

@Serializable
data class AppointmentServiceDto(
    @SerialName("id") val id: Long? = null,
    @SerialName("product_id") val productId: Long? = null,
    @SerialName("service_name") val serviceName: String,
    @SerialName("qty") val qty: Int = 1,
    @SerialName("price") val price: Long,
    @SerialName("duration_minutes") val durationMinutes: Int? = null,
    @SerialName("subtotal") val subtotal: Long,
)

@Serializable
data class AppointmentListResponseDto(
    @SerialName("data") val data: List<AppointmentDto>,
    @SerialName("total") val total: Int = 0,
    @SerialName("page") val page: Int = 1,
    @SerialName("limit") val limit: Int = 20,
)

@Serializable
data class AppointmentCreateRequestDto(
    @SerialName("customer_id") val customerId: Long? = null,
    @SerialName("customer_name") val customerName: String,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("customer_email") val customerEmail: String? = null,
    @SerialName("staff_id") val staffId: Long? = null,
    @SerialName("resource_id") val resourceId: Long? = null,
    @SerialName("start_at") val startAt: String,
    @SerialName("duration_minutes") val durationMinutes: Int? = null,
    @SerialName("services") val services: List<AppointmentServiceRequestDto>,
    @SerialName("deposit_amount") val depositAmount: Long = 0,
    @SerialName("notes") val notes: String? = null,
    @SerialName("internal_notes") val internalNotes: String? = null,
)

@Serializable
data class AppointmentServiceRequestDto(
    @SerialName("product_id") val productId: Long? = null,
    @SerialName("service_name") val serviceName: String,
    @SerialName("qty") val qty: Int = 1,
    @SerialName("price") val price: Long,
    @SerialName("duration_minutes") val durationMinutes: Int? = null,
)

@Serializable
data class AppointmentActionRequestDto(
    @SerialName("reason") val reason: String? = null,
    @SerialName("new_start_at") val newStartAt: String? = null,
    @SerialName("new_duration_minutes") val newDurationMinutes: Int? = null,
)
