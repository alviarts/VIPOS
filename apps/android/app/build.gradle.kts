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

    buildTypes {
        release {
            // Phase 3 will add ProGuard rules + signing config in a
            // follow-up PR (P3-01d). For the bootstrap PR, debug-style
            // release is enough for `assembleDebug` / `assembleRelease`
            // to both succeed in CI.
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

    // Hilt DI (P3-01b). KSP is the modern annotation processor — kapt
    // is deprecated for Hilt since 2.48. Hilt's own consumer ProGuard
    // rules ship with the runtime AAR; no manual proguard config
    // needed for the Hilt graph itself.
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    debugImplementation(libs.androidx.compose.ui.tooling)
}
