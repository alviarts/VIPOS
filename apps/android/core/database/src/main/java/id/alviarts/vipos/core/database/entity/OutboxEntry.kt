package id.alviarts.vipos.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Outbox entry for offline-first mutations (P3-09).
 *
 * Every mutation (transaction commit, void, refund, etc.) is
 * written to this table first, then drained by the
 * `OutboxWorker` when the device is online. The entry carries
 * enough information to replay the HTTP request:
 *
 *  - [method] + [path] → the HTTP verb + endpoint
 *  - [body] → the JSON request body
 *  - [idempotencyKey] → sent as `X-Idempotency-Key` header so
 *    the server can deduplicate retries
 *
 * State machine:
 *  - `PENDING` → waiting to be sent (initial state)
 *  - `SYNCING` → currently being sent by the worker
 *  - `FAILED`  → permanently failed after [maxRetries] attempts
 *    (surfaces in the "Sync Issues" screen for manual review)
 *
 * Entries are ordered by [createdAt] so the worker drains them
 * in FIFO order. The [nextRetryAt] field implements exponential
 * backoff: the worker skips entries whose next retry is in the
 * future.
 */
@Entity(
    tableName = "outbox",
    indices = [
        Index(value = ["status", "next_retry_at"], name = "idx_outbox_status_retry"),
        Index(value = ["idempotency_key"], name = "idx_outbox_idempotency", unique = true),
    ],
)
data class OutboxEntry(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    /** HTTP method: POST, PUT, DELETE. */
    @ColumnInfo(name = "method")
    val method: String,

    /** API path, e.g. "api/v1/transactions". */
    @ColumnInfo(name = "path")
    val path: String,

    /** JSON request body. */
    @ColumnInfo(name = "body")
    val body: String,

    /** UUID for server-side deduplication. */
    @ColumnInfo(name = "idempotency_key")
    val idempotencyKey: String,

    /** Current status: PENDING, SYNCING, FAILED. */
    @ColumnInfo(name = "status")
    val status: String = "PENDING",

    /** Number of send attempts so far. */
    @ColumnInfo(name = "retry_count")
    val retryCount: Int = 0,

    /** Earliest time (epoch ms) the worker should retry this entry. */
    @ColumnInfo(name = "next_retry_at")
    val nextRetryAt: Long = 0,

    /** Last error message from a failed attempt. */
    @ColumnInfo(name = "last_error")
    val lastError: String? = null,

    /** Unix epoch ms when the entry was created. */
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val STATUS_PENDING = "PENDING"
        const val STATUS_SYNCING = "SYNCING"
        const val STATUS_FAILED = "FAILED"

        /** Max retry attempts before marking as FAILED (DLQ). */
        const val MAX_RETRIES = 5
    }
}
