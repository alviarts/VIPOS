package id.alviarts.vipos.sync

import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import id.alviarts.vipos.core.common.AppConfig
import id.alviarts.vipos.core.database.dao.OutboxDao
import okhttp3.OkHttpClient
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Custom [WorkerFactory] that injects dependencies into
 * [OutboxWorker] (P3-09).
 *
 * Registered in `Application.onCreate` via
 * `WorkManager.initialize(config)` with this factory. This
 * avoids the `hilt-work` dependency while still providing
 * constructor injection for the worker.
 */
@Singleton
class OutboxWorkerFactory @Inject constructor(
    private val outboxDao: OutboxDao,
    private val okHttpClient: OkHttpClient,
    private val appConfig: AppConfig,
) : WorkerFactory() {

    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? {
        return when (workerClassName) {
            OutboxWorker::class.java.name -> OutboxWorker(
                appContext = appContext,
                params = workerParameters,
                outboxDao = outboxDao,
                okHttpClient = okHttpClient,
                appConfig = appConfig,
            )
            else -> null // Fall back to default factory
        }
    }
}
