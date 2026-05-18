plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-03a: kotlinx-serialization is needed for the auth DTOs.
    alias(libs.plugins.kotlin.serialization)
    // P3-03b: KSP runs the Hilt processor on this module so the
    // @HiltViewModel-annotated LoginViewModel gets its multibinding
    // entry generated. (Compile-time only; not packaged.)
    alias(libs.plugins.ksp)
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

    // P3-03b: Compose UI lives in this module (LoginScreen). The
    // Compose compiler version is locked against the project's
    // Kotlin version through libs.versions.toml.
    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get()
    }
}

dependencies {
    // The auth feature depends on the network module's Retrofit
    // instance + JSON codec to talk to /api/v1/auth/login.
    implementation(project(":core:network"))
    // P3-03b: theme + colors + typography come from :core:designsystem.
    implementation(project(":core:designsystem"))

    // Hilt runtime annotations (@Module / @InstallIn / @Inject /
    // @Provides / @HiltViewModel). Starting with P3-03b, the
    // Hilt KSP processor also runs in this module so the
    // @HiltViewModel-annotated LoginViewModel gets its
    // multibinding entry generated.
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    // DataStore Preferences for persistent token storage. Survives
    // process death and app upgrades; encrypted-at-rest by the OS
    // on userdata partition (modern Android devices).
    implementation(libs.androidx.datastore.preferences)

    // Coroutines runtime for suspend / Flow APIs exposed by the
    // repository + token storage.
    implementation(libs.kotlinx.coroutines.android)

    // P3-03: Biometric authentication (fingerprint/face unlock).
    implementation(libs.androidx.biometric)

    // P3-03b: Compose UI for LoginScreen. Same BOM coordinates as
    // :app so versions stay aligned.
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // P3-03b: hiltViewModel() composable + lifecycle-aware
    // ViewModel + collectAsStateWithLifecycle.
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)

    // P3-03e: unit tests for AuthRepository.refresh(). MockWebServer
    // backs a real Retrofit-built [AuthApi] (so the test exercises
    // the production wire-mapping); kotlinx-coroutines-test drives
    // the suspend boundary deterministically.
    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}
