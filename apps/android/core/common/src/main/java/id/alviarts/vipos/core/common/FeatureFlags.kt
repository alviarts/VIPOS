package id.alviarts.vipos.core.common

/**
 * Local feature flag registry (P4-15).
 *
 * Provides compile-time feature flags that can be overridden at
 * runtime via:
 *  - Firebase Remote Config (once P3-21 Firebase is wired)
 *  - Backend `/api/v1/setting?category=feature_flags` endpoint
 *  - Debug settings screen toggle
 *
 * Usage:
 * ```
 * if (FeatureFlags.SPLIT_BILL_ENABLED) {
 *     // Show split bill UI
 * }
 * ```
 *
 * All flags default to `false` (disabled) until explicitly
 * enabled. This ensures new features are dark-launched and can
 * be gradually rolled out per-tenant or per-user.
 */
object FeatureFlags {

    // -- POS features -----------------------------------------

    /** Enable split-bill (multi-payment) flow in checkout. */
    var SPLIT_BILL_ENABLED: Boolean = false

    /** Enable loyalty point earn/redeem at checkout. */
    var LOYALTY_ENABLED: Boolean = false

    /** Enable promo auto-apply in cart. */
    var AUTO_PROMO_ENABLED: Boolean = false

    /** Enable offline-first transaction commit via outbox. */
    var OFFLINE_MODE_ENABLED: Boolean = true

    // -- Order management -------------------------------------

    /** Enable online order queue in the kasir app. */
    var ONLINE_ORDERS_ENABLED: Boolean = false

    /** Enable appointment/reservation check-in. */
    var APPOINTMENTS_ENABLED: Boolean = false

    // -- Hardware integrations --------------------------------

    /** Enable Bluetooth thermal printer. */
    var THERMAL_PRINTER_ENABLED: Boolean = false

    /** Enable camera barcode scanner. */
    var BARCODE_SCANNER_ENABLED: Boolean = false

    /** Enable EDC integration. */
    var EDC_ENABLED: Boolean = false

    // -- Analytics + monitoring -------------------------------

    /** Enable Crashlytics crash reporting. */
    var CRASHLYTICS_ENABLED: Boolean = false

    /** Enable Firebase Analytics event tracking. */
    var ANALYTICS_ENABLED: Boolean = false

    // -- Experimental -----------------------------------------

    /** Enable customer display second screen. */
    var CUSTOMER_DISPLAY_ENABLED: Boolean = false

    /** Enable voice search in catalogue. */
    var VOICE_SEARCH_ENABLED: Boolean = false
}
