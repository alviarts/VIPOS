package id.alviarts.vipos.feature.auth.domain

/**
 * Domain-level user model exposed by the auth feature (P3-03a).
 *
 * The wire DTO ([id.alviarts.vipos.feature.auth.data.AuthUserDto])
 * is mapped here at the repository boundary so that downstream
 * callers (UI, ViewModels, other features) never need to know
 * about Retrofit / kotlinx-serialization annotations.
 */
data class AuthUser(
    val id: Long,
    val username: String,
    val name: String,
    val role: String,
    val tenantId: Long?,
)
