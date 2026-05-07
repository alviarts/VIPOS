package id.alviarts.vipos.core.network

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * Unit tests for [SessionInvalidationInterceptor] (P3-10).
 *
 * Drives the interceptor through a real [MockWebServer] for the
 * same reasons as [AuthInterceptorTest] — production OkHttp's
 * response-handling pipeline is what we want to assert against,
 * not a fake `Interceptor.Chain`.
 *
 * Each test builds its own [OkHttpClient] with a fresh
 * [AtomicInteger] callback counter so the assertions are
 * isolated.
 */
class SessionInvalidationInterceptorTest {

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
    fun `fires callback on 401 from authenticated endpoint`() {
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(401))
        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.use {
            assertEquals(401, it.code)
        }

        assertEquals(1, invocations.get())
    }

    @Test
    fun `does not fire callback on 200`() {
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(200))
        client.newCall(getRequest("/api/v1/products")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `does not fire callback on 403`() {
        // 403 = "authenticated but not authorised" — distinct from
        // 401 ("not authenticated"). The session is still valid;
        // clearing it would log out a user just because they hit
        // an admin-only endpoint.
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(403))
        client.newCall(getRequest("/api/v1/products")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `does not fire callback on 500`() {
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(500))
        client.newCall(getRequest("/api/v1/products")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `skips invalidation on 401 from login path`() {
        // Bad credentials. LoginViewModel surfaces this via its
        // own `Failure` branch — clearing the persisted session
        // here would log out an already-authenticated user just
        // because they fat-fingered a password during a re-auth.
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(401))
        client.newCall(postRequest("/api/v1/auth/login")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `skips invalidation on 401 from 2fa path`() {
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(401))
        client.newCall(postRequest("/api/v1/auth/login/2fa")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `skips invalidation on 401 from refresh path`() {
        // Once P3-03e lands the refresh interceptor will swap
        // this behaviour: a 401 from /auth/refresh DOES indicate
        // an invalid refresh token and SHOULD invalidate. For
        // today, the refresh path is exempt because no caller
        // exists yet — keeping the 401 from clearing the session
        // is the safer default.
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(401))
        client.newCall(postRequest("/api/v1/auth/refresh")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `returns response body unchanged after invalidation`() {
        // The interceptor must not alter the response — call
        // sites still observe the 401 as a regular HttpException
        // and surface a UI-level error. The callback is a
        // side-channel for global session-state updates only.
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        val expectedBody = """{"error":"unauthorized"}"""
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody(expectedBody),
        )
        val response = client.newCall(getRequest("/api/v1/products")).execute()
        response.use {
            assertEquals(401, it.code)
            assertEquals(expectedBody, it.body?.string())
        }

        assertEquals(1, invocations.get())
    }

    @Test
    fun `fires callback exactly once per 401 response`() {
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        // Three back-to-back 401s should fire the callback three
        // times — there's no debouncing inside the interceptor;
        // the callback itself (clearing TokenStorage) is
        // idempotent so multiple invocations are harmless.
        repeat(3) {
            server.enqueue(MockResponse().setResponseCode(401))
            client.newCall(getRequest("/api/v1/products")).execute().close()
        }

        assertEquals(3, invocations.get())
    }

    @Test
    fun `path-suffix match is robust against api version prefix`() {
        // Match should hold whether the deployed prefix is
        // `/api/v1/auth/login` or some hypothetical
        // `/api/v2/auth/login` — we suffix-match for exactly
        // this reason.
        val invocations = AtomicInteger(0)
        val client = clientWith(invocations)

        server.enqueue(MockResponse().setResponseCode(401))
        client.newCall(postRequest("/api/v2/auth/login")).execute().close()

        assertEquals(0, invocations.get())
    }

    @Test
    fun `pairs with AuthInterceptor — bearer attached and 401 fires callback`() {
        // Sanity check that the two interceptors compose: the
        // request-side AuthInterceptor stamps Bearer, the
        // response-side SessionInvalidationInterceptor reacts to
        // the 401. Production wires both into the same
        // OkHttpClient so this is the realistic flow.
        val invocations = AtomicInteger(0)
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor { "access-token" })
            .addInterceptor(
                SessionInvalidationInterceptor { invocations.incrementAndGet() },
            )
            .build()

        server.enqueue(MockResponse().setResponseCode(401))
        client.newCall(getRequest("/api/v1/products")).execute().close()

        val recorded = server.takeRequest()
        assertEquals("Bearer access-token", recorded.getHeader("Authorization"))
        assertTrue(
            "callback must fire on 401",
            invocations.get() == 1,
        )
        assertFalse(
            "callback must fire exactly once",
            invocations.get() > 1,
        )
    }

    private fun clientWith(invocations: AtomicInteger): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(
                SessionInvalidationInterceptor { invocations.incrementAndGet() },
            )
            .build()

    private fun getRequest(path: String): Request =
        Request.Builder()
            .url(server.url(path))
            .get()
            .build()

    private fun postRequest(path: String): Request =
        Request.Builder()
            .url(server.url(path))
            .post(okhttp3.RequestBody.create(null, byteArrayOf()))
            .build()
}
