package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.core.database.dao.KeyValueCacheDao
import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.database.entity.KeyValueCacheEntity
import id.alviarts.vipos.core.database.entity.OutboxEntry
import id.alviarts.vipos.core.network.ConnectivityObserver
import id.alviarts.vipos.feature.pos.data.CustomerDto
import id.alviarts.vipos.feature.pos.data.CustomerRepository
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.PosRepository
import id.alviarts.vipos.feature.pos.domain.Product
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.AbstractExecutorService
import java.util.concurrent.TimeUnit

/**
 * Unit tests for [PosCatalogueViewModel] cart semantics — focuses
 * on the P3-07 fifth-slice contract that cart-line identity keys
 * on (`productId`, `unitPriceUpliftIdr`).
 *
 * The catalogue-fetch path is exercised end-to-end by
 * [id.alviarts.vipos.feature.pos.data.PosRepositoryVariantTest]'s
 * sibling repository tests + the integration smoke at the
 * [PosCatalogueRoute] composable; here we enqueue a single
 * empty-200 for the init `refresh()` and then drive the cart
 * transforms directly.
 *
 * Critical contracts validated:
 *  - **Same product + same uplift collapses** to a single line
 *    with incremented quantity (P3-06 legacy behavior preserved
 *    for no-variant products).
 *  - **Same product + different uplift** stays as two distinct
 *    lines so a kasir can order one Large + one Small Es Kopi
 *    Susu side by side.
 *  - **Increment / decrement / remove key on the full
 *    (productId, uplift) tuple** so a mutation against one
 *    configuration never leaks to a sibling line.
 *  - **Decrement to zero removes the line** — same defensive
 *    contract as P3-06.
 *  - **`selectedOptionLabels` is captured at add time** so
 *    re-opening the sheet later can't retroactively rewrite a
 *    running cart line.
 *  - **`lineTotalIdr` includes the uplift** (covered indirectly
 *    via `cartSubtotalIdr`).
 */
class PosCatalogueViewModelTest {

    /** Fake [ConnectivityObserver] that always reports online. */
    private val fakeConnectivityObserver: ConnectivityObserver = object : ConnectivityObserver {
        override fun observe(): Flow<Boolean> = MutableStateFlow(true)
    }

    /** Fake [KeyValueCacheDao] that stores nothing. */
    private val fakeKvCache: KeyValueCacheDao = object : KeyValueCacheDao {
        override suspend fun get(key: String): KeyValueCacheEntity? = null
        override fun observe(key: String): Flow<KeyValueCacheEntity?> = flowOf(null)
        override suspend fun upsert(row: KeyValueCacheEntity) {}
        override suspend fun delete(key: String) {}
        override suspend fun clear() {}
    }

    /** Fake [CustomerRepository] that returns empty results. */
    private val fakeCustomerRepository: CustomerRepository = object : CustomerRepository {
        override suspend fun search(query: String): Result<List<CustomerDto>> = Result.success(emptyList())
        override suspend fun quickAdd(name: String, phone: String?): Result<CustomerDto> =
            Result.success(CustomerDto(id = 1, name = name, phone = phone))
        override suspend fun getById(id: Long): Result<CustomerDto> =
            Result.failure(IllegalStateException("not exercised"))
    }

    /** Fake [OutboxDao] that returns zero counts. */
    private val fakeOutboxDao: OutboxDao = object : OutboxDao {
        override suspend fun insert(entry: OutboxEntry): Long = 1L
        override suspend fun allReady(nowMs: Long): List<OutboxEntry> = emptyList()
        override suspend fun markSyncing(id: Long) {}
        override suspend fun delete(id: Long) {}
        override suspend fun markRetryOrFailed(id: Long, status: String, retryCount: Int, nextRetryAt: Long, lastError: String?) {}
        override fun countPending(): Flow<Int> = flowOf(0)
        override fun countFailed(): Flow<Int> = flowOf(0)
        override suspend fun allFailed(): List<OutboxEntry> = emptyList()
        override suspend fun retryFailed(id: Long) {}
        override suspend fun deleteFailed(id: Long) {}
        override suspend fun resetStaleInFlight() {}
    }

