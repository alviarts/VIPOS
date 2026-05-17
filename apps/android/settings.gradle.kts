pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "VIPOS"

// :app is the only Android `application` module; the `:core:*` modules
// are AGP `library` modules that the app composes (P3-01c). New
// feature modules will follow the same `:feature:*` naming convention
// in subsequent Phase 3 PRs.
include(":app")
include(":core:common")
include(":core:designsystem")
include(":core:network")
include(":core:database")
include(":core:crashlytics")
include(":feature:auth")
// P3-08: Home is the post-auth landing surface. The full kasir
// UI lands in P3-06; for now this module ships a placeholder
// HomeScreen that the nav graph routes to after login.
include(":feature:home")
// P3-06: POS (kasir) catalogue + cart UI. Hosts the first
// authenticated feature in the app — the `:feature:pos`
// catalogue screen calls `GET /api/v1/products` through the
// shared Retrofit / OkHttp client decorated by the new
// `AuthInterceptor` (in `:core:network`) which injects
// `Authorization: Bearer <accessToken>` from the persisted
// `TokenStorage` session bundle.
include(":feature:pos")
