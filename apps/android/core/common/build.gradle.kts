plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "id.alviarts.vipos.core.common"
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
    // FlowExtensions needs kotlinx-coroutines Flow types.
    api(libs.kotlinx.coroutines.android)

    // Unit tests
    testImplementation(libs.junit)
}
