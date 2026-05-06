package id.alviarts.vipos.core.network

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Framework-agnostic factory for the network stack (P3-05).
 *
 * Produces the three primitives that downstream feature modules
 * inject through Hilt: an [OkHttpClient] (with logging gated by the
 * caller), a JSON serializer, and a [Retrofit] instance bound to
 * the per-flavor `API_BASE_URL` (see P3-01d).
 *
 * Why no Hilt here: keeping `:core:network` Hilt-free means feature
 * modules can wire alternative DI graphs (or instrumentation tests
 * that hand-roll fakes) without dragging Hilt into the module
 * graph. The canonical wiring still flows through `:app`'s
 * `AppModule`, which calls these factories with the production
 * `AppConfig` values.
 *
 * Default timeouts (10 s connect / 30 s read / 30 s write) match
 * the OkHttp 4.12 defaults; the Phase 3 backend's `/api/v1/health`
 * responds in <100 ms so these are generous. P3-06 (cart) may
 * tighten them once a real RTT histogram exists.
 */
object NetworkClientFactory {

    /**
     * The single, shared JSON codec for the network stack. Settings:
     *  - `ignoreUnknownKeys = true` so a backend addition of a new
     *    field doesn't crash the client mid-rollout.
     *  - `coerceInputValues = true` so a `null` for a non-nullable
     *    primitive falls back to its default rather than throwing
     *    (defends against backend nullability drift).
     *  - `isLenient = true` so quoted-number / non-strict JSON
     *    coming from any third-party endpoint still parses.
     */
    val json: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    /**
     * Build an [OkHttpClient] tuned for the VIPOS Android client.
     *
     * @param loggingEnabled when `true`, attaches a body-level
     *   [HttpLoggingInterceptor]. Callers in production code should
     *   pass `BuildConfig.DEBUG` (or, more precisely, only `true`
     *   for the `dev` and `staging` flavors) to avoid leaking
     *   request/response bodies into production logs.
     */
    fun provideOkHttpClient(loggingEnabled: Boolean): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        if (loggingEnabled) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(logging)
        }

        return builder.build()
    }

    /**
     * Build a [Retrofit] bound to [baseUrl], using the supplied
     * [okHttp] client and [json] codec.
     *
     * The base URL must end with a `/` for relative `@GET` paths
     * to resolve correctly — Retrofit enforces this at instance
     * construction. P3-01d's `BuildConfig.API_BASE_URL` does NOT
     * include a trailing slash today (e.g. `http://10.0.2.2:3001`),
     * so we normalize here so callers can keep the constant clean.
     */
    fun provideRetrofit(
        baseUrl: String,
        okHttp: OkHttpClient,
        json: Json = this.json,
    ): Retrofit {
        val normalizedBaseUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        val contentType = "application/json".toMediaType()

        return Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }
}
