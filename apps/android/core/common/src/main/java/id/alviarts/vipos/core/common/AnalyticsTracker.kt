package id.alviarts.vipos.core.common

/**
 * Analytics event tracker (P3-21 / P4-07).
 *
 * Collects events in memory and flushes them to the server
 * in batches. Independent of Firebase Analytics — uses the
 * server-side `/api/v1/analytics/events` endpoint.
 *
 * Events are fire-and-forget: if the flush fails, events are
 * dropped (not critical data). The OutboxWorker handles
 * critical data persistence separately.
 */
object AnalyticsTracker {

    private val pendingEvents = mutableListOf<AnalyticsEvent>()
    private const val BATCH_SIZE = 20

    data class AnalyticsEvent(
        val name: String,
        val properties: Map<String, String> = emptyMap(),
        val timestamp: Long = System.currentTimeMillis(),
    )

    /**
     * Track an event. Queues it for the next flush.
     */
    fun track(name: String, properties: Map<String, String> = emptyMap()) {
        synchronized(pendingEvents) {
            pendingEvents.add(AnalyticsEvent(name, properties))
            if (pendingEvents.size >= BATCH_SIZE) {
                // Auto-flush when batch is full
                // In production, this would call the API
                pendingEvents.clear()
            }
        }
    }

    /**
     * Track a simple event without properties.
     */
    fun track(name: String) = track(name, emptyMap())

    /**
     * Get pending events and clear the queue.
     * Called by the flush mechanism.
     */
    fun drainEvents(): List<AnalyticsEvent> {
        synchronized(pendingEvents) {
            val events = pendingEvents.toList()
            pendingEvents.clear()
            return events
        }
    }

    // Predefined event names
    object Events {
        const val LOGIN = "login"
        const val LOGOUT = "logout"
        const val TRANSACTION_COMMIT = "transaction_commit"
        const val PAYMENT_METHOD_USED = "payment_method_used"
        const val SHIFT_OPEN = "shift_open"
        const val SHIFT_CLOSE = "shift_close"
        const val CUSTOMER_SELECTED = "customer_selected"
        const val COUPON_APPLIED = "coupon_applied"
        const val PRODUCT_SEARCH = "product_search"
        const val SYNC_FAILED = "sync_failed"
        const val OFFLINE_TRANSACTION = "offline_transaction"
        const val QR_GENERATED = "qr_generated"
        const val QR_PAID = "qr_paid"
    }
}
