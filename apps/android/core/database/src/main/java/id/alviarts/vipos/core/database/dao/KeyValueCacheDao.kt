package id.alviarts.vipos.core.database.dao

import androidx.room.Dao
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import id.alviarts.vipos.core.database.entity.KeyValueCacheEntity
import kotlinx.coroutines.flow.Flow

/**
 * DAO for [KeyValueCacheEntity] (P3-04).
 *
 * Exposes both blocking-suspend and `Flow`-reactive readers so
 * call-sites can pick the right idiom for their context. All
 * writes go through the suspending [upsert] for atomicity.
 */
@Dao
interface KeyValueCacheDao {

    @Query("SELECT * FROM key_value_cache WHERE key = :key LIMIT 1")
    suspend fun get(key: String): KeyValueCacheEntity?

    @Query("SELECT * FROM key_value_cache WHERE key = :key LIMIT 1")
    fun observe(key: String): Flow<KeyValueCacheEntity?>

    @Upsert(entity = KeyValueCacheEntity::class)
    suspend fun upsert(row: KeyValueCacheEntity)

    @Query("DELETE FROM key_value_cache WHERE key = :key")
    suspend fun delete(key: String)

    @Query("DELETE FROM key_value_cache")
    suspend fun clear()
}
