package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for customer endpoints (P3-16).
 *
 * Mirrors the backend handlers in
 * `apps/backend/src/routes/customers.js`.
 */

@Serializable
data class CustomerDto(
    @SerialName("id") val id: Long,
    @SerialName("kode") val kode: String? = null,
    @SerialName("name") val name: String,
    @SerialName("phone") val phone: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("points") val points: Long = 0,
    @SerialName("deposit") val deposit: Double = 0.0,
)

@Serializable
data class CustomerListResponseDto(
    @SerialName("data") val data: List<CustomerDto>,
    @SerialName("total") val total: Int = 0,
)

@Serializable
data class CustomerCreateRequestDto(
    @SerialName("name") val name: String,
    @SerialName("phone") val phone: String? = null,
)
