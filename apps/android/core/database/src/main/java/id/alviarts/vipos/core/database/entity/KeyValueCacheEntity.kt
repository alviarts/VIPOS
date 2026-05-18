package id.alviarts.vipos.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Generic key/value cache row (P3-04).
 *
 * The first concrete entity in the database. Exists primarily to
 * exercise the Room → KSP → Hilt wiring end-to-end so subsequent
 * Phase 3 sub-PRs (offline mutation queue, settings cache, etc.)
 * can drop their entities in without re-validating the plumbing.
 *
 * Real Phase 3 entities (products, transactions, customers, …)
 * land in P3-06+ as their own typed entities; this generic
 * key/value table is intended for app-wide bits that don't
 * deserve dedicated tables (last-seen-tutorial-version, recent
 * search queries, …).
 */
@Entity(tableName = "key_value_cache")
data class KeyValueCacheEntity(
    @PrimaryKey
    @ColumnInfo(name = "key")
    val key: String,

    @ColumnInfo(name = "value")
    val value: String,

    /** Unix epoch milliseconds at which the row was last written. */
    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
)
