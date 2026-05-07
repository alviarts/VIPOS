package id.alviarts.vipos.feature.auth.ui

import androidx.lifecycle.SavedStateHandle
import id.alviarts.vipos.feature.auth.data.AuthApi
import id.alviarts.vipos.feature.auth.domain.AuthRepository
import id.alviarts.vipos.feature.auth.domain.AuthSession
import id.alviarts.vipos.feature.auth.domain.AuthTokens
import id.alviarts.vipos.feature.auth.domain.AuthUser
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Unit tests for the login + 2FA ViewModels (P3-03b + P3-03c).
 *
 * Both ViewModels delegate to [AuthRepository] and re-classify
 * [id.alviarts.vipos.feature.auth.domain.LoginResult] into
 * UI-facing state. Rather than mock [AuthRepository] (which is
 * a final class — would need a refactor to expose an interface),
 * the tests wire a real [AuthRepository] backed by MockWebServer
 * + [FakeViewModelTokenStorage] and exercise the ViewModel +
 * Repository together as an integration test. The repository
 * surface itself is already covered in detail by
 * [id.alviarts.vipos.feature.auth.domain.AuthRepositoryTest] +
 * [id.alviarts.vipos.feature.auth.domain.AuthRepositoryRefreshTest];
 * here we focus on ViewModel state-machine transitions.
 *
 * Critical contracts:
 *  - **Synchronous Submitting transition** — `submit()` must
 *    update `_uiState` to `Submitting` synchronously, before
 *    suspending on the network call, so the screen can disable
 *    the form button immediately on tap. Verified by reading
 *    `uiState.value` between `submit()` and
 *    `advanceUntilIdle()`.
 *  - **Password / code clearing on success** — these fields
 *    must be wiped from memory once the network confirms
 *    auth (defense-in-depth against memory-dump leaks).
 *  - **isSubmitEnabled gating** — `submit()` is a no-op when
 *    the form is incomplete; the ViewModel must not start a
 *    network call (asserted by `server.requestCount`).
 */
class LoginViewModelTest {

