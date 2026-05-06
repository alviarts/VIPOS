package id.alviarts.vipos.core.common

/**
 * Compile-time application metadata, surfaced via the Hilt graph.
 * Lived in the `:app` module before P3-01c; moved into `:core:common`
 * so feature modules and other `:core:*` modules can read VIPOS
 * version metadata without depending on `:app`.
 *
 * The `@Provides` site stays in `:app` (`AppModule.provideAppConfig`)
 * because only the application module has access to the generated
 * `BuildConfig`.
 */
data class AppConfig(
    val appName: String,
    val versionName: String,
    val versionCode: Int,
)
