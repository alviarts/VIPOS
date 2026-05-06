package id.alviarts.vipos.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import id.alviarts.vipos.core.database.dao.KeyValueCacheDao
import id.alviarts.vipos.core.database.entity.KeyValueCacheEntity

/**
 * Root [RoomDatabase] for the Android client (P3-04).
 *
 * Versioning rules (apply to every PR that touches an `@Entity`):
 *
 *  1. Bump [DATABASE_VERSION] by one for every schema change.
 *  2. Add a new `Migration(prevVersion, newVersion)` object to
 *     `:app`'s `AppModule.provideVIPOSDatabase()` builder. NEVER
 *     drop existing migrations — installs in the wild may be on
 *     any prior version.
 *  3. CI's schema-export diff guard (lands in P3-04 follow-up)
 *     will reject PRs that change `schemas/<n>.json` without
 *     bumping the version.
 *
 * Today the database carries a single small entity
 * ([KeyValueCacheEntity]) so the wiring (entity → DAO → Database
 * → Hilt provider) is exercised end-to-end. Real domain entities
 * (products, transactions, sync queue, …) land in P3-06+.
 */
@Database(
    entities = [KeyValueCacheEntity::class],
    version = DATABASE_VERSION,
    exportSchema = true,
)
abstract class VIPOSDatabase : RoomDatabase() {

    abstract fun keyValueCacheDao(): KeyValueCacheDao

    companion object {
        const val DATABASE_NAME: String = "vipos.db"
    }
}

/**
 * The schema version. See [VIPOSDatabase] kdoc for the bump
 * protocol. Constant lives at file scope so the `@Database`
 * annotation can reference it (annotation arguments must be
 * compile-time constants, which `companion object const`s aren't).
 */
const val DATABASE_VERSION: Int = 1
