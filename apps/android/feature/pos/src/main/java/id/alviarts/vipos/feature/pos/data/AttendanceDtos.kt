package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for attendance/check-in endpoints (P4-06).
 */

@Serializable
data class AttendanceCheckInRequestDto(
    @SerialName("latitude") val latitude: Double,
    @SerialName("longitude") val longitude: Double,
    @SerialName("selfie_url") val selfieUrl: String? = null,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class AttendanceCheckOutRequestDto(
    @SerialName("latitude") val latitude: Double,
    @SerialName("longitude") val longitude: Double,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class AttendanceLogDto(
    @SerialName("id") val id: Long,
    @SerialName("employee_id") val employeeId: Long,
    @SerialName("check_in_at") val checkInAt: String? = null,
    @SerialName("check_out_at") val checkOutAt: String? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class AttendanceListResponseDto(
    @SerialName("data") val data: List<AttendanceLogDto>,
    @SerialName("total") val total: Int = 0,
)
