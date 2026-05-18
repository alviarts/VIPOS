package id.alviarts.vipos.navigation

import app.cash.turbine.test
import id.alviarts.vipos.feature.auth.domain.AuthSession
import id.alviarts.vipos.feature.auth.domain.AuthTokens
import id.alviarts.vipos.feature.auth.domain.AuthUser
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [SessionViewModel] (P3-10).
 *
 * Exercises the reactive `tokenStorage.sessions` observation
 * landed in P3-03f. The VM owns a `viewModelScope`-rooted
 * [kotlinx.coroutines.flow.StateFlow]; the test injects a
 * [StandardTestDispatcher] via `Dispatchers.setMain` so the
 * Flow's emissions can be driven deterministically with
 * `runTest` + Turbine's `flow.test {}` block.
 *
 * The fake [FakeTokenStorage] exposes the same contract as the
 * production `DataStoreTokenStorage` minus the disk I/O —
 * `sessions` is backed by a `MutableStateFlow` so the test can
 * push emissions directly. `read` / `save` / `clear` are no-ops
 * because the VM only consumes `sessions`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var fakeStorage: FakeTokenStorage

    @Before
    fun setUp() {
        // SessionViewModel uses `viewModelScope.launch` which
        // resolves to `Dispatchers.Main.immediate`; the test
        // dispatcher overrides that so emissions are driven by
        // `runCurrent()` / `advanceUntilIdle()` from `runTest`
        // instead of the real Android main thread (which doesn't
        // exist on the JVM unit-test classpath anyway).
        Dispatchers.setMain(testDispatcher)
        fakeStorage = FakeTokenStorage()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `emits NotRestored when sessions is null on first emission`() = runTest(testDispatcher) {
        fakeStorage.set(null)

        val vm = SessionViewModel(fakeStorage)

        vm.state.test {
            assertEquals(SessionRestoration.Loading, awaitItem())
            assertEquals(SessionRestoration.NotRestored, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emits Restored with display name when session is non-expired`() = runTest(testDispatcher) {
        fakeStorage.set(sampleSession(name = "Halim", expiresInSec = 600))

        val vm = SessionViewModel(fakeStorage)

        vm.state.test {
            assertEquals(SessionRestoration.Loading, awaitItem())
            val emitted = awaitItem()
            assertTrue(
                "expected Restored, got $emitted",
                emitted is SessionRestoration.Restored,
            )
            assertEquals(
                "Halim",
                (emitted as SessionRestoration.Restored).displayName,
            )
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emits NotRestored when session access token already expired`() = runTest(testDispatcher) {
        // Token expired 60 seconds ago — well past the 10-second
        // safety margin baked into SessionViewModel.
        fakeStorage.set(sampleSession(expiresInSec = -60))

        val vm = SessionViewModel(fakeStorage)

        vm.state.test {
            assertEquals(SessionRestoration.Loading, awaitItem())
            assertEquals(SessionRestoration.NotRestored, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `emits NotRestored when token expires within margin`() = runTest(testDispatcher) {
        // 5 seconds is less than the 10-second margin; treated as
        // already-expired. This is the "race the refresh flow"
        // case that the margin is designed to prevent.
        fakeStorage.set(sampleSession(expiresInSec = 5))

        val vm = SessionViewModel(fakeStorage)

        vm.state.test {
            assertEquals(SessionRestoration.Loading, awaitItem())
            assertEquals(SessionRestoration.NotRestored, awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `transitions Restored to NotRestored when session cleared mid-runtime`() =
        runTest(testDispatcher) {
            // P3-03f bounce-to-login: when SessionInvalidationInterceptor
            // clears tokenStorage on a 401, the VM should surface
            // the Flow emission as NotRestored. SessionGate's
            // `when` block reacts to the new state by rebuilding
            // VIPOSNavHost rooted at Login.
            fakeStorage.set(sampleSession(name = "Halim", expiresInSec = 600))

            val vm = SessionViewModel(fakeStorage)

            vm.state.test {
                assertEquals(SessionRestoration.Loading, awaitItem())
                val first = awaitItem()
                assertTrue(first is SessionRestoration.Restored)

                fakeStorage.set(null)

                assertEquals(SessionRestoration.NotRestored, awaitItem())
                cancelAndIgnoreRemainingEvents()
            }
        }

    @Test
    fun `transitions NotRestored to Restored when login persists session`() =
        runTest(testDispatcher) {
            // Login flow: user enters credentials, the repository
            // persists the session, the Flow emits the new
            // session, and the VM transitions from NotRestored
            // back to Restored. SessionGate then rebuilds the
            // NavHost rooted at Home.
            fakeStorage.set(null)

            val vm = SessionViewModel(fakeStorage)

            vm.state.test {
                assertEquals(SessionRestoration.Loading, awaitItem())
                assertEquals(SessionRestoration.NotRestored, awaitItem())

                fakeStorage.set(sampleSession(name = "Halim", expiresInSec = 600))

                val emitted = awaitItem()
                assertTrue(
                    "expected Restored, got $emitted",
                    emitted is SessionRestoration.Restored,
                )
                assertEquals(
                    "Halim",
                    (emitted as SessionRestoration.Restored).displayName,
                )
                cancelAndIgnoreRemainingEvents()
            }
        }

    private fun sampleSession(
        name: String = "Halim",
        expiresInSec: Long = 600,
    ): AuthSession {
        val nowSec = System.currentTimeMillis() / 1000
        return AuthSession(
            tokens = AuthTokens(
                accessToken = "access-test",
                refreshToken = "refresh-test",
                accessExpiresAtEpochSec = nowSec + expiresInSec,
            ),
            user = AuthUser(
                id = 42L,
                username = "halim",
                name = name,
                role = "admin",
                tenantId = 1L,
            ),
        )
    }

    /**
     * Test double for [TokenStorage] backed by a
     * [MutableStateFlow]. The VM only consumes [sessions]; the
     * other API surface is left as no-ops because exercising
     * them would mean testing the VM's reactive contract
     * indirectly through the storage instead of directly.
     */
    private class FakeTokenStorage : TokenStorage {
        private val backing = MutableStateFlow<AuthSession?>(null)

        override suspend fun read(): AuthSession? = backing.value
        override val sessions: Flow<AuthSession?> = backing
        override suspend fun save(session: AuthSession) {
            backing.value = session
        }

        override suspend fun clear() {
            backing.value = null
        }

        fun set(session: AuthSession?) {
            backing.value = session
        }
    }
}
