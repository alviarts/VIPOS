plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
}

android {
    namespace = "id.alviarts.vipos"
    // Match Phase 3 spec: Min SDK 21 (Android 5.0) — Majoo Lite parity.
    // Target SDK 34 (Android 14).
    compileSdk = 34

    defaultConfig {
        applicationId = "id.alviarts.vipos"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "0.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }
    }

    // P3-01d: three product flavors carry the per-environment
    // configuration (API base URL, applicationId suffix, visual
    // label). The `dimension` is required by AGP whenever any
    // flavor is declared.
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            // Distinct applicationId so dev / staging / prod APKs can
            // coexist on the same device without uninstall churn.
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            // 10.0.2.2 is the Android-emulator alias for the host's
            // loopback interface; engineers running the backend at
            // localhost:3001 reach it from the emulator via this URL.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001\"")
            buildConfigField("String", "ENVIRONMENT", "\"dev\"")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            // VPS staging endpoint. P3-05 (network client) wires this
            // into the Retrofit base URL.
            buildConfigField("String", "API_BASE_URL", "\"http://103.74.5.44\"")
            buildConfigField("String", "ENVIRONMENT", "\"staging\"")
        }
        create("prod") {
            dimension = "environment"
            // Production endpoint — placeholder until Phase 4 turns
            // on the public domain. P3-01d only wires the constant;
            // the actual cut-over is gated by the founder.
            buildConfigField("String", "API_BASE_URL", "\"https://vipos.id\"")
            buildConfigField("String", "ENVIRONMENT", "\"prod\"")
        }
    }

    buildTypes {
        release {
            // R8 / minification + resource shrinking stay OFF until
            // Phase 3 has actual code to shrink. Hilt + AndroidX ship
            // their own consumer ProGuard rules inside their AARs;
            // app-specific keep rules (if any) will go into
            // proguard-rules.pro alongside that future flip.
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        // Pinned via libs.versions.toml; bump in lockstep with Kotlin
        // per https://developer.android.com/jetpack/androidx/releases/compose-kotlin
        kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get()
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // P3-01c: depend on the project's `:core:*` library modules.
    // `:core:common` carries shared value types (e.g. AppConfig).
    // `:core:designsystem` carries the VIPOSTheme + Material 3
    // ColorScheme. `:core:network` and `:core:database` ship empty
    // placeholders today; their concrete primitives land in P3-04
    // and P3-05 respectively.
    implementation(project(":core:common"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:network"))
    implementation(project(":core:database"))

    // P3-03a/b: feature modules. `:feature:auth` carries both the
    // data layer (Retrofit AuthApi + DataStore TokenStorage +
    // AuthRepository) and the LoginScreen UI.
    implementation(project(":feature:auth"))
    // P3-08: post-auth landing destination. The kasir UI lands
    // in P3-06; for now this module ships a placeholder
    // HomeScreen that the nav graph routes to after login.
    implementation(project(":feature:home"))
    // P3-06: kasir POS catalogue + cart UI. First authenticated
    // feature in the app — exercises the AuthInterceptor by
    // calling `GET /api/v1/products` through the shared Retrofit.
    implementation(project(":feature:pos"))

    // P3-06: `:app/AppModule` uses `runBlocking { tokenStorage.read() }`
    // to bridge the suspending TokenStorage API to the synchronous
    // contract expected by OkHttp's `AuthInterceptor`. Pull in the
    // coroutines core via the android artifact (which itself
    // transitively brings core) so the import resolves at compile
    // time — feature-module `implementation` deps don't propagate.
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.androidx.core.ktx)
    // Backport of the SplashScreen APIs (P3-01e) — provides a
    // consistent splash window across API 21..31+ and lets us swap
    // out for the postSplashScreenTheme exactly once at MainActivity
    // bootstrap.
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    // P3-08: navigation-compose hosts the in-app NavHost. The
    // graph is defined in id.alviarts.vipos.navigation.VIPOSNavHost
    // and currently routes between login + home.
    implementation(libs.androidx.navigation.compose)

    // P3-03d: SessionGate (in :app/navigation) needs the
    // Compose-Hilt-ViewModel bridge — `hiltViewModel()` resolves
    // its `@HiltViewModel` SessionViewModel; `lifecycle-runtime-compose`
    // ships `collectAsStateWithLifecycle` (separate artifact from
    // `lifecycle-viewmodel-compose`).
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)

    // Hilt DI (P3-01b). KSP is the modern annotation processor — kapt
    // is deprecated for Hilt since 2.48. Hilt's own consumer ProGuard
    // rules ship with the runtime AAR; no manual proguard config
    // needed for the Hilt graph itself.
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    // P3-09: WorkManager for background outbox drain. The worker
    // runs when the device has network connectivity and drains
    // pending outbox entries to the server.
    implementation(libs.androidx.work.runtime.ktx)

    debugImplementation(libs.androidx.compose.ui.tooling)

    // P3-10: unit tests for the reactive `SessionViewModel`
    // (P3-03d + P3-03f). The VM owns a `viewModelScope`-rooted
    // Flow; `kotlinx-coroutines-test` lets the test inject a
    // `StandardTestDispatcher` so the Flow's emissions run
    // deterministically, and Turbine asserts against them
    // without the manual `toList(buffer)` + `advanceUntilIdle`
    // dance.
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
