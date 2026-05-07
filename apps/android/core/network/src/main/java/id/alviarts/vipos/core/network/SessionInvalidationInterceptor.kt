package id.alviarts.vipos.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp [Interceptor] that observes 401 responses and notifies
 * the application that the persisted session is no longer valid
 * (P3-03f).
 *
 * Pairs naturally with [AuthInterceptor] (P3-06) — the request
 * side stamps `Authorization: Bearer <accessToken>` on every
 * authenticated call, and this interceptor catches the
 * server-side rejection that arrives when that token has been
 * revoked (admin force-logout) or has expired past the safety
 * margin baked into [AuthInterceptor]'s caller.
 *
 * On a 401 from an authenticated endpoint, the
 * [onSessionInvalidated] callback fires exactly once per
 * response. Production wiring in `:app/AppModule` clears
 * `TokenStorage` from the callback so:
 *
 *  1. Subsequent in-flight requests carry no Bearer (since
 *     [AuthInterceptor] reads the cleared token and falls
 *     through to "no auth header").
 *  2. The reactive `tokenStorage.sessions` Flow emits `null`,
 *     which `SessionViewModel` observes — `SessionGate` then
 *     rebuilds the nav graph rooted at `Login`, bouncing the
 *     user mid-session.
 *
 * The interceptor returns the original [Response] untouched —
 * call sites still observe the HTTP 401 as a regular
 * `HttpException` and surface a UI-level error. The callback
 * exists purely to drive global session-state updates.
 *
 * **Endpoint exemptions**. A 401 from `/auth/login`,
 * `/auth/login/2fa`, or `/auth/refresh` is "credentials
 * rejected," not "session expired." Those callsites
 * (LoginViewModel, TwoFactorViewModel, the future P3-03e
 * refresh path) handle the 401 themselves; we MUST NOT clear
 * the persisted session — that would log out an already-logged-in
 * user just because they fat-fingered a password during a
 * re-auth prompt.
 *
 * **Refresh-token rotation (P3-03e)**. Once that lands the
 * 401-handling story changes: the response should trigger a
 * refresh attempt first, and the session is invalidated only if
 * the refresh itself returns 401. Today no refresh codepath
 * exists, so a single 401 → invalidate is the right policy and
 * the safer default — the user re-enters credentials, which
 * costs them maybe 5 seconds; the alternative (silent failure
 * with a stuck session) costs them confusion.
 *
 * @param onSessionInvalidated synchronous callback fired when a
 *   401 lands from an authenticated endpoint. Typically clears
 *   the persisted session and emits a navigation event.
 */
class SessionInvalidationInterceptor(
    private val onSessionInvalidated: () -> Unit,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        if (response.code == HTTP_UNAUTHORIZED && shouldInvalidateOn401(request)) {
            onSessionInvalidated()
        }
        return response
    }

    private fun shouldInvalidateOn401(request: okhttp3.Request): Boolean {
        val path = request.url.encodedPath
        return SESSION_PRESERVING_PATH_SUFFIXES.none { path.endsWith(it) }
    }

    private companion object {
        // RFC 7235 — HTTP 401 "Unauthorized."
        private const val HTTP_UNAUTHORIZED: Int = 401

        // Paths whose 401 responses must NOT trigger session
        // invalidation. Mirrors the skip-list in
        // [AuthInterceptor.UNAUTHENTICATED_PATH_SUFFIXES] minus
        // /health (which doesn't return 401). Kept in a separate
        // const because the lists are conceptually distinct —
        // "don't add a Bearer header" vs. "don't clear the
        // session on 401."
        private val SESSION_PRESERVING_PATH_SUFFIXES: List<String> = listOf(
            "/auth/login",
            "/auth/login/2fa",
            "/auth/refresh",
        )
    }
}
