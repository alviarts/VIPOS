package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for inventory management (P4-03, P4-04).
 * 
 * Covers:
 * - Stock movements (stok_in, stok_out, opname)
 * - Stock opname (physical count)
 */

// -- Stock Movements (P4-03) ----------------------------------

@Serializable
data class InventoryMovementDto(
    @SerialName("id") val id: Long,
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String? = null,
    @SerialName("product_sku") val productSku: String? = null,
    @SerialName("product_satuan") val productSatuan: String? = null,
    @SerialName("tipe") val tipe: String, // stok_in, stok_out, opname
    @SerialName("qty") val qty: Int,
    @SerialName("tanggal") val tanggal: String,
    @SerialName("keterangan") val keterangan: String? = null,
    @SerialName("unit_cost") val unitCost: Long? = null,
    @SerialName("reason") val reason: String? = null,
    @SerialName("stok_sebelum") val stokSebelum: Int? = null,
    @SerialName("stok_sesudah") val stokSesudah: Int? = null,
    @SerialName("user_id") val userId: Long? = null,
    @SerialName("user_name") val userName: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class InventoryMovementCreateRequestDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("tipe") val tipe: String, // stok_in, stok_out, opname
    @SerialName("qty") val qty: Int,
    @SerialName("tanggal") val tanggal: String,
    @SerialName("keterangan") val keterangan: String? = null,
    @SerialName("unit_cost") val unitCost: Long? = null,
    @SerialName("reason") val reason: String? = null,
)

@Serializable
data class InventorySummaryDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String,
    @SerialName("product_sku") val productSku: String? = null,
    @SerialName("current_stock") val currentStock: Int,
    @SerialName("min_stock") val minStock: Int? = null,
    @SerialName("avg_cost") val avgCost: Long? = null,
    @SerialName("total_value") val totalValue: Long? = null,
    @SerialName("last_movement_date") val lastMovementDate: String? = null,
)

// -- Stock Opname (P4-04) -------------------------------------

@Serializable
data class StockOpnameDto(
    @SerialName("id") val id: Long,
    @SerialName("kode") val kode: String,
    @SerialName("tanggal") val tanggal: String,
    @SerialName("status") val status: String, // draft, finalized
    @SerialName("keterangan") val keterangan: String? = null,
    @SerialName("created_by") val createdBy: Long? = null,
    @SerialName("created_by_name") val createdByName: String? = null,
    @SerialName("finalized_by") val finalizedBy: Long? = null,
    @SerialName("finalized_by_name") val finalizedByName: String? = null,
    @SerialName("finalized_at") val finalizedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("item_count") val itemCount: Int = 0,
    @SerialName("counted_count") val countedCount: Int = 0,
    @SerialName("variance_count") val varianceCount: Int = 0,
    @SerialName("items") val items: List<StockOpnameItemDto> = emptyList(),
)

@Serializable
data class StockOpnameItemDto(
    @SerialName("id") val id: Long? = null,
    @SerialName("opname_id") val opnameId: Long? = null,
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String? = null,
    @SerialName("product_sku") val productSku: String? = null,
    @SerialName("product_satuan") val productSatuan: String? = null,
    @SerialName("qty_sistem") val qtySistem: Int,
    @SerialName("qty_fisik") val qtyFisik: Int? = null,
    @SerialName("selisih") val selisih: Int? = null,
    @SerialName("keterangan") val keterangan: String? = null,
)

@Serializable
data class StockOpnameCreateRequestDto(
    @SerialName("tanggal") val tanggal: String,
    @SerialName("keterangan") val keterangan: String? = null,
    @SerialName("product_ids") val productIds: List<Long>? = null, // null = all products
)

@Serializable
data class StockOpnameUpdateItemRequestDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("qty_fisik") val qtyFisik: Int,
    @SerialName("keterangan") val keterangan: String? = null,
)

@Serializable
data class StockOpnameFinalizeRequestDto(
    @SerialName("apply_adjustments") val applyAdjustments: Boolean = true,
)
