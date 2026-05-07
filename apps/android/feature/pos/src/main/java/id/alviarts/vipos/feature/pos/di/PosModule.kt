package id.alviarts.vipos.feature.pos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.domain.CartContext
import id.alviarts.vipos.feature.pos.domain.DefaultPaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Singleton

/**
 * Hilt bindings for the POS feature (P3-06 + P3-08).
 *
 * Providers:
 *  - [PosApi] — built from the application-scoped [Retrofit] in
 *    `:app/AppModule`. The Retrofit instance is already wired
 *    with the `AuthInterceptor` (P3-06 in `:core:network`) so
 *    every call through this API automatically carries
 *    `Authorization: Bearer …`.
 *  - [PaymentMethodCatalog] — bound to the default in-memory
 *    impl ([DefaultPaymentMethodCatalog]) for P3-08 second
 *    slice. Tests substitute a fake by constructing
 *    [CheckoutViewModel] directly. The cart-aware decorator
 *    ([id.alviarts.vipos.feature.pos.domain.CartAwarePaymentMethodCatalog])
 *    that further filters credit / deposit / loyalty methods
 *    on cart-state predicates is shipped but not yet wired —
 *    a follow-up slice will introduce a [CartContext] provider
 *    bound to the cart + customer state and swap this @Provides
 *    binding to wrap [DefaultPaymentMethodCatalog] in the
 *    decorator.
 */
@Module
@InstallIn(SingletonComponent::class)
object PosModule {

    @Provides
    @Singleton
    fun providePosApi(retrofit: Retrofit): PosApi = retrofit.create()

    @Provides
    @Singleton
    fun providePaymentMethodCatalog(): PaymentMethodCatalog = DefaultPaymentMethodCatalog
}
