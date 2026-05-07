plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-08: KSP runs the Hilt processor so future `@HiltViewModel`s
    // in this module get their multibinding entries generated. The
    // initial HomeViewModel is wired here so subsequent sub-PRs
    // (P3-06 cart, P3-07 settings, …) can drop their VMs in without
    // re-validating the plumbing.
    alias(libs.plugins.ksp)
}

android {
    namespace = "id.alviarts.vipos.feature.home"
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

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get()
    }
}

dependencies {
    // The home feature uses the auth repository to drive logout +
    // observe the authenticated-user snapshot for the welcome
    // string. Future iterations will swap to a dedicated
    // user-profile repository.
    implementation(project(":feature:auth"))
    implementation(project(":core:designsystem"))

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
}
