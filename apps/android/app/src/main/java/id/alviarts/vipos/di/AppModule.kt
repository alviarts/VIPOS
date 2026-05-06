package id.alviarts.vipos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.BuildConfig
import id.alviarts.vipos.core.common.AppConfig
import javax.inject.Singleton

/**
 * Application-scoped Hilt module (P3-01b → P3-01d).
 *
 * Provides a single `AppConfig` singleton derived from `BuildConfig`.
 * The intent is to exercise the Hilt graph end-to-end (Application →
 * component → module → injected site) so subsequent sub-PRs (P3-02
 * design system, P3-03 auth) can rely on a working DI baseline.
 *
 * `AppConfig` itself lives in `:core:common` (since P3-01c) so any
 * `:core:*` or `:feature:*` module can read it without depending on
 * `:app`. The `@Provides` factory stays here because only the
 * application module has access to the generated `BuildConfig`,
 * including the per-flavor `ENVIRONMENT` and `API_BASE_URL` fields
 * added in P3-01d.
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
        environment = BuildConfig.ENVIRONMENT,
        apiBaseUrl = BuildConfig.API_BASE_URL,
    )
}
