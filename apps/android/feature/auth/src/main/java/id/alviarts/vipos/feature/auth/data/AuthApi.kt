package id.alviarts.vipos.feature.auth.data

import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * Retrofit interface for the `/api/v1/auth/...` endpoints
 * (P3-03a + P3-03c + P3-03e).
 *
 * The backend's `auth.js` router (mounted under `/api/v1/auth`)
 * exposes:
 *  - `POST /login`     — username + password (+ optional remember_me)
 *  - `POST /login/2fa` — continuation when /login returned `requires_2fa`
 *  - `POST /refresh`   — exchange persisted refresh token for a new
 *                        access + refresh token pair (rotation)
 *  - `POST /logout`    — invalidates the supplied refresh token
 *
 * Both the 2FA continuation and `/refresh` reuse the /login response
 * shape (token + refresh_token + expires_in + user), so the
 * repository folds them into a single [LoginResponseDto].
 */
interface AuthApi {
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequestDto): LoginResponseDto

    @POST("api/v1/auth/login/2fa")
    suspend fun verify2fa(@Body request: Verify2FARequestDto): LoginResponseDto

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequestDto): LoginResponseDto

    @POST("api/v1/auth/logout")
    suspend fun logout(
        @Header("Authorization") bearer: String,
        @Body request: LogoutRequestDto,
    )
}
