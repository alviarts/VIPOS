package id.alviarts.vipos.core.common

/**
 * Compile-time application metadata, surfaced via the Hilt graph.
 * Lived in the `:app` module before P3-01c; moved into `:core:common`
 * so feature modules and other `:core:*` modules can read VIPOS
 * version + environment metadata without depending on `:app`.
 *
 * The `@Provides` site stays in `:app` (`AppModule.provideAppConfig`)
 * because only the application module has access to the generated
 * `BuildConfig` (and the per-flavor [environment] / [apiBaseUrl]
 * fields it carries since P3-01d).
 */
data class AppConfig(
    val appName: String,
    val versionName: String,
    val versionCode: Int,
    /**
     * One of `"dev"`, `"staging"`, `"prod"` — sourced from the
     * matching product flavor's `BuildConfig.ENVIRONMENT` field.
     * Surfaced in the bootstrap UI so it is visually obvious which
     * variant the engineer (or founder) is poking at on a device.
     */
    val environment: String,
    /**
     * Per-flavor API base URL. P3-05 (network client) wires this
     * into the Retrofit / OkHttp base URL.
     */
    val apiBaseUrl: String,
)
