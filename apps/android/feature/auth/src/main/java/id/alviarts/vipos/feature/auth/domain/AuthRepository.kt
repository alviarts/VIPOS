package id.alviarts.vipos.feature.auth.domain

import id.alviarts.vipos.feature.auth.data.AuthApi
import id.alviarts.vipos.feature.auth.data.AuthUserDto
import id.alviarts.vipos.feature.auth.data.LoginRequestDto
import id.alviarts.vipos.feature.auth.data.LoginResponseDto
import id.alviarts.vipos.feature.auth.data.LogoutRequestDto
import id.alviarts.vipos.feature.auth.data.Verify2FARequestDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository facade for the auth feature (P3-03a + P3-03d).
 *
 * Encapsulates the network call → token persistence → DTO
 * mapping pipeline so call-sites (LoginViewModel in P3-03b,
 * SessionViewModel in P3-03d) deal only in domain types.
 *
 * The class is `@Singleton` because the persisted session
 * snapshot is logically global to the app — multiple
 * ViewModels across the lifecycle of the process must agree on
 * whether a user is currently authenticated.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: AuthApi,
    private val tokenStorage: TokenStorage,
) {

    /** Whether a user appears to be authenticated based on the
     *  persisted session snapshot. Does NOT validate the token
     *  against the backend — call-sites that need that should
     *  fire a refresh-token rotation. */
    val isAuthenticated: Flow<Boolean> =
        tokenStorage.sessions.map { it != null }

    /**
     * Cold-start auto-login (P3-03d).
     *
     * Reads the persisted session bundle once. Returns the user
     * snapshot if the bundle is present **and** the access token
     * has not yet expired (with a small safety margin so we
     * don't hand a request a token that expires mid-flight).
     *
     * On expired tokens: today this returns `null` and forces a
     * fresh login. The refresh-token rotation flow (re-issuing
     * an access token from the persisted refresh token) lands as
     * its own follow-up — keeping that out of cold-start avoids
     * blocking the splash → home transition behind a network
     * round-trip in the common-case fast path.
     *
     * On corrupt or partial bundles (e.g., older installs that
     * never wrote the user fields): [TokenStorage] returns null
     * and the user lands on the login screen exactly once.
     */
    suspend fun restoreSession(): AuthUser? {
        val session = tokenStorage.read() ?: return null
        val nowSec = System.currentTimeMillis() / 1000
        val expiresAt = session.tokens.accessExpiresAtEpochSec
        return if (expiresAt - nowSec >= ACCESS_TOKEN_RESTORE_MARGIN_SEC) {
            session.user
        } else {
            null
        }
    }

    /**
     * Attempt a username/password login.
     *
     * On [LoginResult.Success] the access + refresh tokens **and**
     * the user snapshot are persisted to [TokenStorage] before
     * this returns — no extra wiring is required for subsequent
     * authenticated requests to find them or for the next cold
     * start to skip the login screen via [restoreSession].
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
                    AuthSession(
                        tokens = AuthTokens(
                            accessToken = result.accessToken,
                            refreshToken = response.refreshToken
                                ?: error("Backend returned token without refresh_token"),
                            accessExpiresAtEpochSec =
                                (System.currentTimeMillis() / 1000) +
                                    (response.expiresIn ?: ACCESS_TOKEN_TTL_FALLBACK_SEC),
                        ),
                        user = result.user,
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
     * Continue a login flow that previously returned
     * [LoginResult.Requires2FA] (P3-03c).
     *
     * The `login_token` from the initial /login response is
     * exchanged plus the user's 6-digit TOTP code for a real
     * access + refresh token bundle. On success the bundle is
     * persisted to [TokenStorage] before this returns, mirroring
     * the [login] happy path so the caller can route straight
     * into the home destination.
     *
     * The backend's /login/2fa response shape is identical to
     * /login (token + refresh_token + expires_in + user) so the
     * same DTO mapper folds both into [LoginResult.Success]. A
     * second `requires_2fa: true` is impossible per the backend
     * contract — but if it ever happened the mapper would
     * surface it as a fresh [LoginResult.Requires2FA] and the
     * caller could re-prompt.
     */
    suspend fun verify2fa(
        loginToken: String,
        code: String,
        rememberMe: Boolean = false,
    ): LoginResult = try {
        val response = api.verify2fa(
            Verify2FARequestDto(
                loginToken = loginToken,
                code = code,
                rememberMe = rememberMe,
            ),
        )
        response.toLoginResult().also { result ->
            if (result is LoginResult.Success) {
                tokenStorage.save(
                    AuthSession(
                        tokens = AuthTokens(
                            accessToken = result.accessToken,
                            refreshToken = response.refreshToken
                                ?: error("Backend returned token without refresh_token"),
                            accessExpiresAtEpochSec =
                                (System.currentTimeMillis() / 1000) +
                                    (response.expiresIn ?: ACCESS_TOKEN_TTL_FALLBACK_SEC),
                        ),
                        user = result.user,
                    ),
                )
            }
        }
    } catch (e: HttpException) {
        // Backend returns 401 on wrong code or expired login_token;
        // surface a friendly Indonesian copy. The body would be
        // `{ "error": "Kode 2FA salah" }` but we keep the wording
        // local to the app so a backend rewording doesn't change
        // user-facing copy.
        LoginResult.Failure(
            message = if (e.code() == 401) {
                "Kode 2FA salah atau sesi sudah berakhir"
            } else {
                "Verifikasi 2FA gagal (HTTP ${e.code()})"
            },
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
        val session = tokenStorage.read() ?: return true
        return try {
            api.logout(
                bearer = "Bearer ${session.tokens.accessToken}",
                request = LogoutRequestDto(refreshToken = session.tokens.refreshToken),
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

        /** Don't restore a session whose access token expires
         *  within this margin — the next request would race the
         *  refresh flow. Ten seconds is plenty for the splash →
         *  home navigation to settle. */
        const val ACCESS_TOKEN_RESTORE_MARGIN_SEC = 10L
    }
}
