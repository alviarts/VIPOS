package id.alviarts.vipos.core.crashlytics

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module for Crashlytics dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
object CrashlyticsModule {

    @Provides
    @Singleton
    fun provideCrashlyticsManager(): CrashlyticsManager {
        return CrashlyticsManager()
    }
}
