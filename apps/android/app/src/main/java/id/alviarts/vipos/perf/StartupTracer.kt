package id.alviarts.vipos.perf

import android.os.SystemClock
import android.util.Log

/**
 * Tracks app startup time for P4-14 performance monitoring.
 *
 * Measures the time from Application.onCreate() to the first
 * frame rendered. Logs a warning if cold start exceeds the
 * target threshold (2 seconds per P4-14 AC).
 *
 * Usage:
 * ```
 * // In Application.onCreate():
 * StartupTracer.markApplicationCreate()
 *
 * // In MainActivity.onCreate() after setContent:
 * StartupTracer.markFirstFrame()
 * ```
 */
object StartupTracer {

    private const val TAG = "StartupTracer"
    private const val TARGET_COLD_START_MS = 2000L

    private var applicationCreateMs: Long = 0L
    private var firstFrameMs: Long = 0L

    fun markApplicationCreate() {
        applicationCreateMs = SystemClock.elapsedRealtime()
        Log.d(TAG, "Application.onCreate() at ${applicationCreateMs}ms")
    }

    fun markFirstFrame() {
        firstFrameMs = SystemClock.elapsedRealtime()
        val coldStartMs = firstFrameMs - applicationCreateMs

        if (coldStartMs > TARGET_COLD_START_MS) {
            Log.w(TAG, "SLOW COLD START: ${coldStartMs}ms (target: ${TARGET_COLD_START_MS}ms)")
        } else {
            Log.i(TAG, "Cold start: ${coldStartMs}ms (within target)")
        }
    }

    /**
     * Get the cold start duration in milliseconds.
     * Returns 0 if not yet measured.
     */
    fun getColdStartMs(): Long {
        if (applicationCreateMs == 0L || firstFrameMs == 0L) return 0L
        return firstFrameMs - applicationCreateMs
    }
}
