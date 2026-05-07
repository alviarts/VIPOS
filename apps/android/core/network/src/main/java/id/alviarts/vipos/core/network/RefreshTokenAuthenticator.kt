package id.alviarts.vipos.core.network

import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * OkHttp [Authenticator] that exchanges the persisted refresh
 * token for a new access token on a 401, then retries the
 * original request with the rotated bearer (P3-03e).
 *
 * This is the canonical OkHttp 401-retry hook — it runs after a
 * response carries `WWW-Authenticate` (or any 401), gets a
 * chance to mutate the request, and OkHttp transparently retries
 * with the returned [Request]. Returning `null` propagates the
 * original 401 unchanged, so:
 *
 *  - Refresh succeeds → caller sees a 200 (or whatever the
 *    re-attempt returned). The application interceptors
 *    ([AuthInterceptor], [SessionInvalidationInterceptor]) see
 *    only the final, successful response; no session-clear
 *    callback fires.
 *  - Refresh fails → original 401 reaches the application
 *    interceptors. [SessionInvalidationInterceptor] then clears
 *    the persisted session and the user is bounced back to
 *    login.
 *
 * **Skip rules** (each returns `null`, propagating the 401
 * untouched):
 *
 *  1. **Loop guard** — if the response chain shows we've already
 *     retried this request once via `priorResponse`, we don't
 *     try again. Avoids an infinite refresh→401→refresh loop
 *     when refresh keeps "succeeding" but the access token it
 *     returns is itself invalid.
 *  2. **Refresh + auth bootstrap paths** — a 401 from
 *     `/auth/login`, `/auth/login/2fa`, or `/auth/refresh` is
 *     "credentials rejected," not "session expired." Don't try
 *     to refresh on those (defense in depth — the production
 *     wiring also sends `/refresh` through a separate OkHttp
 *     client without this Authenticator, but matching the
 *     skip-list keeps the unit-test surface honest).
 *  3. **`refreshAndSave` returns null** — refresh failed for any
 *     reason (no persisted refresh token, backend 401, network
 *     error, malformed body). Return `null` so the original 401
 *     surfaces and `SessionInvalidationInterceptor` clears the
 *     session.
 *
 * The retried request is built from `response.request.newBuilder()`
 * with a fresh `Authorization: Bearer <newAccessToken>` stamp.
 * [AuthInterceptor]'s rule 1 ("honour an existing
 * `Authorization` header") then short-circuits and the new
 * token reaches the wire as-is.
 *
 * @param refreshAndSave synchronous bridge to the suspending
 *   `AuthRepository.refresh()` (production wiring uses
 *   `runBlocking` on OkHttp's IO dispatcher). Returns the new
 *   access token on success, or `null` on any failure mode.
 */
class RefreshTokenAuthenticator(
    private val refreshAndSave: () -> String?,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        if (priorResponseCount(response) >= MAX_RETRIES) {
            return null
        }
        if (!shouldAttemptRefresh(response.request)) {
            return null
        }
        val newAccessToken = refreshAndSave() ?: return null
        return response.request.newBuilder()
            .header("Authorization", "Bearer $newAccessToken")
            .build()
    }

    private fun shouldAttemptRefresh(request: Request): Boolean {
        val path = request.url.encodedPath
        return REFRESH_SKIP_PATH_SUFFIXES.none { path.endsWith(it) }
    }

    private fun priorResponseCount(response: Response): Int {
        var count = 0
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    private companion object {
        // Cap at one refresh attempt per logical request. OkHttp
        // chains retries via Response.priorResponse — counting
        // ancestors lets the Authenticator detect "I've already
        // been here" without external state.
        private const val MAX_RETRIES: Int = 1

        // Endpoints whose 401 must NOT trigger a refresh attempt.
        // Mirrors `SessionInvalidationInterceptor`'s skip-list and
        // `AuthInterceptor`'s unauthenticated-path list — the
        // three lists move together by design.
        private val REFRESH_SKIP_PATH_SUFFIXES: List<String> = listOf(
            "/auth/login",
            "/auth/login/2fa",
            "/auth/refresh",
        )
    }
}
