package id.alviarts.vipos.feature.auth.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import id.alviarts.vipos.feature.auth.domain.AuthTokens
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * DataStore Preferences-backed [TokenStorage] (P3-03a).
 *
 * Persists the access + refresh token bundle to a single
 * preferences file (`vipos_auth_tokens`) under the app's
 * sandboxed userdata directory. The DataStore APIs serialize
 * concurrent writes for us, so the [save] implementation is
 * naturally atomic — there's no read-modify-write race even
 * across coroutines.
 *
 * **Wire-up**: instantiate via the file-level
 * [Context.tokenDataStore] extension property below; never call
 * the constructor directly. The single instance is owned by the
 * Hilt graph (see `:app/AppModule` once P3-03b lands the binding).
 */
private val Context.tokenDataStore by preferencesDataStore(name = "vipos_auth_tokens")

class DataStoreTokenStorage(
    private val context: Context,
) : TokenStorage {

    override suspend fun read(): AuthTokens? = tokens.first()

    override val tokens: Flow<AuthTokens?> =
        context.tokenDataStore.data.map { prefs -> prefs.toAuthTokens() }

    override suspend fun save(tokens: AuthTokens) {
        context.tokenDataStore.edit { prefs ->
            prefs[KEY_ACCESS_TOKEN] = tokens.accessToken
            prefs[KEY_REFRESH_TOKEN] = tokens.refreshToken
            prefs[KEY_ACCESS_EXPIRES_AT] = tokens.accessExpiresAtEpochSec
        }
    }

    override suspend fun clear() {
        context.tokenDataStore.edit { prefs -> prefs.clear() }
    }

    private fun Preferences.toAuthTokens(): AuthTokens? {
        val access = this[KEY_ACCESS_TOKEN] ?: return null
        val refresh = this[KEY_REFRESH_TOKEN] ?: return null
        val expiresAt = this[KEY_ACCESS_EXPIRES_AT] ?: return null
        return AuthTokens(
            accessToken = access,
            refreshToken = refresh,
            accessExpiresAtEpochSec = expiresAt,
        )
    }

    private companion object {
        val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
        val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val KEY_ACCESS_EXPIRES_AT = longPreferencesKey("access_expires_at")
    }
}
