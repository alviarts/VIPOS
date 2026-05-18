package id.alviarts.vipos.crash

import android.util.Log
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Fallback uncaught exception handler (P3-21 preparation).
 *
 * Logs crashes to a local file in the app's cache directory
 * before the process dies. This provides crash data even when
 * Crashlytics/Firebase is not yet wired.
 *
 * Once Crashlytics is integrated (P3-21), this handler should
 * chain to the Crashlytics handler so both local logs and
 * remote reporting work.
 *
 * Usage in Application.onCreate():
 * ```
 * UncaughtExceptionLogger.install(cacheDir)
 * ```
 */
object UncaughtExceptionLogger {

    private const val TAG = "CrashLogger"
    private const val CRASH_LOG_DIR = "crash_logs"
    private const val MAX_LOG_FILES = 10

    private var originalHandler: Thread.UncaughtExceptionHandler? = null

    fun install(cacheDir: File) {
        originalHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                logCrash(cacheDir, thread, throwable)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to log crash", e)
            }
            // Chain to the original handler (system default or Crashlytics)
            originalHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun logCrash(cacheDir: File, thread: Thread, throwable: Throwable) {
        val logDir = File(cacheDir, CRASH_LOG_DIR).apply { mkdirs() }

        // Clean up old logs (keep last MAX_LOG_FILES)
        val existingLogs = logDir.listFiles()?.sortedByDescending { it.lastModified() } ?: emptyList()
        if (existingLogs.size >= MAX_LOG_FILES) {
            existingLogs.drop(MAX_LOG_FILES - 1).forEach { it.delete() }
        }

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val logFile = File(logDir, "crash_$timestamp.txt")

        FileWriter(logFile).use { writer ->
            writer.write("=== VIPOS Crash Report ===\n")
            writer.write("Time: ${Date()}\n")
            writer.write("Thread: ${thread.name} (id=${thread.id})\n")
            writer.write("Exception: ${throwable.javaClass.name}\n")
            writer.write("Message: ${throwable.message}\n")
            writer.write("\n--- Stack Trace ---\n")
            PrintWriter(writer).use { pw ->
                throwable.printStackTrace(pw)
            }
            writer.write("\n--- System Info ---\n")
            writer.write("Android: ${android.os.Build.VERSION.SDK_INT}\n")
            writer.write("Device: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}\n")
            writer.write("Available memory: ${Runtime.getRuntime().freeMemory() / 1024}KB\n")
        }

        Log.e(TAG, "Crash logged to: ${logFile.absolutePath}")
    }

    /**
     * Get all crash log files, most recent first.
     */
    fun getCrashLogs(cacheDir: File): List<File> {
        val logDir = File(cacheDir, CRASH_LOG_DIR)
        return logDir.listFiles()?.sortedByDescending { it.lastModified() } ?: emptyList()
    }
}
