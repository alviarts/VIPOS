package id.alviarts.vipos

/**
 * Compile-time application metadata, surfaced via the Hilt graph
 * (`AppModule.provideAppConfig`). Lives in the `:app` module today;
 * P3-01c will move it to `:core:common` along with other shared
 * value types.
 */
data class AppConfig(
    val appName: String,
    val versionName: String,
    val versionCode: Int,
)
