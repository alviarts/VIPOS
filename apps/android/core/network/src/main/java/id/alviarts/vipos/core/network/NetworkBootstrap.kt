package id.alviarts.vipos.core.network

/**
 * Placeholder for the `:core:network` module (P3-01c).
 *
 * Real networking primitives (`OkHttpClient`, `Retrofit`, JSON
 * serialization, request/response interceptors, auth token plumbing)
 * land in P3-05 (network client). This stub exists today so the
 * module is reachable from the project graph and so `:app` can
 * declare a `project(":core:network")` dependency that downstream
 * sub-PRs expand without touching `settings.gradle.kts` again.
 */
internal object NetworkBootstrap {
    const val MODULE_NAME: String = "core:network"
}
