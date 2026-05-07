plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-05: kotlinx-serialization is the JSON codec for the network
    // stack. The plugin generates the @Serializable companion
    // serializers at compile time.
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "id.alviarts.vipos.core.network"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // OkHttp + Retrofit + kotlinx-serialization. The factory in
    // NetworkClientFactory.kt is intentionally framework-agnostic
    // (no Hilt) — the `:app` module provides the singletons via
    // its AppModule and feature modules consume the resulting
    // OkHttpClient / Retrofit / Json directly through Hilt.
    //
    // These are exposed as `api` (rather than `implementation`)
    // because the public surface of `:core:network` returns
    // `OkHttpClient`, `Retrofit`, and `Json` directly — consumers
    // (including the Hilt processor running in `:app`) need them
    // on their compile classpath to resolve the return types of
    // `@Provides` methods.
    api(libs.okhttp)
    api(libs.okhttp.logging.interceptor)
    api(libs.retrofit)
    api(libs.retrofit.kotlinx.serialization.converter)
    api(libs.kotlinx.serialization.json)

    // P3-10: unit-test deps — exercises the request-side
    // `AuthInterceptor` (Bearer injection) and the response-side
    // `SessionInvalidationInterceptor` (401 → callback) against
    // a real `MockWebServer`. Stays under `testImplementation`
    // so the test classpath is the only place these end up.
    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
}
