package id.alviarts.vipos.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules and manages the outbox sync worker (P3-09).
 *
 * Two scheduling modes:
 *  - **Periodic**: runs every 15 minutes when network is
 *    available. Catches any entries that were missed by the
 *    expedited trigger.
 *  - **Expedited**: one-time request fired immediately when
 *    the app detects connectivity return or a new outbox entry
 *    is inserted. Uses `ExistingWorkPolicy.KEEP` so multiple
 *    rapid triggers don't spawn duplicate workers.
 */
class OutboxManager(private val context: Context) {

    private val workManager: WorkManager get() = WorkManager.getInstance(context)

    private val networkConstraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    /**
     * Enqueue the periodic background sync. Call once at app
     * startup (e.g. in `Application.onCreate`).
     */
    fun enqueuePeriodicSync() {
        val periodicRequest = PeriodicWorkRequestBuilder<OutboxWorker>(
            15, TimeUnit.MINUTES,
        )
            .setConstraints(networkConstraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30, TimeUnit.SECONDS,
            )
            .build()

        workManager.enqueueUniquePeriodicWork(
            OutboxWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodicRequest,
        )
    }

    /**
     * Trigger an immediate sync attempt. Call when:
     *  - A new outbox entry is inserted (optimistic write)
     *  - Connectivity returns (ConnectivityObserver emits true)
     */
    fun triggerImmediateSync() {
        val expeditedRequest = OneTimeWorkRequestBuilder<OutboxWorker>()
            .setConstraints(networkConstraints)
            .build()

        workManager.enqueueUniqueWork(
            "${OutboxWorker.WORK_NAME}_expedited",
            ExistingWorkPolicy.KEEP,
            expeditedRequest,
        )
    }
}
