package id.alviarts.vipos.feature.auth.domain

import id.alviarts.vipos.feature.auth.data.AuthApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Unit tests for the non-refresh code paths on [AuthRepository]:
 * [AuthRepository.login], [AuthRepository.verify2fa],
 * [AuthRepository.logout], [AuthRepository.restoreSession], and
 * the [AuthRepository.isAuthenticated] Flow.
 *
 * Pairs with [AuthRepositoryRefreshTest] (P3-03e) to give the
 * full repository surface unit-test coverage. Same harness:
 * MockWebServer-backed Retrofit so the test exercises the actual
 * JSON-decode + DTO-mapping path, plus an in-memory
 * [FakeAuthTokenStorage] that captures every save / clear so
 * tests can assert exactly what the repository persisted (or
 * that it didn't persist on failure paths).
 *
 * Critical contracts under test:
 *  - **Atomicity** — on [LoginResult.Success], the access token,
 *    refresh token, and user snapshot are persisted before the
 *    function returns. Cold-start auto-login must find a complete
 *    bundle, never a half-written one.
 *  - **Failure containment** — `HttpException` and `IOException`
 *    are caught and converted to [LoginResult.Failure]; no
 *    persisted state is changed on failure (so a botched login
 *    doesn't kick the user out of an existing session).
 *  - **Logout best-effort** — the local session is cleared even
 *    if the backend call fails, so the next launch lands on the
 *    login screen regardless of network state.
 *  - **Restore margin** — sessions whose access token expires
 *    within 10s are treated as expired (won't race the refresh
 *    flow on the very next request).
 */
class AuthRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: AuthApi
    private lateinit var tokenStorage: FakeAuthTokenStorage
    private lateinit var repository: AuthRepository

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
        }
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(
                json.asConverterFactory("application/json".toMediaType()),
            )
            .build()
        api = retrofit.create(AuthApi::class.java)
        tokenStorage = FakeAuthTokenStorage()
        repository = AuthRepository(api, tokenStorage)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    // ---------- login() ----------

    @Test
    fun `login happy path persists session and returns Success`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "access-1",
                  "refresh_token": "refresh-1",
                  "expires_in": 900,
                  "user": {
                    "id": 42, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7
                  }
                }
                """.trimIndent(),
            ),
        )

        val result = repository.login("alice", "secret", rememberMe = true)

        assertTrue(result is LoginResult.Success)
        result as LoginResult.Success
        assertEquals("access-1", result.accessToken)
        assertEquals("alice", result.user.username)
        assertEquals(42L, result.user.id)
        assertEquals("owner", result.user.role)

        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertTrue(
            "request body must carry the username + remember_me flag",
            recorded.body.readUtf8().let { it.contains("alice") && it.contains("remember_me") },
        )

        val persisted = tokenStorage.read()
        assertNotNull(persisted)
        assertEquals("access-1", persisted!!.tokens.accessToken)
        assertEquals("refresh-1", persisted.tokens.refreshToken)
        assertEquals("alice", persisted.user.username)
        assertEquals(
            "exactly one save was emitted",
            1,
            tokenStorage.events.count { it is FakeAuthTokenStorage.Event.Save },
        )
    }

    @Test
    fun `login with requires_2fa returns Requires2FA without persisting anything`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "requires_2fa": true,
                  "login_token": "lt-abcdef"
                }
                """.trimIndent(),
            ),
        )

        val result = repository.login("alice", "secret")

        assertTrue(result is LoginResult.Requires2FA)
        result as LoginResult.Requires2FA
        assertEquals("lt-abcdef", result.loginToken)

        assertNull("no session persisted on a 2FA challenge", tokenStorage.read())
        assertEquals(
            "no save / clear emitted on a 2FA challenge",
            emptyList<FakeAuthTokenStorage.Event>(),
            tokenStorage.events,
        )
    }

    @Test
    fun `login with 401 wrong creds returns Failure and leaves persisted session intact`() =
        runTest {
            val pre = sessionFixture(accessToken = "preexisting-access")
            tokenStorage.save(pre)
            tokenStorage.eventsClear()

            server.enqueue(
                MockResponse().setResponseCode(401).setBody("""{"error":"Login gagal"}"""),
            )

            val result = repository.login("alice", "wrong-password")

            assertTrue(result is LoginResult.Failure)
            result as LoginResult.Failure
            assertTrue(
                "failure message surfaces the HTTP code",
                result.message.contains("HTTP 401"),
            )
            assertEquals(
                "an existing session is NOT clobbered by a failed login attempt",
                pre,
                tokenStorage.read(),
            )
        }

    @Test
    fun `login with network error returns Failure with friendly Indonesian copy`() = runTest {
        // Force an IOException by closing the server before the call.
        server.shutdown()

        val result = repository.login("alice", "secret")

        assertTrue(result is LoginResult.Failure)
        result as LoginResult.Failure
        assertEquals("Tidak bisa terhubung ke server", result.message)
        assertNull(tokenStorage.read())
    }

    @Test
    fun `login with malformed response body returns Failure`() = runTest {
        // 200 OK but the body has neither token+user nor
        // requires_2fa+login_token — backend regression that the
        // mapper must not silently treat as success.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody("""{ "expires_in": 900 }"""),
        )

        val result = repository.login("alice", "secret")

        assertTrue(result is LoginResult.Failure)
        result as LoginResult.Failure
        assertTrue(
            "failure message surfaces the unknown-response shape",
            result.message.contains("tidak dikenal"),
        )
        assertNull(tokenStorage.read())
    }

    // ---------- verify2fa() ----------

    @Test
    fun `verify2fa happy path persists session and returns Success`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "access-2",
                  "refresh_token": "refresh-2",
                  "expires_in": 900,
                  "user": {
                    "id": 42, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7
                  }
                }
                """.trimIndent(),
            ),
        )

        val result = repository.verify2fa("lt-abcdef", code = "123456", rememberMe = false)

        assertTrue(result is LoginResult.Success)
        result as LoginResult.Success
        assertEquals("access-2", result.accessToken)

        val persisted = tokenStorage.read()
        assertNotNull(persisted)
        assertEquals("refresh-2", persisted!!.tokens.refreshToken)
        assertEquals(42L, persisted.user.id)
    }

    @Test
    fun `verify2fa with 401 wrong code returns Failure with 2FA-specific copy`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(401).setBody("""{"error":"Kode salah"}"""),
        )

        val result = repository.verify2fa("lt-abcdef", code = "000000")

        assertTrue(result is LoginResult.Failure)
        result as LoginResult.Failure
        assertEquals(
            "2FA-specific error copy distinguishes wrong code from generic auth failure",
            "Kode 2FA salah atau sesi sudah berakhir",
            result.message,
        )
        assertNull(tokenStorage.read())
    }

    @Test
    fun `verify2fa with non-401 HTTP error returns Failure with HTTP code in message`() = runTest {
        server.enqueue(MockResponse().setResponseCode(500))

        val result = repository.verify2fa("lt-abcdef", code = "123456")

        assertTrue(result is LoginResult.Failure)
        result as LoginResult.Failure
        assertTrue(
            "non-401 falls through to the generic HTTP code copy",
            result.message.contains("HTTP 500"),
        )
    }

    // ---------- logout() ----------

    @Test
    fun `logout success clears persisted session and returns true`() = runTest {
        tokenStorage.save(sessionFixture())
        tokenStorage.eventsClear()
        server.enqueue(MockResponse().setResponseCode(204))

        val ok = repository.logout()

        assertTrue("backend acked logout", ok)
        assertNull("persisted session cleared after logout", tokenStorage.read())
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertEquals(
            "logout endpoint receives the active access token via explicit Authorization header",
            "Bearer seed-access",
            recorded.getHeader("Authorization"),
        )
        assertTrue(
            "logout request body carries the refresh token to revoke",
            recorded.body.readUtf8().contains("seed-refresh"),
        )
        assertEquals(
            "exactly one clear emitted (the finally block)",
            1,
            tokenStorage.events.count { it is FakeAuthTokenStorage.Event.Clear },
        )
    }

    @Test
    fun `logout with no persisted session is a no-op and returns true`() = runTest {
        val ok = repository.logout()

        assertTrue("nothing to log out from is a vacuous success", ok)
        assertEquals(
            "no /logout request when there's no session to revoke",
            0,
            server.requestCount,
        )
        assertEquals(
            "no clear emitted because there was nothing to clear",
            emptyList<FakeAuthTokenStorage.Event>(),
            tokenStorage.events,
        )
    }

    @Test
    fun `logout with backend HTTP error still clears local session and returns false`() = runTest {
        tokenStorage.save(sessionFixture())
        tokenStorage.eventsClear()
        server.enqueue(MockResponse().setResponseCode(500))

        val ok = repository.logout()

        assertFalse("backend failure surfaces as false", ok)
        assertNull(
            "best-effort: local session cleared even though backend rejected the call",
            tokenStorage.read(),
        )
    }

    @Test
    fun `logout with network error still clears local session and returns false`() = runTest {
        tokenStorage.save(sessionFixture())
        tokenStorage.eventsClear()
        server.shutdown()

        val ok = repository.logout()

        assertFalse(ok)
        assertNull(
            "best-effort: network failure must not strand a logged-in shell on the device",
            tokenStorage.read(),
        )
    }

    // ---------- restoreSession() ----------

    @Test
    fun `restoreSession returns user when token expires comfortably in the future`() = runTest {
        val far = (System.currentTimeMillis() / 1000) + 600
        tokenStorage.save(sessionFixture(expiresAtEpochSec = far))

        val user = repository.restoreSession()

        assertNotNull(user)
        assertEquals("alice", user!!.username)
    }

    @Test
    fun `restoreSession returns null when no session is persisted`() = runTest {
        assertNull(repository.restoreSession())
    }

    @Test
    fun `restoreSession returns null when token expires within 10s safety margin`() = runTest {
        val nearNow = (System.currentTimeMillis() / 1000) + 5
        tokenStorage.save(sessionFixture(expiresAtEpochSec = nearNow))

        assertNull(
            "tokens expiring within 10s are treated as expired to avoid racing /refresh",
            repository.restoreSession(),
        )
    }

    @Test
    fun `restoreSession returns null when token already expired`() = runTest {
        val past = (System.currentTimeMillis() / 1000) - 1
        tokenStorage.save(sessionFixture(expiresAtEpochSec = past))

        assertNull(repository.restoreSession())
    }

    // ---------- isAuthenticated Flow ----------

    @Test
    fun `isAuthenticated emits false initially and true after login persists`() = runTest {
        assertFalse("no session => not authenticated", repository.isAuthenticated.first())

        tokenStorage.save(sessionFixture())

        assertTrue("session persisted => authenticated", repository.isAuthenticated.first())
    }

    private fun sessionFixture(
        accessToken: String = "seed-access",
        refreshToken: String = "seed-refresh",
        expiresAtEpochSec: Long = (System.currentTimeMillis() / 1000) + 600,
    ): AuthSession = AuthSession(
        tokens = AuthTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            accessExpiresAtEpochSec = expiresAtEpochSec,
        ),
        user = AuthUser(
            id = 42,
            username = "alice",
            name = "Alice",
            role = "owner",
            tenantId = 7,
        ),
    )
}

/**
 * Test-only [TokenStorage] with deterministic behaviour and an
 * append-only event log. Kept here (rather than shared with
 * `AuthRepositoryRefreshTest`) so each test file remains
 * self-contained and the test fixture is reviewable inline; the
 * cost is ~30 lines of duplication, the benefit is no temporal
 * coupling between the two test classes.
 */
private class FakeAuthTokenStorage : TokenStorage {
    private val state = MutableStateFlow<AuthSession?>(null)
    private val _events = mutableListOf<Event>()
    val events: List<Event> get() = _events.toList()

    sealed class Event {
        data class Save(val session: AuthSession) : Event()
        object Clear : Event()
    }

    override suspend fun read(): AuthSession? = state.value

    override val sessions: Flow<AuthSession?> = state.asStateFlow()

    override suspend fun save(session: AuthSession) {
        state.value = session
        _events.add(Event.Save(session))
    }

    override suspend fun clear() {
        state.value = null
        _events.add(Event.Clear)
    }

    fun eventsClear() {
        _events.clear()
    }
}
