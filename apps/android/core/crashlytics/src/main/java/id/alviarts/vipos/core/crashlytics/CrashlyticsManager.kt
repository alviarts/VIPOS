package id.alviarts.vipos.core.crashlytics

import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Centralized crash reporting and logging manager.
 *
 * Wraps Firebase Crashlytics to provide:
 * - Crash reporting
 * - Non-fatal error logging
 * - Custom key-value logging
 * - User identification
 * - Breadcrumb logging
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var crashlytics: CrashlyticsManager
 *
 * // Log non-fatal error
 * crashlytics.logError(exception, "Failed to sync data")
 *
 * // Set user context
 * crashlytics.setUserId(userId)
 * crashlytics.setUserProperty("role", "cashier")
 *
 * // Add breadcrumb
 * crashlytics.log("User clicked checkout button")
 * ```
 */
@Singleton
class CrashlyticsManager @Inject constructor() {

    private val crashlytics: FirebaseCrashlytics = FirebaseCrashlytics.getInstance()

    /**
     * Enable or disable crash reporting.
     * Useful for development builds or user opt-out.
     */
    fun setCrashlyticsCollectionEnabled(enabled: Boolean) {
        crashlytics.setCrashlyticsCollectionEnabled(enabled)
        log("Crashlytics collection ${if (enabled) "enabled" else "disabled"}")
    }

    /**
     * Set user identifier for crash reports.
     * Call this after successful login.
     */
    fun setUserId(userId: String) {
        crashlytics.setUserId(userId)
        log("User ID set: $userId")
    }

    /**
     * Set custom key-value pair for crash context.
     * Useful for debugging: tenant, outlet, role, etc.
     */
    fun setCustomKey(key: String, value: String) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Boolean) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Int) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Long) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Float) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Double) {
        crashlytics.setCustomKey(key, value)
    }

    /**
     * Set multiple custom keys at once.
     */
    fun setCustomKeys(keys: Map<String, Any>) {
        keys.forEach { (key, value) ->
            when (value) {
                is String -> setCustomKey(key, value)
                is Boolean -> setCustomKey(key, value)
                is Int -> setCustomKey(key, value)
                is Long -> setCustomKey(key, value)
                is Float -> setCustomKey(key, value)
                is Double -> setCustomKey(key, value)
                else -> setCustomKey(key, value.toString())
            }
        }
    }

    /**
     * Log a breadcrumb message.
     * Appears in crash reports to show user journey.
     */
    fun log(message: String) {
        crashlytics.log(message)
        // Also log to Logcat in debug builds
        if (BuildConfig.DEBUG) {
            Log.d(TAG, message)
        }
    }

    /**
     * Log a non-fatal error.
     * Use this for caught exceptions that shouldn't crash the app
     * but are important to track.
     */
    fun logError(throwable: Throwable, message: String? = null) {
        if (message != null) {
            log("ERROR: $message")
        }
        crashlytics.recordException(throwable)
        Log.e(TAG, message ?: "Error occurred", throwable)
    }

    /**
     * Log a warning (non-fatal, less severe than error).
     */
    fun logWarning(message: String, throwable: Throwable? = null) {
        log("WARNING: $message")
        if (throwable != null) {
            crashlytics.recordException(throwable)
        }
        Log.w(TAG, message, throwable)
    }

    /**
     * Force send any unsent crash reports.
     * Useful before app shutdown or logout.
     */
    fun sendUnsentReports() {
        crashlytics.sendUnsentReports()
        log("Sending unsent crash reports")
    }

    /**
     * Delete any unsent crash reports.
     * Useful for user privacy (opt-out).
     */
    fun deleteUnsentReports() {
        crashlytics.deleteUnsentReports()
        log("Deleted unsent crash reports")
    }

    /**
     * Check if there are unsent crash reports.
     */
    fun checkForUnsentReports(callback: (Boolean) -> Unit) {
        crashlytics.checkForUnsentReports().addOnCompleteListener { task ->
            callback(task.result ?: false)
        }
    }

    /**
     * Clear all user context (call on logout).
     */
    fun clearUserContext() {
        crashlytics.setUserId("")
        log("User context cleared")
    }

    companion object {
        private const val TAG = "CrashlyticsManager"
    }
}

/**
 * Extension functions for easier error logging.
 */

/**
 * Log this exception to Crashlytics with optional message.
 */
fun Throwable.logToCrashlytics(crashlytics: CrashlyticsManager, message: String? = null) {
    crashlytics.logError(this, message)
}

/**
 * Wrap a block with crash reporting.
 * If the block throws, log to Crashlytics and optionally rethrow.
 */
inline fun <T> CrashlyticsManager.runCatching(
    message: String,
    rethrow: Boolean = false,
    block: () -> T
): Result<T> {
    return try {
        Result.success(block())
    } catch (e: Exception) {
        logError(e, message)
        if (rethrow) throw e
        Result.failure(e)
    }
}
