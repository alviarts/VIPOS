package id.alviarts.vipos.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp [Interceptor] that injects `Authorization: Bearer <token>`
 * onto every outgoing request that targets an authenticated
 * endpoint (P3-06 + handoff §6).
 *
 * The constructor takes a synchronous [tokenProvider] callback
 * rather than coupling the interceptor to a specific token
 * storage implementation. This keeps `:core:network` Hilt-free
 * (consistent with [NetworkClientFactory]) and lets the
 * production wiring in `:app/AppModule` bridge from the
 * suspending `TokenStorage.read()` API to the synchronous
 * call OkHttp expects (`runBlocking` is acceptable here — the
 * DataStore read is bounded by a local-disk roundtrip; the
 * interceptor runs on OkHttp's dispatcher thread, not the
 * main thread).
 *
 * **Skip rules** (in priority order):
 *
 *  1. **Request already has an `Authorization` header** —
 *     `:feature:auth/AuthApi.logout()` passes its own bearer
 *     explicitly via `@Header("Authorization") bearer`. Honour
 *     that and don't double-stamp.
 *  2. **Request path matches an unauthenticated endpoint** —
 *     `/auth/login`, `/auth/login/2fa`, `/auth/refresh`, and
 *     `/health` must NEVER carry a Bearer token (the backend
 *     rejects authenticated /login calls in some configs, and
 *     the token would leak into the access log either way).
 *     Match by path-suffix so the rule is robust against
 *     `/api/v1` versioning prefixes.
 *  3. **`tokenProvider` returns null/blank** — user not yet
 *     authenticated. Pass through unmodified; the backend
 *     will return 401 on its own.
 *
 * 401-driven session invalidation (clearing the persisted
 * session + bouncing back to login) is intentionally NOT done
 * here. That belongs in a separate OkHttp [okhttp3.Authenticator]
 * — the response-side counterpart to this request-side
 * interceptor — which lands in P3-03f. Keeping the two concerns
 * decoupled means each can be tested + reasoned about
 * independently.
 *
 * @param tokenProvider synchronous lookup of the current access
 *   token (`null` when there's no authenticated session). Production
 *   wiring bridges this to `TokenStorage.read()?.tokens?.accessToken`
 *   via `runBlocking` in `:app/AppModule`.
 */
class AuthInterceptor(
    private val tokenProvider: () -> String?,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        if (!shouldInjectBearer(original)) {
            return chain.proceed(original)
        }

        val token = tokenProvider()
        if (token.isNullOrBlank()) {
            return chain.proceed(original)
        }

        val authenticated = original.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        return chain.proceed(authenticated)
    }

    private fun shouldInjectBearer(request: okhttp3.Request): Boolean {
        // Honour an explicit caller-provided `Authorization` header.
        if (request.header("Authorization") != null) {
            return false
        }

        // Skip unauthenticated endpoints by path-suffix match. Use
        // `encodedPath` so the comparison is invariant to base-URL
        // prefix (`/api/v1`) and any path-segment encoding the
        // backend introduces in future routes.
        val path = request.url.encodedPath
        return UNAUTHENTICATED_PATH_SUFFIXES.none { path.endsWith(it) }
    }

    private companion object {
        // Keep the list short + literal. Suffix-match is intentional
        // so `/api/v1/auth/login` and a hypothetical
        // `/api/v2/auth/login` both skip injection without needing
        // to know the API version prefix.
        private val UNAUTHENTICATED_PATH_SUFFIXES: List<String> = listOf(
            "/auth/login",
            "/auth/login/2fa",
            "/auth/refresh",
            "/health",
        )
    }
}
