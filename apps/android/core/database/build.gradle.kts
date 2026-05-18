plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    // P3-04: Room ships its annotation processor through KSP since
    // 2.6.0. The processor generates the concrete DAO + Database
    // implementations into the module's build directory at compile
    // time.
    alias(libs.plugins.ksp)
}

android {
    namespace = "id.alviarts.vipos.core.database"
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

// P3-04: Room schema export. The exported JSON files are the
// canonical source for migration tests in later phases — once a
// schema lands in main its file should NOT be edited; later
// schema bumps are expressed as new versions + Migration objects
// that the schema-export-diff CI guard enforces.
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    // Room runtime (database + entities + DAO interfaces) and the
    // KTX layer that exposes suspend / Flow APIs on top. Exposed
    // as `api` because the public surface of `:core:database`
    // returns Room types directly — without `api`, the Hilt KSP
    // processor in `:app` can't resolve the @Provides return
    // types (same gotcha pattern as P3-05 / :core:network).
    api(libs.androidx.room.runtime)
    api(libs.androidx.room.ktx)

    // KSP processor — runs only at compile time, not packaged.
    ksp(libs.androidx.room.compiler)
}
