package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for tenant configuration endpoint.
 */

@Serializable
data class TenantConfigResponseDto(
    @SerialName("config") val config: Map<String, String> = emptyMap(),
)

@Serializable
data class TenantConfigUpdateResponseDto(
    @SerialName("updated") val updated: List<String> = emptyList(),
)
