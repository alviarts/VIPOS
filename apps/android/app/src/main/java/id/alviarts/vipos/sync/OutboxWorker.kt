package id.alviarts.vipos.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.database.entity.OutboxEntry
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import id.alviarts.vipos.core.common.AppConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * WorkManager worker that drains the outbox table (P3-09).
 *
 * Iterates all PENDING entries whose `next_retry_at` is in the
 * past, sends each via OkHttp with the `X-Idempotency-Key`
 * header, and deletes on success. On failure, increments the
 * retry count with exponential backoff. After [OutboxEntry.MAX_RETRIES]
 * failures, marks the entry as FAILED (DLQ).
 *
 * This worker is NOT a `@HiltWorker` because Hilt-WorkManager
 * integration requires `hilt-work` + a custom `WorkerFactory`
 * which adds complexity. Instead, dependencies are resolved
 * manually from the application's Hilt component via
 * `EntryPointAccessors`. For P3-09 MVP this is simpler and
 * avoids the `hilt-work` dependency.
 */
class OutboxWorker(
    appContext: Context,
    params: WorkerParameters,
    private val outboxDao: OutboxDao,
    private val okHttpClient: OkHttpClient,
    private val appConfig: AppConfig,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // Reset any stale SYNCING entries from a previous killed run.
            outboxDao.resetStaleInFlight()

            val entries = outboxDao.allReady()
            if (entries.isEmpty()) {
                return@withContext Result.success()
            }

            var allSucceeded = true
            for (entry in entries) {
                outboxDao.markSyncing(entry.id)
                val success = sendEntry(entry)
                if (success) {
                    outboxDao.delete(entry.id)
                } else {
                    allSucceeded = false
                    handleFailure(entry)
                }
            }

            if (allSucceeded) Result.success() else Result.retry()
        } catch (e: Exception) {
            Log.e(TAG, "OutboxWorker failed", e)
            Result.retry()
        }
    }

    private suspend fun sendEntry(entry: OutboxEntry): Boolean {
        return try {
            val baseUrl = appConfig.apiBaseUrl.trimEnd('/')
            val url = "$baseUrl/${entry.path.trimStart('/')}"

            val requestBuilder = Request.Builder()
                .url(url)
                .header("X-Idempotency-Key", entry.idempotencyKey)
                .header("Content-Type", "application/json")

            val body = entry.body.toRequestBody("application/json".toMediaType())
            when (entry.method.uppercase()) {
                "POST" -> requestBuilder.post(body)
                "PUT" -> requestBuilder.put(body)
                "DELETE" -> requestBuilder.delete(body)
                else -> requestBuilder.post(body)
            }

            val response = okHttpClient.newCall(requestBuilder.build()).execute()
            val code = response.code
            response.close()

            // 2xx = success, 409 = already processed (idempotent success)
            code in 200..299 || code == 409
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send outbox entry ${entry.id}: ${e.message}")
            false
        }
    }

    private suspend fun handleFailure(entry: OutboxEntry) {
        val newRetryCount = entry.retryCount + 1
        if (newRetryCount >= OutboxEntry.MAX_RETRIES) {
            // Move to DLQ
            outboxDao.markRetryOrFailed(
                id = entry.id,
                status = OutboxEntry.STATUS_FAILED,
                retryCount = newRetryCount,
                nextRetryAt = 0,
                lastError = entry.lastError ?: "Max retries exceeded",
            )
        } else {
            // Exponential backoff: 30s, 60s, 120s, 240s
            val backoffMs = INITIAL_BACKOFF_MS * (1L shl (newRetryCount - 1))
            outboxDao.markRetryOrFailed(
                id = entry.id,
                status = OutboxEntry.STATUS_PENDING,
                retryCount = newRetryCount,
                nextRetryAt = System.currentTimeMillis() + backoffMs,
                lastError = entry.lastError,
            )
        }
    }

    companion object {
        const val TAG = "OutboxWorker"
        const val WORK_NAME = "outbox_sync"
        private const val INITIAL_BACKOFF_MS = 30_000L // 30 seconds
    }
}
