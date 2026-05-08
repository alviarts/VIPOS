package id.alviarts.vipos

import android.app.Application
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import id.alviarts.vipos.crash.UncaughtExceptionLogger
import id.alviarts.vipos.notification.NotificationChannels
import id.alviarts.vipos.sync.OutboxManager
import id.alviarts.vipos.sync.OutboxWorkerFactory
import javax.inject.Inject

/**
 * Application entry point for Hilt's dependency-injection graph
 * (P3-01b). The `@HiltAndroidApp` annotation triggers Hilt's
 * code generation and creates the application-level
 * `SingletonComponent` that downstream `@AndroidEntryPoint`
 * activities, fragments, and services attach to.
 *
 * P3-09: Implements [Configuration.Provider] to supply a custom
 * [OutboxWorkerFactory] that injects dependencies into the
 * [OutboxWorker]. Also enqueues the periodic outbox sync on
 * startup.
 *
 * Registered via `android:name=".VIPOSApplication"` in
 * `AndroidManifest.xml`.
 */
@HiltAndroidApp
class VIPOSApplication : Application(), Configuration.Provider {

    @Inject lateinit var outboxWorkerFactory: OutboxWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(outboxWorkerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // P3-21: Install crash logger before anything else.
        UncaughtExceptionLogger.install(cacheDir)
        // P3-18: Create notification channels on startup.
        NotificationChannels.createAll(this)
        // Enqueue periodic outbox sync (every 15 min when online).
        OutboxManager(this).enqueuePeriodicSync()
    }
}
