package id.alviarts.vipos.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Records a sync conflict that needs user attention (P4-11).
 *
 * When the OutboxWorker receives a non-retryable error (400,
 * 404, 409, 422) that indicates a business conflict (e.g.
 * product deleted on server, stock changed, price updated),
 * it creates a SyncConflict entry instead of silently dropping
 * the outbox entry.
 *
 * The "Sync Issues" screen shows these alongside failed outbox
 * entries, with a human-readable description of what went wrong
 * and suggested resolution actions.
 */
@Entity(tableName = "sync_conflicts")
data class SyncConflict(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0,

    /** Type of conflict: PRODUCT_DELETED, STOCK_CHANGED, PRICE_CHANGED, etc. */
    @ColumnInfo(name = "conflict_type")
    val conflictType: String,

    /** Human-readable description of the conflict. */
    @ColumnInfo(name = "description")
    val description: String,

    /** The outbox entry ID that triggered this conflict. */
    @ColumnInfo(name = "outbox_entry_id")
    val outboxEntryId: Long? = null,

    /** JSON payload of the original request for reference. */
    @ColumnInfo(name = "original_payload")
    val originalPayload: String? = null,

    /** Server error message. */
    @ColumnInfo(name = "server_error")
    val serverError: String? = null,

    /** Resolution status: PENDING, RESOLVED, DISMISSED. */
    @ColumnInfo(name = "status")
    val status: String = "PENDING",

    /** Unix epoch ms when the conflict was detected. */
    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val STATUS_PENDING = "PENDING"
        const val STATUS_RESOLVED = "RESOLVED"
        const val STATUS_DISMISSED = "DISMISSED"

        const val TYPE_PRODUCT_DELETED = "PRODUCT_DELETED"
        const val TYPE_STOCK_INSUFFICIENT = "STOCK_INSUFFICIENT"
        const val TYPE_PRICE_CHANGED = "PRICE_CHANGED"
        const val TYPE_SHIFT_CLOSED = "SHIFT_CLOSED"
        const val TYPE_DUPLICATE = "DUPLICATE"
        const val TYPE_UNKNOWN = "UNKNOWN"
    }
}
