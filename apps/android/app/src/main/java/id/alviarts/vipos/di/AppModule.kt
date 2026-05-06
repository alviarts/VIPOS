package id.alviarts.vipos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.BuildConfig
import id.alviarts.vipos.core.common.AppConfig
import id.alviarts.vipos.core.network.NetworkClientFactory
import id.alviarts.vipos.core.network.api.HealthApi
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
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(config: AppConfig): OkHttpClient =
        NetworkClientFactory.provideOkHttpClient(
            loggingEnabled = config.environment != "prod",
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
}
