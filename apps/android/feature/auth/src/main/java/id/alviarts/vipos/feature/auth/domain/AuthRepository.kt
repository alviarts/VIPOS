package id.alviarts.vipos.feature.auth.domain

import id.alviarts.vipos.feature.auth.data.AuthApi
import id.alviarts.vipos.feature.auth.data.AuthUserDto
import id.alviarts.vipos.feature.auth.data.LoginRequestDto
import id.alviarts.vipos.feature.auth.data.LoginResponseDto
import id.alviarts.vipos.feature.auth.data.LogoutRequestDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository facade for the auth feature (P3-03a).
 *
 * Encapsulates the network call → token persistence → DTO
 * mapping pipeline so call-sites (LoginViewModel in P3-03b) deal
 * only in domain types.
 *
 * The class is `@Singleton` because the persisted token snapshot
 * is logically global to the app — multiple LoginViewModels
 * across the lifecycle of the process must agree on whether a
 * user is currently authenticated.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokenStorage: TokenStorage,
) {

    /** Whether a user appears to be authenticated based on the
     *  persisted token snapshot. Does NOT validate the token
     *  against the backend — call-sites that need that should
     *  fire a refresh-token rotation. */
    val isAuthenticated: Flow<Boolean> =
        tokenStorage.tokens.map { it != null }

    /**
     * Attempt a username/password login.
     *
     * On [LoginResult.Success] the access + refresh tokens are
     * already persisted to [TokenStorage] before this returns —
     * no extra wiring is required for subsequent authenticated
     * requests to find them.
     *
     * Network failures (`IOException`) and HTTP errors
     * (`HttpException`) are caught and converted into
     * [LoginResult.Failure] so call-sites never need a try/catch.
     */
    suspend fun login(
        username: String,
        password: String,
        rememberMe: Boolean = false,
    ): LoginResult = try {
        val response = api.login(
            LoginRequestDto(
                username = username,
                password = password,
                rememberMe = rememberMe,
            ),
        )
        response.toLoginResult().also { result ->
            if (result is LoginResult.Success) {
                tokenStorage.save(
                    AuthTokens(
                        accessToken = result.accessToken,
                        refreshToken = response.refreshToken
                            ?: error("Backend returned token without refresh_token"),
                        accessExpiresAtEpochSec =
                            (System.currentTimeMillis() / 1000) +
                                (response.expiresIn ?: ACCESS_TOKEN_TTL_FALLBACK_SEC),
                    ),
                )
            }
        }
    } catch (e: HttpException) {
        LoginResult.Failure(
            message = "Login gagal (HTTP ${e.code()})",
            throwable = e,
        )
    } catch (e: IOException) {
        LoginResult.Failure(
            message = "Tidak bisa terhubung ke server",
            throwable = e,
        )
    }

    /**
     * Invalidate the current session.
     *
     * Best-effort: even if the network call fails, the local
     * tokens are cleared so the next launch lands on the login
     * screen. The backend's refresh-token row is reaped by the
     * standard expiry sweep regardless.
     */
    suspend fun logout(): Boolean {
        val tokens = tokenStorage.read() ?: return true
        return try {
            api.logout(
                bearer = "Bearer ${tokens.accessToken}",
                request = LogoutRequestDto(refreshToken = tokens.refreshToken),
            )
            true
        } catch (_: HttpException) {
            false
        } catch (_: IOException) {
            false
        } finally {
            tokenStorage.clear()
        }
    }

    private fun LoginResponseDto.toLoginResult(): LoginResult = when {
        requires2fa && loginToken != null -> LoginResult.Requires2FA(loginToken)
        token != null && user != null -> LoginResult.Success(
            user = user.toDomain(),
            accessToken = token,
        )
        else -> LoginResult.Failure(
            message = "Respons login dari server tidak dikenal",
        )
    }

    private fun AuthUserDto.toDomain(): AuthUser = AuthUser(
        id = id,
        username = username,
        name = name ?: username,
        role = role ?: "unknown",
        tenantId = tenantId,
    )

    private companion object {
        /** If the server omits `expires_in`, assume the documented
         *  default in `apps/backend/src/utils/tokens.js`
         *  (`ACCESS_TOKEN_TTL_SECONDS = 900` ≈ 15 minutes). */
        const val ACCESS_TOKEN_TTL_FALLBACK_SEC = 900L
    }
}
