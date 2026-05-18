package id.alviarts.vipos.feature.auth.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import id.alviarts.vipos.feature.auth.domain.AuthSession
import id.alviarts.vipos.feature.auth.domain.AuthTokens
import id.alviarts.vipos.feature.auth.domain.AuthUser
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * DataStore Preferences-backed [TokenStorage] (P3-03a + P3-03d).
 *
 * Persists both the token primitives **and** the authenticated
 * [AuthUser] snapshot to a single preferences file
 * (`vipos_auth_tokens`) under the app's sandboxed userdata
 * directory. The DataStore APIs serialize concurrent writes for
 * us, so the [save] implementation is naturally atomic — there's
 * no read-modify-write race even across coroutines.
 *
 * Persisting the user snapshot alongside the tokens is what
 * makes P3-03d's cold-start auto-login work without a follow-up
 * `/api/v1/users/me` round-trip. When the app launches, the
 * SessionGate composable calls [read] once, and if it returns
 * a non-null bundle with a non-expired access token the nav
 * graph routes straight to the home destination.
 *
 * Older installs (pre-P3-03d, where the user fields didn't
 * exist yet) will read back `null` here even when the token
 * keys are present — the fallback path in [toAuthSession]
 * deliberately treats a partial bundle as "no session" so the
 * user is sent through the login screen exactly once and the
 * fresh write replaces the old partial bundle.
 *
 * **Wire-up**: instantiate via the file-level
 * [Context.tokenDataStore] extension property below; never call
 * the constructor directly. The single instance is owned by the
 * Hilt graph (see `:feature:auth/di/AuthModule`).
 */
private val Context.tokenDataStore by preferencesDataStore(name = "vipos_auth_tokens")

class DataStoreTokenStorage(
    private val context: Context,
) : TokenStorage {

    override suspend fun read(): AuthSession? = sessions.first()

    override val sessions: Flow<AuthSession?> =
        context.tokenDataStore.data.map { prefs -> prefs.toAuthSession() }

    override suspend fun save(session: AuthSession) {
        context.tokenDataStore.edit { prefs ->
            prefs[KEY_ACCESS_TOKEN] = session.tokens.accessToken
            prefs[KEY_REFRESH_TOKEN] = session.tokens.refreshToken
            prefs[KEY_ACCESS_EXPIRES_AT] = session.tokens.accessExpiresAtEpochSec
            prefs[KEY_USER_ID] = session.user.id
            prefs[KEY_USER_USERNAME] = session.user.username
            prefs[KEY_USER_DISPLAY_NAME] = session.user.name
            prefs[KEY_USER_ROLE] = session.user.role
            // tenantId is nullable on the domain; persist as -1 sentinel
            // when absent so a missing key + a null tenant collapse to
            // the same restored value.
            prefs[KEY_USER_TENANT_ID] = session.user.tenantId ?: TENANT_NONE
        }
    }

    override suspend fun clear() {
        context.tokenDataStore.edit { prefs -> prefs.clear() }
    }

    private fun Preferences.toAuthSession(): AuthSession? {
        val access = this[KEY_ACCESS_TOKEN] ?: return null
        val refresh = this[KEY_REFRESH_TOKEN] ?: return null
        val expiresAt = this[KEY_ACCESS_EXPIRES_AT] ?: return null
        val userId = this[KEY_USER_ID] ?: return null
        val username = this[KEY_USER_USERNAME] ?: return null
        val displayName = this[KEY_USER_DISPLAY_NAME] ?: return null
        val role = this[KEY_USER_ROLE] ?: return null
        val tenantId = this[KEY_USER_TENANT_ID]
        return AuthSession(
            tokens = AuthTokens(
                accessToken = access,
                refreshToken = refresh,
                accessExpiresAtEpochSec = expiresAt,
            ),
            user = AuthUser(
                id = userId,
                username = username,
                name = displayName,
                role = role,
                tenantId = if (tenantId == null || tenantId == TENANT_NONE) {
                    null
                } else {
                    tenantId
                },
            ),
        )
    }

    private companion object {
        val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
        val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val KEY_ACCESS_EXPIRES_AT = longPreferencesKey("access_expires_at")
        // P3-03d: user snapshot persisted alongside tokens so cold-start
        // can rehydrate the home destination without a /me round-trip.
        val KEY_USER_ID = longPreferencesKey("user_id")
        val KEY_USER_USERNAME = stringPreferencesKey("user_username")
        val KEY_USER_DISPLAY_NAME = stringPreferencesKey("user_display_name")
        val KEY_USER_ROLE = stringPreferencesKey("user_role")
        val KEY_USER_TENANT_ID = longPreferencesKey("user_tenant_id")
        const val TENANT_NONE: Long = -1L
    }
}
