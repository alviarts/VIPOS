package id.alviarts.vipos.feature.auth.domain

import id.alviarts.vipos.feature.auth.data.AuthApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Unit tests for [AuthRepository.refresh] (P3-03e).
 *
 * The repository's refresh method is the bridge between
 * [id.alviarts.vipos.core.network.RefreshTokenAuthenticator]
 * (which fires on a 401 from any authenticated endpoint) and
 * the persisted [TokenStorage]. Getting this right matters
 * because:
 *
 *  - On success the persisted refresh token MUST be replaced
 *    atomically — the backend revokes the old one immediately,
 *    so leaving the old one around would mean the next 401 fires
 *    a refresh that 401s itself (loop, then forced logout).
 *  - On failure the persisted session MUST stay intact —
 *    `SessionInvalidationInterceptor` is responsible for
 *    clearing on the original-request 401 propagation, and
 *    that two-stage handoff only works if `refresh()` doesn't
 *    pre-emptively wipe state.
 *  - The user snapshot inside [AuthSession] must NOT be reset on
 *    refresh — refresh rotates tokens, not identity. The backend
 *    happens to echo the user summary on `/refresh`, but if it
 *    omitted the field the persisted user must remain.
 *
 * MockWebServer drives a real [Retrofit]-built [AuthApi] so the
 * test exercises the actual JSON-decode path. [FakeTokenStorage]
 * is an in-memory [TokenStorage] that captures every save / clear
 * for assertion.
 */
class AuthRepositoryRefreshTest {

    private lateinit var server: MockWebServer
    private lateinit var api: AuthApi
    private lateinit var tokenStorage: FakeTokenStorage
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
        tokenStorage = FakeTokenStorage()
        repository = AuthRepository(api, tokenStorage)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `returns null without an API call when no session is persisted`() = runTest {
        val newAccessToken = repository.refresh()

        assertNull(newAccessToken)
        assertEquals(
            "no /refresh round-trip when there's nothing to refresh",
            0,
            server.requestCount,
        )
        assertEquals(
            "no save / clear when there's no session",
            emptyList<FakeTokenStorage.Event>(),
            tokenStorage.events,
        )
    }

    @Test
    fun `happy path saves rotated tokens and returns new access token`() = runTest {
        tokenStorage.save(seedSession(accessToken = "old-access", refreshToken = "old-refresh"))
        tokenStorage.eventsClear()

        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "fresh-access",
                  "refresh_token": "fresh-refresh",
                  "expires_in": 900,
                  "user": {
                    "id": 1, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7
                  }
                }
                """.trimIndent(),
            ),
        )

        val newAccessToken = repository.refresh()

        assertEquals("fresh-access", newAccessToken)
        val recorded = server.takeRequest()
        assertEquals("POST", recorded.method)
        assertTrue(
            "request body must carry the OLD refresh token",
            recorded.body.readUtf8().contains("old-refresh"),
        )

        val saved = tokenStorage.read()
        assertNotNull(saved)
        assertEquals("fresh-access", saved!!.tokens.accessToken)
        assertEquals("fresh-refresh", saved.tokens.refreshToken)
        assertEquals("alice", saved.user.username)
        assertEquals(
            "exactly one save was emitted to TokenStorage",
            1,
            tokenStorage.events.count { it is FakeTokenStorage.Event.Save },
        )
        assertEquals(
            "no clear was emitted on success",
            0,
            tokenStorage.events.count { it is FakeTokenStorage.Event.Clear },
        )
    }

    @Test
    fun `401 from backend returns null and leaves persisted session intact`() = runTest {
        val seeded = seedSession(accessToken = "old-access", refreshToken = "old-refresh")
        tokenStorage.save(seeded)
        tokenStorage.eventsClear()

        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"revoked"}"""))

        val newAccessToken = repository.refresh()

        assertNull(newAccessToken)
        assertEquals(
            "persisted session unchanged — interceptor decides whether to clear",
            seeded,
            tokenStorage.read(),
        )
        assertEquals(
            "no save / clear on 401",
            emptyList<FakeTokenStorage.Event>(),
            tokenStorage.events,
        )
    }

    @Test
    fun `malformed body without token returns null and leaves session intact`() = runTest {
        val seeded = seedSession()
        tokenStorage.save(seeded)
        tokenStorage.eventsClear()

        // Backend bug — 200 but missing the `token` field.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{ "refresh_token": "fresh-refresh", "expires_in": 900 }""",
            ),
        )

        val newAccessToken = repository.refresh()

        assertNull(newAccessToken)
        assertEquals(seeded, tokenStorage.read())
    }

    @Test
    fun `malformed body without refresh_token returns null and leaves session intact`() = runTest {
        val seeded = seedSession()
        tokenStorage.save(seeded)
        tokenStorage.eventsClear()

        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{ "token": "fresh-access", "expires_in": 900 }""",
            ),
        )

        val newAccessToken = repository.refresh()

        assertNull(newAccessToken)
        assertEquals(seeded, tokenStorage.read())
    }

    @Test
    fun `network error returns null and leaves session intact`() = runTest {
        val seeded = seedSession()
        tokenStorage.save(seeded)
        tokenStorage.eventsClear()

        // Force the read to fail mid-flight by closing the server.
        server.shutdown()

        val newAccessToken = repository.refresh()

        assertNull(newAccessToken)
        assertEquals(seeded, tokenStorage.read())
    }

    @Test
    fun `preserves existing user when backend response omits user field`() = runTest {
        val seeded = seedSession()
        tokenStorage.save(seeded)
        tokenStorage.eventsClear()

        // The backend currently echoes `user`, but the repository
        // must not require it — a future minimal-response variant
        // (or a partial deploy mid-rollout) would surface as a
        // logout regression otherwise.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "fresh-access",
                  "refresh_token": "fresh-refresh",
                  "expires_in": 900
                }
                """.trimIndent(),
            ),
        )

        val newAccessToken = repository.refresh()

        assertEquals("fresh-access", newAccessToken)
        val saved = tokenStorage.read()
        assertNotNull(saved)
        assertEquals(
            "user identity is reused from the prior session when the backend omits it",
            seeded.user,
            saved!!.user,
        )
    }

    @Test
    fun `omitted expires_in falls back to 900 second TTL`() = runTest {
        tokenStorage.save(seedSession())
        tokenStorage.eventsClear()

        val before = System.currentTimeMillis() / 1000
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "fresh-access",
                  "refresh_token": "fresh-refresh"
                }
                """.trimIndent(),
            ),
        )

        repository.refresh()

        val saved = tokenStorage.read()!!
        val ttl = saved.tokens.accessExpiresAtEpochSec - before
        assertTrue(
            "fallback TTL should be ~900s (got $ttl)",
            ttl in 890..920,
        )
    }

    private fun seedSession(
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
            id = 1,
            username = "alice",
            name = "Alice",
            role = "owner",
            tenantId = 7,
        ),
    )
}

/**
 * In-memory [TokenStorage] for tests. Captures every save/clear
 * as an [Event] so tests can assert exactly what the repository
 * persisted (and that it didn't write extra states on failure
 * paths).
 */
private class FakeTokenStorage : TokenStorage {
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
