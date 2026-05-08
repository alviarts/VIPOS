package id.alviarts.vipos.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.BuildConfig
import id.alviarts.vipos.core.common.AppConfig
import id.alviarts.vipos.core.database.VIPOSDatabase
import id.alviarts.vipos.core.database.dao.KeyValueCacheDao
import id.alviarts.vipos.core.network.AuthInterceptor
import id.alviarts.vipos.core.network.AndroidConnectivityObserver
import id.alviarts.vipos.core.network.ConnectivityObserver
import id.alviarts.vipos.core.network.NetworkClientFactory
import id.alviarts.vipos.core.network.RefreshTokenAuthenticator
import id.alviarts.vipos.core.network.SessionInvalidationInterceptor
import id.alviarts.vipos.core.network.api.HealthApi
import id.alviarts.vipos.feature.auth.domain.AuthRepository
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Singleton

/**
 * Application-scoped Hilt module (P3-01b → P3-05).
 *
 * Exposes the application-level singletons that every feature
 * module can `@Inject`:
 *
 *  - [AppConfig] (from `:core:common`) — derived from `BuildConfig`,
 *    surfaces the per-flavor `ENVIRONMENT` and `API_BASE_URL`.
 *  - The network stack ([Json], [OkHttpClient], [Retrofit],
 *    [HealthApi]) — built from `:core:network/NetworkClientFactory`
 *    using `AppConfig.apiBaseUrl` so flipping flavors is the only
 *    knob to change endpoints.
 *
 * The network factories live in `:core:network` (Hilt-free) so
 * feature modules / instrumentation tests can wire alternative DI
 * graphs without dragging Hilt into that module's dependency
 * footprint. Production code always flows through this module.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAppConfig(): AppConfig = AppConfig(
        appName = "VIPOS",
        versionName = BuildConfig.VERSION_NAME,
        versionCode = BuildConfig.VERSION_CODE,
        environment = BuildConfig.ENVIRONMENT,
        apiBaseUrl = BuildConfig.API_BASE_URL,
    )

    /**
     * Single shared JSON codec — see
     * [NetworkClientFactory.json] for the configured leniency
     * options. Exposed through Hilt so non-network callers (e.g. a
     * future preferences serializer) can reuse the same instance.
     */
    @Provides
    @Singleton
    fun provideJson(): Json = NetworkClientFactory.json

    /**
     * Single shared [OkHttpClient]. Logging is enabled for
     * non-prod flavors so engineers can inspect request/response
     * bodies via logcat without touching the prod-flavor build.
     *
     * Two application interceptors are installed (in this order,
     * so logging shows the post-rewrite request and the original
     * response):
     *
     *  - **[AuthInterceptor]** (P3-06) — request-side; stamps
     *    `Authorization: Bearer <accessToken>` from the persisted
     *    [TokenStorage] on every authenticated endpoint.
     *  - **[SessionInvalidationInterceptor]** (P3-03f) —
     *    response-side; on a 401 from an authenticated endpoint
     *    clears the persisted session via `tokenStorage.clear()`.
     *    The clear emits down `tokenStorage.sessions`, which
     *    `SessionViewModel` observes — `SessionGate` then rebuilds
     *    the nav graph rooted at `Login`, bouncing the user
     *    mid-session without any explicit nav code at the call
     *    site.
     *
     * One [okhttp3.Authenticator] is installed:
     *
     *  - **[RefreshTokenAuthenticator]** (P3-03e) — runs on every
     *    401, exchanges the persisted refresh token for a fresh
     *    access + refresh pair, and returns a retried request
     *    with the new Bearer. If refresh fails the original 401
     *    propagates and `SessionInvalidationInterceptor` clears
     *    the session.
     *
     * The Authenticator delegates to [AuthRepository.refresh] via
     * a `dagger.Lazy<AuthRepository>` to break the DI cycle:
     * AuthRepository depends on AuthApi which depends on
     * Retrofit which depends on this very [OkHttpClient]. Lazy
     * defers the AuthRepository instantiation until the first
     * 401 actually fires — by which time the entire graph is
     * fully built. The [AuthRepository.refresh] call itself
     * goes through this same OkHttpClient, but
     * [AuthInterceptor]/[SessionInvalidationInterceptor]/[RefreshTokenAuthenticator]
     * all skip `/auth/refresh` so there's no recursion.
     *
     * Bridging callbacks use `runBlocking` to translate the
     * suspending [TokenStorage] / [AuthRepository] APIs into the
     * synchronous contract OkHttp expects. This is acceptable
     * because OkHttp dispatches interceptors + the
     * Authenticator on its own thread pool (never the main
     * thread), and DataStore reads/writes are local-disk
     * roundtrips.
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        config: AppConfig,
        tokenStorage: TokenStorage,
        authRepository: dagger.Lazy<AuthRepository>,
    ): OkHttpClient =
        NetworkClientFactory.provideOkHttpClient(
            loggingEnabled = config.environment != "prod",
            applicationInterceptors = listOf(
                AuthInterceptor {
                    runBlocking { tokenStorage.read()?.tokens?.accessToken }
                },
                SessionInvalidationInterceptor {
                    runBlocking { tokenStorage.clear() }
                },
            ),
            authenticator = RefreshTokenAuthenticator {
                runBlocking { authRepository.get().refresh() }
            },
        )

    /**
     * Application-scoped [Retrofit] bound to the per-flavor
     * `API_BASE_URL`. P3-01d's [AppConfig.apiBaseUrl] is the only
     * input that varies between flavors — feature modules don't
     * need to know which environment they're running against.
     */
    @Provides
    @Singleton
    fun provideRetrofit(
        config: AppConfig,
        okHttp: OkHttpClient,
        json: Json,
    ): Retrofit = NetworkClientFactory.provideRetrofit(
        baseUrl = config.apiBaseUrl,
        okHttp = okHttp,
        json = json,
    )

    /**
     * Smoke-test API: [HealthApi] hits `GET /api/v1/health`. P3-05
     * does NOT call this on cold-start — it only proves the
     * provider chain (Retrofit -> create<HealthApi>()) compiles
     * and instantiates. A real ping-on-launch (gated by network
     * availability + a kill-switch) lands in a later phase.
     */
    @Provides
    @Singleton
    fun provideHealthApi(retrofit: Retrofit): HealthApi = retrofit.create()

    /**
     * Application-scoped [VIPOSDatabase] (P3-04).
     *
     * Built once per process via [Room.databaseBuilder]. The
     * builder defaults are deliberate:
     *  - **No `fallbackToDestructiveMigration()`** — every schema
     *    change MUST ship an explicit `Migration(prevVersion,
     *    newVersion)`. The schema-export-diff CI guard (lands in
     *    a P3-04 follow-up) makes this enforceable.
     *  - **No `allowMainThreadQueries()`** — Room's main-thread
     *    block is the right default; all DAO calls in this
     *    project are suspending or Flow-based.
     *
     * `:app` builds the database against the application context
     * so the connection lifecycle matches the process lifecycle.
     * Feature modules consume DAOs through Hilt — they never see
     * the [VIPOSDatabase] handle directly.
     */
    @Provides
    @Singleton
    fun provideVIPOSDatabase(
        @ApplicationContext context: Context,
    ): VIPOSDatabase = Room.databaseBuilder(
        context,
        VIPOSDatabase::class.java,
        VIPOSDatabase.DATABASE_NAME,
    ).build()

    @Provides
    @Singleton
    fun provideKeyValueCacheDao(database: VIPOSDatabase): KeyValueCacheDao =
        database.keyValueCacheDao()

    /**
     * Application-scoped [ConnectivityObserver] (P3-08 slice 5c
     * follow-up).
     *
     * Wraps the system [android.net.ConnectivityManager] in a
     * reactive [kotlinx.coroutines.flow.Flow<Boolean>] that emits
     * `true` when the device has internet and `false` when it
     * doesn't. Feature modules (`:feature:pos`) collect this flow
     * to gate online-only payment methods (QRIS Dynamic, e-wallets)
     * in the checkout picker.
     *
     * Returns the [ConnectivityObserver] interface so feature
     * modules can substitute a fake in unit tests without pulling
     * in Android framework classes.
     */
    @Provides
    @Singleton
    fun provideConnectivityObserver(
        @ApplicationContext context: Context,
    ): ConnectivityObserver = AndroidConnectivityObserver(context)
}
