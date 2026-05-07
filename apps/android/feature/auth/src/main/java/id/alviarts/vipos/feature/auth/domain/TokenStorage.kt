package id.alviarts.vipos.feature.auth.domain

import kotlinx.coroutines.flow.Flow

/**
 * Persistent storage for the authenticated session bundle
 * (P3-03a + P3-03d).
 *
 * "Session" = access + refresh tokens + the authenticated user
 * snapshot. The whole bundle is persisted atomically so that on
 * cold-start [P3-03d's auto-login restoration] can reconstitute
 * a logged-in `AuthUser` without an extra `/api/v1/users/me`
 * round-trip.
 *
 * Two implementations live in this module:
 *
 *  - The production [id.alviarts.vipos.feature.auth.data.DataStoreTokenStorage]
 *    backed by androidx.datastore-preferences — survives process
 *    death and app upgrades, encrypted-at-rest by the OS userdata
 *    partition on modern Android devices.
 *  - Tests can supply an in-memory fake; no test fixture ships
 *    here yet because the AuthRepository's first instrumentation
 *    suite lands later alongside the LoginScreen.
 */
interface TokenStorage {

    /** Latest snapshot of the persisted session, or `null` when no
     *  user is authenticated. Suspending so DataStore can hit disk. */
    suspend fun read(): AuthSession?

    /** Cold flow that emits whenever the persisted session changes.
     *  Use this in ViewModels for reactive auth-state UI. */
    val sessions: Flow<AuthSession?>

    /** Atomically replace the persisted bundle. */
    suspend fun save(session: AuthSession)

    /** Clear everything — call on logout or 401-driven session
     *  invalidation. */
    suspend fun clear()
}

/**
 * Plain-data bundle persisted by [TokenStorage]. The shape mirrors
 * what the backend's `/api/v1/auth/login` response carries — both
 * the token primitives and the user snapshot — so the app can
 * cold-start straight into the home destination without a follow-up
 * `/api/v1/users/me` call (P3-03d auto-login restoration).
 */
data class AuthSession(
    val tokens: AuthTokens,
    val user: AuthUser,
)

/**
 * Token-primitive subset of [AuthSession]. Carved out as its own
 * type because it's the unit that talks to the backend (auth
 * headers, refresh-token rotation), while [AuthUser] is the unit
 * that talks to the UI.
 */
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    /** Unix epoch seconds at which the access token expires. */
    val accessExpiresAtEpochSec: Long,
)
