package id.alviarts.vipos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.AppConfig
import id.alviarts.vipos.BuildConfig
import javax.inject.Singleton

/**
 * Application-scoped Hilt module (P3-01b).
 *
 * Provides a single `AppConfig` singleton derived from
 * `BuildConfig`. The intent at this stage is purely to exercise the
 * Hilt graph end-to-end (Application → component → module → injected
 * site) so subsequent sub-PRs (P3-01c modular split, P3-02 design
 * system, P3-03 auth) can rely on a working DI baseline.
 *
 * Real platform bindings (Room database, OkHttp/Retrofit clients,
 * WorkManager initializer, etc.) land in their respective Phase 3
 * tasks and will live in `:core:*` modules after the P3-01c split.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAppConfig(): AppConfig = AppConfig(
        appName = "VIPOS",
        versionName = BuildConfig.VERSION_NAME,
        versionCode = BuildConfig.VERSION_CODE,
    )
}
