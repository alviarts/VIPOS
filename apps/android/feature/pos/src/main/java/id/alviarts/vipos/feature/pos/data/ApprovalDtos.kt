package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for approval workflow (P4-08).
 */

@Serializable
data class ApprovalItemDto(
    @SerialName("id") val id: Long,
    @SerialName("type") val type: String,
    @SerialName("description") val description: String? = null,
    @SerialName("requester_name") val requesterName: String? = null,
    @SerialName("status") val status: String = "pending",
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class ApprovalListResponseDto(
    @SerialName("data") val data: List<ApprovalItemDto>,
    @SerialName("total") val total: Int = 0,
)

@Serializable
data class ApprovalDecisionRequestDto(
    @SerialName("decision") val decision: String, // "approve" or "reject"
    @SerialName("reason") val reason: String? = null,
)
