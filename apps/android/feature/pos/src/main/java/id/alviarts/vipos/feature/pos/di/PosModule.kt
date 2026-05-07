package id.alviarts.vipos.feature.pos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.feature.pos.data.PosApi
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Singleton

/**
 * Hilt bindings for the POS feature (P3-06).
 *
 * Single provider — [PosApi] — built from the application-scoped
 * [Retrofit] in `:app/AppModule`. The Retrofit instance is
 * already wired with the `AuthInterceptor` (P3-06 in
 * `:core:network`) so every call through this API automatically
 * carries `Authorization: Bearer …`.
 */
@Module
@InstallIn(SingletonComponent::class)
object PosModule {

    @Provides
    @Singleton
    fun providePosApi(retrofit: Retrofit): PosApi = retrofit.create()
}
