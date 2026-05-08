package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for inventory mutation endpoints (P4-03 + P4-04).
 */

// -- Inventory movements (P4-03) ------------------------------

@Serializable
data class InventoryMovementDto(
    @SerialName("id") val id: Long,
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String? = null,
    @SerialName("type") val type: String, // "in", "out", "transfer", "adjustment"
    @SerialName("quantity") val quantity: Int,
    @SerialName("reason") val reason: String? = null,
    @SerialName("reference") val reference: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class InventoryMovementListDto(
    @SerialName("data") val data: List<InventoryMovementDto>,
    @SerialName("total") val total: Int = 0,
)

@Serializable
data class InventoryMutationRequestDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("type") val type: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("reason") val reason: String? = null,
)

// -- Stock opname (P4-04) -------------------------------------

@Serializable
data class StockOpnameItemDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String? = null,
    @SerialName("system_stock") val systemStock: Int = 0,
    @SerialName("physical_stock") val physicalStock: Int? = null,
    @SerialName("variance") val variance: Int? = null,
)

@Serializable
data class StockOpnameSessionDto(
    @SerialName("id") val id: Long,
    @SerialName("status") val status: String = "open",
    @SerialName("items") val items: List<StockOpnameItemDto> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class StockOpnameSubmitItemDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("physical_stock") val physicalStock: Int,
)

@Serializable
data class StockOpnameSubmitRequestDto(
    @SerialName("items") val items: List<StockOpnameSubmitItemDto>,
)
