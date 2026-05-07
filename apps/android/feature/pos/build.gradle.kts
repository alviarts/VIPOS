plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-06: kotlinx-serialization is needed for the POS DTOs that
    // map the `GET /api/v1/products` response shape.
    alias(libs.plugins.kotlin.serialization)
    // P3-06: KSP runs the Hilt processor on this module so the
    // @HiltViewModel-annotated PosCatalogueViewModel gets its
    // multibinding entry generated. Compile-time only; not packaged.
    alias(libs.plugins.ksp)
}

android {
    namespace = "id.alviarts.vipos.feature.pos"
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
    // P3-06: depends on the shared Retrofit instance + JSON codec
    // from `:core:network` (P3-05) and the auth-token plumbing
    // (`TokenStorage`) from `:feature:auth` (P3-03a). The tokens
    // themselves are read by the `AuthInterceptor` in
    // `:core:network`; this module never touches them directly,
    // it just consumes the already-authenticated `Retrofit`.
    implementation(project(":core:network"))
    implementation(project(":core:designsystem"))
    implementation(project(":feature:auth"))

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    implementation(libs.retrofit)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    // P3-06: material-icons-core ships the basic symbol set
    // (Add, ArrowBack, Refresh, Remove) used by the catalogue
    // and cart steppers. Sticking to `core` keeps the artifact
    // < 100 KB; the much larger `material-icons-extended` set
    // is only worth pulling in once the design system needs it.
    implementation(libs.androidx.compose.material.icons.core)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
}
