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
include(":feature:auth")
