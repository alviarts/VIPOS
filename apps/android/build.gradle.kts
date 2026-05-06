// Top-level Gradle build script. The version-catalog
// `gradle/libs.versions.toml` is the single source of truth for plugin
// + library versions; sub-modules reference entries from it.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.hilt.android) apply false
    alias(libs.plugins.ksp) apply false
}
