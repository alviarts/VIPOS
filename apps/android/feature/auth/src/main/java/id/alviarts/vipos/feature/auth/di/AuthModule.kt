package id.alviarts.vipos.feature.auth.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.feature.auth.data.AuthApi
import id.alviarts.vipos.feature.auth.data.DataStoreTokenStorage
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Singleton

/**
 * Hilt bindings for the auth feature (P3-03a).
 *
 * Two providers:
 *  - [AuthApi] — built from the application-scoped [Retrofit]
 *    that's already provided by `:app`'s `AppModule` (P3-05).
 *  - [TokenStorage] — backed by DataStore Preferences, scoped to
 *    the application context so the singleton survives Activity
 *    recreation.
 *
 * Lives in `:feature:auth` (rather than `:app`) so the auth
 * surface is colocated with the wiring it needs. Hilt discovers
 * this module via classpath scanning when `:app` runs its KSP
 * processor — no registration in `:app/AppModule` required.
 */
@Module
@InstallIn(SingletonComponent::class)
object AuthModule {

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create()

    @Provides
    @Singleton
    fun provideTokenStorage(
        @ApplicationContext context: Context,
    ): TokenStorage = DataStoreTokenStorage(context)
}