    private lateinit var server: MockWebServer
    private lateinit var api: PosApi
    private lateinit var repository: PosRepository
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        server = MockWebServer().apply { start() }
        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
        }
        // Synchronous OkHttp dispatcher — same rationale as the
        // PosVariantViewModelTest: keeps the Retrofit response on
        // the test scheduler so `advanceUntilIdle()` deterministically
        // drains the init `refresh()`.
        val client = OkHttpClient.Builder()
            .dispatcher(okhttp3.Dispatcher(CatalogueSynchronousExecutorService()))
            .build()
        val retrofit = Retrofit.Builder()
            .client(client)
            .baseUrl(server.url("/"))
            .addConverterFactory(
                json.asConverterFactory("application/json".toMediaType()),
            )
            .build()
        api = retrofit.create(PosApi::class.java)
        repository = PosRepository(api)
    }

    @After
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    /**
     * Enqueue an empty product page for the init `refresh()` and
     * return a fully-constructed VM whose first emission has
     * already drained.
     */
    private suspend fun newViewModelWithDrainedInit(): PosCatalogueViewModel {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """{"data":[],"page":1,"per_page":100,"total":0,"total_pages":0}""",
            ),
        )
        val vm = PosCatalogueViewModel(repository, fakeCustomerRepository, fakeKvCache, fakeConnectivityObserver, fakeOutboxDao)
        vm.uiState.first { it.loadStatus is LoadStatus.Loaded }
        return vm
    }

    private val esKopiSusu = Product(
        id = 1,
        name = "Es Kopi Susu",
        priceIdr = 22_000,
        categoryName = "Minuman",
        sku = "MN-001",
    )

    @Test
    fun `addToCart twice with same product + same uplift collapses into one line`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()

        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(1, cart.size)
        assertEquals(2, cart[0].quantity)
        assertEquals(0L, cart[0].unitPriceUpliftIdr)
        assertEquals(
            "lineTotal = (22_000 + 0) * 2",
            44_000L,
            cart[0].lineTotalIdr,
        )
    }

    @Test
    fun `addToCart twice with same product + different uplift creates two distinct lines`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()

        // Imagine the kasir picked Large (+4_000) the first time and
        // Reguler (uplift 0) the second time.
        vm.addToCart(
            product = esKopiSusu,
            unitPriceUpliftIdr = 4_000,
            selectedOptionLabels = listOf("Large"),
        )
        vm.addToCart(
            product = esKopiSusu,
            unitPriceUpliftIdr = 0,
            selectedOptionLabels = listOf("Reguler"),
        )
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(2, cart.size)
        // Insertion order preserved: Large first, Reguler second.
        assertEquals(4_000L, cart[0].unitPriceUpliftIdr)
        assertEquals(listOf("Large"), cart[0].selectedOptionLabels)
        assertEquals(0L, cart[1].unitPriceUpliftIdr)
        assertEquals(listOf("Reguler"), cart[1].selectedOptionLabels)
        assertEquals(
            "subtotal = 22_000+4_000 + 22_000+0 = 48_000",
            48_000L,
            vm.uiState.value.cartSubtotalIdr,
        )
    }

    @Test
    fun `increment keys on (productId, uplift) and never crosses sibling lines`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 4_000)
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        // Increment ONLY the Reguler (uplift=0) line; Large (uplift=4_000) must stay at 1.
        vm.increment(productId = esKopiSusu.id, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(2, cart.size)
        // Large untouched.
        assertEquals(4_000L, cart[0].unitPriceUpliftIdr)
        assertEquals(1, cart[0].quantity)
        // Reguler bumped to 2.
        assertEquals(0L, cart[1].unitPriceUpliftIdr)
        assertEquals(2, cart[1].quantity)
    }

    @Test
    fun `decrement keys on (productId, uplift) and removes the line at zero qty`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 4_000)
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        // Decrement Large to zero — line should drop. Reguler must stay.
        vm.decrement(productId = esKopiSusu.id, unitPriceUpliftIdr = 4_000)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(1, cart.size)
        assertEquals(0L, cart[0].unitPriceUpliftIdr)
        assertEquals(1, cart[0].quantity)
    }

    @Test
    fun `removeFromCart targets the matching (productId, uplift) line only`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 4_000)
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        vm.removeFromCart(productId = esKopiSusu.id, unitPriceUpliftIdr = 4_000)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(1, cart.size)
        assertEquals(0L, cart[0].unitPriceUpliftIdr)
    }

    @Test
    fun `cart mutation methods are no-ops when no line matches the (productId, uplift) tuple`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()
        vm.addToCart(product = esKopiSusu, unitPriceUpliftIdr = 0)
        advanceUntilIdle()

        // Same product, but uplift=4_000 doesn't match the existing
        // line (which has uplift=0). All three mutations must
        // silently no-op.
        vm.increment(productId = esKopiSusu.id, unitPriceUpliftIdr = 4_000)
        vm.decrement(productId = esKopiSusu.id, unitPriceUpliftIdr = 4_000)
        vm.removeFromCart(productId = esKopiSusu.id, unitPriceUpliftIdr = 4_000)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(1, cart.size)
        assertEquals(1, cart[0].quantity)
        assertEquals(0L, cart[0].unitPriceUpliftIdr)
    }

    @Test
    fun `addToCart preserves selectedOptionLabels on the line snapshot`() = runTest(testDispatcher) {
        val vm = newViewModelWithDrainedInit()

        vm.addToCart(
            product = esKopiSusu,
            unitPriceUpliftIdr = 6_000,
            selectedOptionLabels = listOf("Large", "Less Sugar"),
        )
        advanceUntilIdle()

        val line = vm.uiState.value.cart.single()
        assertEquals(listOf("Large", "Less Sugar"), line.selectedOptionLabels)
        assertEquals(6_000L, line.unitPriceUpliftIdr)
        assertEquals(28_000L, line.effectiveUnitPriceIdr)
    }

    @Test
    fun `addToCart with default uplift preserves the P3-06 single-line semantics`() = runTest(testDispatcher) {
        // Regression guard: a no-variant caller (just `vm.addToCart(product)`)
        // must keep collapsing successive adds into one line, same as
        // before the fifth slice landed.
        val vm = newViewModelWithDrainedInit()

        vm.addToCart(product = esKopiSusu)
        vm.addToCart(product = esKopiSusu)
        vm.addToCart(product = esKopiSusu)
        advanceUntilIdle()

        val cart = vm.uiState.value.cart
        assertEquals(1, cart.size)
        assertEquals(3, cart[0].quantity)
        assertEquals(0L, cart[0].unitPriceUpliftIdr)
        assertTrue(cart[0].selectedOptionLabels.isEmpty())
    }
}

/**
 * Runs every submitted task on the calling thread synchronously.
 * Same trick as [PosVariantViewModelTest] — keeps Retrofit
 * responses on the test scheduler instead of OkHttp's worker pool.
 *
 * Renamed from `SynchronousExecutorService` to avoid a top-level
 * redeclaration clash with the identical helper that already
 * exists `private` in [PosVariantViewModelTest] — Kotlin's K2
 * compiler enforces unique top-level class names per package
 * even when both declarations are file-private (KT-15514). The
 * pragmatic fix is a unique name; sharing one helper would
 * require lifting it to `internal` in a `testFixtures`-style
 * module, which is overkill for two tests.
 */
private class CatalogueSynchronousExecutorService : AbstractExecutorService() {
    @Volatile private var shutdown = false
    override fun execute(command: Runnable) = command.run()
    override fun shutdown() { shutdown = true }
    override fun shutdownNow(): MutableList<Runnable> {
        shutdown = true
        return mutableListOf()
    }
    override fun isShutdown(): Boolean = shutdown
    override fun isTerminated(): Boolean = shutdown
    override fun awaitTermination(timeout: Long, unit: TimeUnit): Boolean = true
}
