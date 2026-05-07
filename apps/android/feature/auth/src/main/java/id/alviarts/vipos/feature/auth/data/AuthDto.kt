package id.alviarts.vipos.feature.auth.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the `/api/v1/auth/...` endpoints (P3-03a).
 *
 * These mirror the backend handlers in `apps/backend/src/routes/auth.js`
 * verbatim — field names and casing match the backend's JSON output
 * (snake_case via `@SerialName`) so kotlinx-serialization parses
 * cleanly without renaming.
 */

@Serializable
data class LoginRequestDto(
    @SerialName("username") val username: String,
    @SerialName("password") val password: String,
    @SerialName("remember_me") val rememberMe: Boolean = false,
)

/**
 * Backend can return one of two shapes:
 *  - normal login → `token`, `refresh_token`, `expires_in`, `user`
 *  - 2FA challenge → `requires_2fa: true`, `login_token`
 *
 * All fields are nullable so kotlinx-serialization parses both
 * variants into the same DTO; the AuthRepository inspects
 * [requires2fa] to decide which branch was returned.
 *
 * The repository converts this DTO into a sealed
 * [id.alviarts.vipos.feature.auth.domain.LoginResult] so callers
 * never see this DTO shape directly.
 */
@Serializable
data class LoginResponseDto(
    @SerialName("requires_2fa") val requires2fa: Boolean = false,
    @SerialName("login_token") val loginToken: String? = null,
    @SerialName("token") val token: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
    @SerialName("user") val user: AuthUserDto? = null,
)

@Serializable
data class AuthUserDto(
    @SerialName("id") val id: Long,
    @SerialName("username") val username: String,
    @SerialName("name") val name: String? = null,
    @SerialName("role") val role: String? = null,
    @SerialName("tenant_id") val tenantId: Long? = null,
)

@Serializable
data class LogoutRequestDto(
    @SerialName("refresh_token") val refreshToken: String,
)

/**
 * Wire-shape for the refresh-token rotation request (P3-03e).
 *
 * The backend's POST /api/v1/auth/refresh accepts the persisted
 * refresh token, revokes it, and issues a fresh access + refresh
 * token pair (response shape identical to /login — [LoginResponseDto]
 * is reused). The old refresh token cannot be reused after a
 * successful rotation; this is enforced server-side via
 * `replaced_by` linkage in the `refresh_tokens` table.
 */
@Serializable
data class RefreshRequestDto(
    @SerialName("refresh_token") val refreshToken: String,
)

/**
 * Wire-shape for the 2FA continuation request (P3-03c).
 *
 * The backend's POST /api/v1/auth/login/2fa expects the
 * `login_token` returned by the initial /login response plus
 * the 6-digit TOTP code from the user's authenticator. The
 * remember_me flag mirrors the /login one — when true the
 * issued refresh token gets the long TTL.
 */
@Serializable
data class Verify2FARequestDto(
    @SerialName("login_token") val loginToken: String,
    @SerialName("code") val code: String,
    @SerialName("remember_me") val rememberMe: Boolean = false,
)
