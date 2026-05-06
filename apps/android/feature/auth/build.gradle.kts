plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-03a: kotlinx-serialization is needed for the auth DTOs.
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "id.alviarts.vipos.feature.auth"
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
    // The auth feature depends on the network module's Retrofit
    // instance + JSON codec to talk to /api/v1/auth/login.
    implementation(project(":core:network"))

    // Hilt runtime annotations (@Module / @InstallIn / @Inject /
    // @Provides). The Hilt KSP processor itself runs in the :app
    // module — we don't need it here because this module exposes
    // no @AndroidEntryPoint or @HiltViewModel-annotated classes
    // (those land in P3-03b alongside the LoginScreen UI).
    implementation(libs.hilt.android)

    // DataStore Preferences for persistent token storage. Survives
    // process death and app upgrades; encrypted-at-rest by the OS
    // on userdata partition (modern Android devices).
    implementation(libs.androidx.datastore.preferences)

    // Coroutines runtime for suspend / Flow APIs exposed by the
    // repository + token storage.
    implementation(libs.kotlinx.coroutines.android)
}
