package id.alviarts.vipos.core.network

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * Unit tests for [RefreshTokenAuthenticator] (P3-03e).
 *
 * The Authenticator runs deep inside OkHttp's retry-and-follow-up
 * machinery, so we test it through a real [MockWebServer] +
 * [OkHttpClient] rather than a hand-rolled fake. That way every
 * test exercises the actual `priorResponse` chain construction,
 * the real call → response → retry path, and the actual
 * `Builder#authenticator` plumbing. The cost is one MockWebServer
 * per test method; the benefit is no chance of a fake Authenticator
 * harness silently diverging from production OkHttp semantics.
 *
 * Coverage map:
 *  - happy-path 401 → refresh → retried request carries new Bearer.
 *  - refresh callback returning null → original 401 surfaces.
 *  - refresh skip-path list (`/auth/login`, `/auth/login/2fa`,
 *    `/auth/refresh`) — no refresh attempt, no retry.
 *  - loop guard: a second 401 on the retried request does NOT
 *    fire the callback again.
 *  - non-401 status (200, 403, 500) — Authenticator never invoked.
 *  - composes with [AuthInterceptor] — the retry runs through
 *    the application interceptors, so the new Bearer reaches
 *    the wire (mirrors the production wiring in `:app/AppModule`).
 */
class RefreshTokenAuthenticatorTest {

    private lateinit var server: MockWebServer

    @Before
    fun startServer() {
        server = MockWebServer().apply { start() }
    }

    @After
    fun shutdownServer() {
        server.shutdown()
    }

    @Test
    fun `on 401 invokes refresh callback and retries with new Bearer`() {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            "fresh-access-token"
        }

        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.close()

        assertEquals("refresh callback invoked exactly once", 1, invocations.get())
        // First request: original (no Bearer in this test).
        server.takeRequest()
        // Second request: retried by Authenticator with the new token.
        val retried = server.takeRequest()
        assertEquals(
            "retried request carries the freshly-issued access token",
            "Bearer fresh-access-token",
            retried.getHeader("Authorization"),
        )
        assertEquals(
            "no third request — the 200 is final",
            2,
            server.requestCount,
        )
    }

    @Test
    fun `on 401 with refresh returning null original 401 propagates`() {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            null
        }

        server.enqueue(MockResponse().setResponseCode(401))

        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.use { /* close after assertion below */ }

        assertEquals("refresh callback invoked exactly once", 1, invocations.get())
        assertEquals(401, response.code)
        assertEquals(
            "no retry — Authenticator returning null short-circuits",
            1,
            server.requestCount,
        )
    }

    @Test
    fun `skips refresh for auth-login path`() = assertSkipsRefreshFor("/api/v1/auth/login")

    @Test
    fun `skips refresh for auth-login-2fa path`() = assertSkipsRefreshFor("/api/v1/auth/login/2fa")

    @Test
    fun `skips refresh for auth-refresh path itself`() = assertSkipsRefreshFor("/api/v1/auth/refresh")

    @Test
    fun `loop guard prevents second refresh after retried request also returns 401`() {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            "still-bad-token"
        }

        // Both attempts return 401. The Authenticator must NOT
        // try to refresh on the retried request — that's an
        // infinite loop in disguise.
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(401))

        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.close()

        assertEquals(
            "refresh callback invoked exactly once across both 401s",
            1,
            invocations.get(),
        )
        assertEquals(
            "exactly one retry, even though both responses were 401",
            2,
            server.requestCount,
        )
        assertEquals(
            "final response is the second 401",
            401,
            response.code,
        )
    }

    @Test
    fun `does not invoke refresh on 200 response`() {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            "should-not-be-used"
        }

        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        client.newCall(getRequest("/api/v1/products")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `does not invoke refresh on 403 or 500 responses`() {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            "should-not-be-used"
        }

        server.enqueue(MockResponse().setResponseCode(403))
        server.enqueue(MockResponse().setResponseCode(500))

        client.newCall(getRequest("/api/v1/products")).execute().close()
        client.newCall(getRequest("/api/v1/orders")).execute().close()

        assertEquals(
            "OkHttp Authenticator only fires on 401/407 — 403 and 500 must not invoke refresh",
            0,
            invocations.get(),
        )
    }

    @Test
    fun `composes with AuthInterceptor — retry carries fresh Bearer not stale one`() {
        // Mirror the production wiring: AuthInterceptor stamps
        // Bearer from a tokenProvider that the Authenticator's
        // refresh callback updates.
        val currentAccessToken = java.util.concurrent.atomic.AtomicReference("stale-token")
        val authInterceptor = AuthInterceptor { currentAccessToken.get() }
        val authenticator = RefreshTokenAuthenticator {
            currentAccessToken.set("fresh-token")
            "fresh-token"
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .authenticator(authenticator)
            .build()

        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        client.newCall(getRequest("/api/v1/products")).execute().close()

        val first = server.takeRequest()
        val retried = server.takeRequest()
        assertEquals("Bearer stale-token", first.getHeader("Authorization"))
        assertEquals(
            "retried request must carry the freshly-issued token, not the stale one",
            "Bearer fresh-token",
            retried.getHeader("Authorization"),
        )
        assertNotEquals(
            "stale and fresh tokens differ — sanity check the test fixture",
            first.getHeader("Authorization"),
            retried.getHeader("Authorization"),
        )
    }

    @Test
    fun `null refresh callback returns null Authenticator request — no infinite spin`() {
        val client = clientWith { null }

        server.enqueue(MockResponse().setResponseCode(401))

        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.close()

        // Just one attempt — Authenticator returned null on first try.
        assertEquals(1, server.requestCount)
        assertEquals(401, response.code)
        assertNull(response.priorResponse?.priorResponse)
    }

    private fun assertSkipsRefreshFor(path: String) {
        val invocations = AtomicInteger(0)
        val client = clientWith {
            invocations.incrementAndGet()
            "should-not-be-issued"
        }

        server.enqueue(MockResponse().setResponseCode(401))

        val response = client.newCall(getRequest(path)).execute()
        response.close()

        assertEquals(
            "no refresh attempt for path $path",
            0,
            invocations.get(),
        )
        assertEquals(
            "no retry — request returns 401 unchanged",
            1,
            server.requestCount,
        )
        assertEquals(401, response.code)
    }

    private fun clientWith(refreshAndSave: () -> String?): OkHttpClient =
        OkHttpClient.Builder()
            .authenticator(RefreshTokenAuthenticator(refreshAndSave))
            .build()

    private fun getRequest(path: String): Request =
        Request.Builder()
            .url(server.url(path))
            .build()
}
