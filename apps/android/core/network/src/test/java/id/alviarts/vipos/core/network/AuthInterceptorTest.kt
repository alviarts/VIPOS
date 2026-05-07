package id.alviarts.vipos.core.network

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [AuthInterceptor] (P3-10).
 *
 * Drives the interceptor through a real [MockWebServer] rather
 * than a mocked `Interceptor.Chain` because:
 *
 *  1. [MockWebServer] gives us back the actual outgoing
 *     [okhttp3.Request] via `takeRequest()`, so assertions
 *     check what the server would have observed — no risk of
 *     a fake chain diverging from the production OkHttp
 *     request-rewrite semantics.
 *  2. The interceptor wires through the standard `addInterceptor`
 *     call site that production uses, so the test exercises
 *     the same code path.
 */
class AuthInterceptorTest {

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
    fun `injects Bearer header when token present and path is authenticated`() {
        val client = clientWithToken("access-123")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertEquals("Bearer access-123", recorded.getHeader("Authorization"))
    }

    @Test
    fun `does not inject Bearer when tokenProvider returns null`() {
        val client = clientWithToken(null)

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `does not inject Bearer when tokenProvider returns blank`() {
        val client = clientWithToken("   ")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `does not overwrite caller-provided Authorization header`() {
        // `:feature:auth/AuthApi.logout` passes its own bearer via
        // `@Header("Authorization") bearer` — the interceptor must
        // honour that explicit value and pass through unchanged.
        val client = clientWithToken("session-token")

        server.enqueue(MockResponse().setResponseCode(200))
        val request = Request.Builder()
            .url(server.url("/api/v1/auth/logout"))
            .header("Authorization", "Bearer caller-supplied")
            .post(okhttp3.RequestBody.create(null, byteArrayOf()))
            .build()
        client.newCall(request).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertEquals("Bearer caller-supplied", recorded.getHeader("Authorization"))
    }

    @Test
    fun `skips Bearer for login path`() {
        val client = clientWithToken("access-123")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/auth/login")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `skips Bearer for 2fa path`() {
        val client = clientWithToken("access-123")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/auth/login/2fa")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `skips Bearer for refresh path`() {
        val client = clientWithToken("access-123")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/auth/refresh")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `skips Bearer for health path`() {
        val client = clientWithToken("access-123")

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/health")).execute().use { /* ignore body */ }

        val recorded = server.takeRequest()
        assertNull(recorded.getHeader("Authorization"))
    }

    @Test
    fun `tokenProvider invoked per request so token rotation propagates`() {
        // Critical for P3-03e — the refresh-token rotation flow
        // must NOT be defeated by an interceptor that captures
        // the token at construction time. Interceptor must always
        // re-read the latest persisted token on each request.
        var token: String? = "access-A"
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { token })
            .build()

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().use { /* ignore body */ }

        token = "access-B"

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().use { /* ignore body */ }

        val first = server.takeRequest()
        val second = server.takeRequest()
        assertEquals("Bearer access-A", first.getHeader("Authorization"))
        assertEquals("Bearer access-B", second.getHeader("Authorization"))
    }

    private fun clientWithToken(token: String?): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { token })
            .build()

    private fun getRequest(path: String): Request =
        Request.Builder()
            .url(server.url(path))
            .get()
            .build()
}