    private lateinit var server: MockWebServer
    private lateinit var api: AuthApi
    private lateinit var tokenStorage: FakeViewModelTokenStorage
    private lateinit var repository: AuthRepository
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
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
        tokenStorage = FakeViewModelTokenStorage()
        repository = AuthRepository(api, tokenStorage)
    }

    @After
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is empty fields, Idle status, no error`() {
        val vm = LoginViewModel(repository)
        val state = vm.uiState.value
        assertEquals("", state.username)
        assertEquals("", state.password)
        assertFalse(state.rememberMe)
        assertEquals(AuthStatus.Idle, state.authStatus)
        assertNull(state.errorMessage)
        assertFalse("can't submit empty form", state.isSubmitEnabled)
    }

    @Test
    fun `field updates flow into uiState`() {
        val vm = LoginViewModel(repository)
        vm.onUsernameChange("alice")
        vm.onPasswordChange("secret")
        vm.onRememberMeToggle(true)
        val state = vm.uiState.value
        assertEquals("alice", state.username)
        assertEquals("secret", state.password)
        assertTrue(state.rememberMe)
        assertTrue("non-blank fields enable submit", state.isSubmitEnabled)
    }

    @Test
    fun `submit with empty fields is a no-op and emits no network call`() = runTest(testDispatcher) {
        val vm = LoginViewModel(repository)
        vm.submit()
        advanceUntilIdle()

        assertEquals(
            "submit() must be guarded by isSubmitEnabled",
            0,
            server.requestCount,
        )
        assertEquals(AuthStatus.Idle, vm.uiState.value.authStatus)
    }

    @Test
    fun `submit happy path transitions Idle to Submitting to Authenticated and clears password`() =
        runTest(testDispatcher) {
            server.enqueue(
                MockResponse().setResponseCode(200).setBody(
                    """
                    {
                      "token": "access-1",
                      "refresh_token": "refresh-1",
                      "expires_in": 900,
                      "user": { "id": 42, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7 }
                    }
                    """.trimIndent(),
                ),
            )
            val vm = LoginViewModel(repository)
            vm.onUsernameChange("alice")
            vm.onPasswordChange("secret")

            vm.submit()
            // The ViewModel updates to Submitting synchronously,
            // before the launch suspends on the network call.
            assertEquals(
                "screen must see Submitting before the network round-trip",
                AuthStatus.Submitting,
                vm.uiState.value.authStatus,
            )

            advanceUntilIdle()

            val finalState = vm.uiState.value
            assertTrue(
                "successful login lands in Authenticated",
                finalState.authStatus is AuthStatus.Authenticated,
            )
            val auth = finalState.authStatus as AuthStatus.Authenticated
            assertEquals("alice", auth.user.username)
            assertEquals(
                "password is cleared from memory after auth",
                "",
                finalState.password,
            )
            assertNull(finalState.errorMessage)
        }

    @Test
    fun `submit with requires_2fa transitions to Requires2FA carrying the login token`() =
        runTest(testDispatcher) {
            server.enqueue(
                MockResponse().setResponseCode(200).setBody(
                    """{ "requires_2fa": true, "login_token": "lt-abcdef" }""",
                ),
            )
            val vm = LoginViewModel(repository)
            vm.onUsernameChange("alice")
            vm.onPasswordChange("secret")

            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertTrue(state.authStatus is AuthStatus.Requires2FA)
            assertEquals(
                "login_token from /login response is forwarded to the 2FA challenge",
                "lt-abcdef",
                (state.authStatus as AuthStatus.Requires2FA).loginToken,
            )
        }

    @Test
    fun `submit failure surfaces errorMessage and returns to Idle`() = runTest(testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(401))
        val vm = LoginViewModel(repository)
        vm.onUsernameChange("alice")
        vm.onPasswordChange("wrong-password")

        vm.submit()
        advanceUntilIdle()

        val state = vm.uiState.value
        assertEquals(
            "after a failed attempt the form is editable again",
            AuthStatus.Idle,
            state.authStatus,
        )
        assertTrue(
            "errorMessage carries the friendly copy from the repository",
            state.errorMessage?.contains("HTTP 401") == true,
        )
    }

    @Test
    fun `submit trims whitespace from username before sending`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "access-1", "refresh_token": "refresh-1", "expires_in": 900,
                  "user": { "id": 1, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7 }
                }
                """.trimIndent(),
            ),
        )
        val vm = LoginViewModel(repository)
        vm.onUsernameChange("   alice   ")
        vm.onPasswordChange("secret")
        vm.submit()
        advanceUntilIdle()

        val recorded = server.takeRequest()
        val body = recorded.body.readUtf8()
        assertTrue(
            "username must be trimmed; raw whitespace must not reach the wire",
            body.contains("\"username\":\"alice\""),
        )
    }

    @Test
    fun `dismissError clears errorMessage`() = runTest(testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(401))
        val vm = LoginViewModel(repository)
        vm.onUsernameChange("alice")
        vm.onPasswordChange("wrong")
        vm.submit()
        advanceUntilIdle()

        assertTrue(vm.uiState.value.errorMessage != null)
        vm.dismissError()
        assertNull(vm.uiState.value.errorMessage)
    }

    @Test
    fun `concurrent submit during Submitting is ignored`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "access-1", "refresh_token": "refresh-1", "expires_in": 900,
                  "user": { "id": 1, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7 }
                }
                """.trimIndent(),
            ),
        )
        val vm = LoginViewModel(repository)
        vm.onUsernameChange("alice")
        vm.onPasswordChange("secret")
        vm.submit()
        // Second tap before the first completes — should be a no-op
        // because isSubmitEnabled flips false during Submitting.
        vm.submit()
        advanceUntilIdle()

        assertEquals(
            "double-tap of the submit button must not fire a second /login",
            1,
            server.requestCount,
        )
    }

    // ---------- TwoFactorViewModel ----------

    @Test
    fun `TwoFactorViewModel requires login token nav arg`() {
        val handle = SavedStateHandle()
        try {
            id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorViewModel(repository, handle)
            org.junit.Assert.fail("expected error() when nav arg missing")
        } catch (e: IllegalStateException) {
            assertTrue(
                "error must mention the missing nav arg key",
                e.message?.contains("loginToken") == true,
            )
        }
    }

    @Test
    fun `TwoFactorViewModel onCodeChange filters non-digits and caps at 6`() {
        val vm = newTwoFactorViewModel()
        vm.onCodeChange("12abcd34*5_67890")
        assertEquals(
            "non-digits stripped, 6-digit cap enforced before any further input",
            "123456",
            vm.uiState.value.code,
        )
    }

    @Test
    fun `TwoFactorViewModel submit happy path clears code on success`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "token": "access-2", "refresh_token": "refresh-2", "expires_in": 900,
                  "user": { "id": 1, "username": "alice", "name": "Alice", "role": "owner", "tenant_id": 7 }
                }
                """.trimIndent(),
            ),
        )
        val vm = newTwoFactorViewModel()
        vm.onCodeChange("123456")

        vm.submit()
        assertEquals(
            id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorStatus.Submitting,
            vm.uiState.value.status,
        )
        advanceUntilIdle()

        val state = vm.uiState.value
        assertTrue(
            state.status is id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorStatus.Authenticated,
        )
        assertEquals(
            "code is cleared from memory after successful 2FA",
            "",
            state.code,
        )
    }

    @Test
    fun `TwoFactorViewModel submit failure returns to Idle with errorMessage`() =
        runTest(testDispatcher) {
            server.enqueue(MockResponse().setResponseCode(401))
            val vm = newTwoFactorViewModel()
            vm.onCodeChange("000000")

            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertEquals(
                id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorStatus.Idle,
                state.status,
            )
            assertEquals(
                "wrong-code copy is the 2FA-specific message from the repository",
                "Kode 2FA salah atau sesi sudah berakhir",
                state.errorMessage,
            )
        }

    @Test
    fun `TwoFactorViewModel submit incomplete code is no-op`() = runTest(testDispatcher) {
        val vm = newTwoFactorViewModel()
        vm.onCodeChange("12345") // 5 digits — submit guard must block.
        vm.submit()
        advanceUntilIdle()

        assertEquals(
            "no /login/2fa request when the code is shorter than 6 digits",
            0,
            server.requestCount,
        )
    }

    private fun newTwoFactorViewModel(): id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorViewModel {
        val handle = SavedStateHandle(
            mapOf(
                id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorViewModel.ARG_LOGIN_TOKEN
                    to "lt-abcdef",
            ),
        )
        return id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorViewModel(repository, handle)
    }
}

/**
 * In-memory [TokenStorage] for the ViewModel tests. Same shape
 * as the fakes in [id.alviarts.vipos.feature.auth.domain.AuthRepositoryTest]
 * and [id.alviarts.vipos.feature.auth.domain.AuthRepositoryRefreshTest];
 * deliberately not extracted to a shared module — see the
 * justification on `AuthRepositoryTest.kt`.
 */
private class FakeViewModelTokenStorage : TokenStorage {
    private val state = MutableStateFlow<AuthSession?>(null)
    override suspend fun read(): AuthSession? = state.value
    override val sessions: Flow<AuthSession?> = state.asStateFlow()
    override suspend fun save(session: AuthSession) {
        state.value = session
    }

    override suspend fun clear() {
        state.value = null
    }
}
