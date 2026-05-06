package id.alviarts.vipos.feature.auth.domain

import kotlinx.coroutines.flow.Flow

/**
 * Persistent storage for auth tokens (P3-03a).
 *
 * The contract is intentionally tiny: callers can read the
 * current snapshot, observe changes through a [Flow], or update
 * the whole token bundle atomically. The repository decides
 * which token to read for which call (access for `Authorization`
 * headers, refresh for token-rotation flows).
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

    /** Latest snapshot of the persisted tokens, or `null` when no
     *  user is authenticated. Suspending so DataStore can hit disk. */
    suspend fun read(): AuthTokens?

    /** Cold flow that emits whenever the persisted tokens change.
     *  Use this in ViewModels for reactive auth-state UI. */
    val tokens: Flow<AuthTokens?>

    /** Atomically replace the persisted bundle. */
    suspend fun save(tokens: AuthTokens)

    /** Clear everything — call on logout or 401-driven session
     *  invalidation. */
    suspend fun clear()
}

/**
 * Plain-data bundle persisted by [TokenStorage]. The shape mirrors
 * what the backend's `/api/v1/auth/login` response carries except
 * for the user object, which is held separately by the ViewModel
 * layer for now.
 */
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    /** Unix epoch seconds at which the access token expires. */
    val accessExpiresAtEpochSec: Long,
)
