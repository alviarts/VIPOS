package id.alviarts.vipos.feature.pos.di

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import id.alviarts.vipos.feature.pos.data.CashierShiftRepository
import id.alviarts.vipos.feature.pos.data.CustomerRepository
import id.alviarts.vipos.feature.pos.data.DefaultCashierShiftRepository
import id.alviarts.vipos.feature.pos.data.DefaultCustomerRepository
import id.alviarts.vipos.feature.pos.data.DefaultQrisRepository
import id.alviarts.vipos.feature.pos.data.DefaultTransactionRepository
import id.alviarts.vipos.feature.pos.data.OfflineFirstTransactionRepository
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.QrisRepository
import id.alviarts.vipos.feature.pos.data.TransactionRepository
import id.alviarts.vipos.feature.pos.domain.CartAwarePaymentMethodCatalog
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
 *  - [PaymentMethodCatalog] — wired as a
 *    [CartAwarePaymentMethodCatalog] decorator wrapping
 *    [DefaultPaymentMethodCatalog]. The decorator filters out
 *    CREDIT (walk-in), DEPOSIT (balance ≤ 0), and LOYALTY_POINT
 *    (below threshold) based on the [CartContext] returned by
 *    the context provider.
 *
 *    The context provider currently returns [CartContext.WALK_IN]
 *    (anonymous customer, no deposit, no loyalty points) as a
 *    safe default. Once the customer-selection UI is wired
 *    (P3-16), the provider should be swapped to read from the
 *    live cart + customer state so the picker dynamically
 *    reflects the selected customer's deposit balance and
 *    loyalty points.
 */
@Module
@InstallIn(SingletonComponent::class)
object PosModule {

    @Provides
    @Singleton
    fun providePosApi(retrofit: Retrofit): PosApi = retrofit.create()

    @Provides
    @Singleton
    fun providePaymentMethodCatalog(): PaymentMethodCatalog =
        CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            // TODO(P3-16): Replace with a live CartContext provider
            // that reads from the cart's selected customer record.
            // Until then, walk-in defaults filter out CREDIT,
            // DEPOSIT, and LOYALTY_POINT — which is the correct
            // behaviour for an anonymous cart.
            contextProvider = { CartContext.WALK_IN },
        )
}

/**
 * Interface bindings for the POS feature data layer.
 *
 * Split from [PosModule] (an `object`) because Hilt requires
 * `@Binds` to live on an `abstract class` (or `interface`) — the
 * generated factory wraps the binding in a concrete subclass it
 * can instantiate, which `object` blocks because the bytecode
 * marks it `final`. Keeping the `@Provides`-style providers in
 * an `object` and the `@Binds`-style abstract bindings in a
 * separate `abstract class` is the canonical Hilt layout
 * recommended by the dagger team.
 *
 * [bindTransactionRepository] wires [TransactionRepository] to
 * its production impl [DefaultTransactionRepository] (P3-08
 * slice 5b). The default impl pulls [PosApi] (provided above)
 * via constructor injection. Tests substitute fakes by either
 * (a) constructing the repository directly against a
 * MockWebServer-backed [PosApi] for end-to-end coverage, or
 * (b) constructing the [CheckoutViewModel] under test with a
 * hand-rolled fake repository for state-machine coverage.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class PosBindingsModule {

    @Binds
    @Singleton
    abstract fun bindTransactionRepository(
        impl: OfflineFirstTransactionRepository,
    ): TransactionRepository

    @Binds
    @Singleton
    abstract fun bindQrisRepository(
        impl: DefaultQrisRepository,
    ): QrisRepository

    @Binds
    @Singleton
    abstract fun bindCashierShiftRepository(
        impl: DefaultCashierShiftRepository,
    ): CashierShiftRepository

    @Binds
    @Singleton
    abstract fun bindCustomerRepository(
        impl: DefaultCustomerRepository,
    ): CustomerRepository
}
