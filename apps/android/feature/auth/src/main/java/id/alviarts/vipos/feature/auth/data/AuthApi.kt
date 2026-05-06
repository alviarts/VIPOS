package id.alviarts.vipos.feature.auth.data

import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * Retrofit interface for the `/api/v1/auth/...` endpoints (P3-03a).
 *
 * The backend's `auth.js` router (mounted under `/api/v1/auth`)
 * exposes:
 *  - `POST /login`  — username + password (+ optional remember_me)
 *  - `POST /logout` — invalidates the supplied refresh token
 *
 * For the data-layer scaffold we only wire the username/password
 * happy path. The 2FA continuation (`POST /login/2fa`) lands later
 * in P3-03c when the LoginScreen UI gates on the `requires_2fa`
 * branch returned by the server.
 */
interface AuthApi {
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequestDto): LoginResponseDto

    @POST("api/v1/auth/logout")
    suspend fun logout(
        @Header("Authorization") bearer: String,
        @Body request: LogoutRequestDto,
    )
}
