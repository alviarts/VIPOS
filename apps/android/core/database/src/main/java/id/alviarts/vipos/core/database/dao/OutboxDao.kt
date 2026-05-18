package id.alviarts.vipos.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import id.alviarts.vipos.core.database.entity.OutboxEntry
import kotlinx.coroutines.flow.Flow

/**
 * DAO for the outbox table (P3-09).
 *
 * The outbox is the core of the offline-first pattern: mutations
 * are written here first, then drained by the `OutboxWorker`
 * when the device is online.
 */
@Dao
interface OutboxDao {

    /**
     * Insert a new outbox entry. Returns the auto-generated ID.
     */
    @Insert
    suspend fun insert(entry: OutboxEntry): Long

    /**
     * Get all entries ready to be sent: status is PENDING and
     * next_retry_at is in the past (or zero). Ordered by
     * created_at ASC (FIFO).
     */
    @Query(
        """
        SELECT * FROM outbox
        WHERE status = 'PENDING' AND next_retry_at <= :nowMs
        ORDER BY created_at ASC
        """,
    )
    suspend fun allReady(nowMs: Long = System.currentTimeMillis()): List<OutboxEntry>

    /**
     * Mark an entry as SYNCING (in-flight).
     */
    @Query("UPDATE outbox SET status = 'SYNCING' WHERE id = :id")
    suspend fun markSyncing(id: Long)

    /**
     * Delete a successfully synced entry.
     */
    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun delete(id: Long)

    /**
     * Mark an entry as failed with error details and schedule
     * the next retry.
     */
    @Query(
        """
        UPDATE outbox
        SET status = :status,
            retry_count = :retryCount,
            next_retry_at = :nextRetryAt,
            last_error = :lastError
        WHERE id = :id
        """,
    )
    suspend fun markRetryOrFailed(
        id: Long,
        status: String,
        retryCount: Int,
        nextRetryAt: Long,
        lastError: String?,
    )

    /**
     * Count pending entries (for badge / indicator).
     */
    @Query("SELECT COUNT(*) FROM outbox WHERE status = 'PENDING'")
    fun countPending(): Flow<Int>

    /**
     * Count failed entries (DLQ — for "Sync Issues" badge).
     */
    @Query("SELECT COUNT(*) FROM outbox WHERE status = 'FAILED'")
    fun countFailed(): Flow<Int>

    /**
     * Get all failed entries for the "Sync Issues" screen.
     */
    @Query("SELECT * FROM outbox WHERE status = 'FAILED' ORDER BY created_at DESC")
    suspend fun allFailed(): List<OutboxEntry>

    /**
     * Retry a failed entry: reset status to PENDING, clear
     * retry count.
     */
    @Query(
        """
        UPDATE outbox
        SET status = 'PENDING', retry_count = 0, next_retry_at = 0, last_error = NULL
        WHERE id = :id AND status = 'FAILED'
        """,
    )
    suspend fun retryFailed(id: Long)

    /**
     * Delete a failed entry (user chose to discard).
     */
    @Query("DELETE FROM outbox WHERE id = :id AND status = 'FAILED'")
    suspend fun deleteFailed(id: Long)

    /**
     * Reset any SYNCING entries back to PENDING on app startup
     * (in case the worker was killed mid-flight).
     */
    @Query("UPDATE outbox SET status = 'PENDING' WHERE status = 'SYNCING'")
    suspend fun resetStaleInFlight()
}
