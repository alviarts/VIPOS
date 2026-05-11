package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for outlet management (P4-11).
 * 
 * Covers:
 * - Outlet list and detail
 * - Outlet CRUD operations
 * - Outlet switching
 */

@Serializable
data class OutletDto(
    @SerialName("id") val id: Long,
    @SerialName("code") val code: String? = null,
    @SerialName("name") val name: String,
    @SerialName("type") val type: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("city") val city: String? = null,
    @SerialName("province") val province: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("tax_npwp") val taxNpwp: String? = null,
    @SerialName("timezone") val timezone: String? = null,
    @SerialName("currency") val currency: String? = null,
    @SerialName("is_main") val isMain: Boolean,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class OutletCreateRequestDto(
    @SerialName("code") val code: String? = null,
    @SerialName("name") val name: String,
    @SerialName("type") val type: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("city") val city: String? = null,
    @SerialName("province") val province: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("tax_npwp") val taxNpwp: String? = null,
    @SerialName("timezone") val timezone: String? = "Asia/Jakarta",
    @SerialName("currency") val currency: String? = "IDR",
    @SerialName("is_main") val isMain: Boolean = false,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class OutletUpdateRequestDto(
    @SerialName("code") val code: String? = null,
    @SerialName("name") val name: String? = null,
    @SerialName("type") val type: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("city") val city: String? = null,
    @SerialName("province") val province: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("tax_npwp") val taxNpwp: String? = null,
    @SerialName("timezone") val timezone: String? = null,
    @SerialName("currency") val currency: String? = null,
    @SerialName("is_main") val isMain: Boolean? = null,
    @SerialName("is_active") val isActive: Boolean? = null,
)

@Serializable
data class OutletSwitchRequestDto(
    @SerialName("outlet_id") val outletId: Long,
)

@Serializable
data class OutletSwitchResponseDto(
    @SerialName("message") val message: String,
    @SerialName("outlet_id") val outletId: Long,
    @SerialName("outlet_name") val outletName: String,
)
