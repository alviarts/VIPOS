package id.alviarts.vipos.core.database

/**
 * Placeholder for the `:core:database` module (P3-01c).
 *
 * Real persistence primitives (`RoomDatabase`, DAOs, type converters,
 * migrations) land in P3-04 (offline-first SQLite). This stub exists
 * today so the module is reachable from the project graph and so
 * `:app` can declare a `project(":core:database")` dependency that
 * downstream sub-PRs expand without touching `settings.gradle.kts`
 * again.
 */
internal object DatabaseBootstrap {
    const val MODULE_NAME: String = "core:database"
}
