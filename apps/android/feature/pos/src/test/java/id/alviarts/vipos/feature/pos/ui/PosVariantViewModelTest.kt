package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.PosRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.AbstractExecutorService
import java.util.concurrent.TimeUnit

/**
 * Unit tests for [PosVariantViewModel] (P3-07 second + third
 * slices).
 *
 * Mirrors the [id.alviarts.vipos.feature.auth.ui.LoginViewModelTest]
 * pattern: a real [PosRepository] backed by [MockWebServer] +
 * a synchronous OkHttp dispatcher so the test scheduler stays
 * deterministic across the coroutine + Retrofit boundary. The
 * repository surface is already covered by
 * [id.alviarts.vipos.feature.pos.data.PosRepositoryVariantTest];
 * this file focuses on the ViewModel state-machine transitions.
 *
 * Critical contracts:
 *  - **Synchronous Loading transition** — [PosVariantViewModel.loadFor]
 *    must update `_uiState` to `Loading` synchronously, before
 *    suspending on the network call, so the sheet can render the
 *    spinner immediately on tap.
 *  - **Stale-response guard** — if the kasir pivots to a different
 *    product mid-flight, the in-flight result MUST NOT overwrite
 *    the new product's state.
 *  - **Empty success is Loaded, not Failed** — a product without
 *    any variants is a valid terminal state.
 *  - **Retry re-fetches the currently-targeted product** —
 *    [PosVariantViewModel.retry] is a no-op before any
 *    [PosVariantViewModel.loadFor] call.
 *  - **Auto-default-pick on first Loaded** — every group with at
 *    least one option lands with a non-null selection so the
 *    sheet opens with a valid pick.
 *  - **Per-group selection is independent** — picking an option
 *    in one group never disturbs selections in other groups.
 *  - **Defensive selectOption** — silently ignores unknown
 *    `groupName` / `optionId`.
 *  - **Pivot-clears-selections** — pivoting to a new product
 *    clears the selection map alongside the groups.
 */
class PosVariantViewModelTest {

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
        // Synchronous OkHttp dispatcher — same rationale as
        // LoginViewModelTest: keeps the Retrofit response on the
        // test scheduler instead of OkHttp's worker pool, so
        // `advanceUntilIdle()` deterministically drains the
        // continuation.
        val client = OkHttpClient.Builder()
            .dispatcher(okhttp3.Dispatcher(SynchronousExecutorService()))
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

    @Test
    fun `initial state is Idle, no productId, empty groups`() {
        val vm = PosVariantViewModel(repository)
        val state = vm.uiState.value
        assertEquals(VariantLoadStatus.Idle, state.loadStatus)
        assertNull(state.productId)
        assertEquals(emptyList<Any>(), state.groups)
    }

    @Test
    fun `loadFor transitions to Loading synchronously before suspending`() = runTest(testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 7)

        // Read state synchronously — the launch hasn't dispatched yet.
        val state = vm.uiState.value
        assertEquals(VariantLoadStatus.Loading, state.loadStatus)
        assertEquals(7L, state.productId)

        advanceUntilIdle()
    }

    @Test
    fun `happy path with one group lands in Loaded with the parsed groups`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 11, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "is_default": 1, "sort_order": 0},
                  {"id": 12, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Large", "price_modifier": 4000,
                   "is_default": 0, "sort_order": 1}
                ]
                """.trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 7)
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertEquals(7L, state.productId)
        assertEquals(1, state.groups.size)
        assertEquals("Ukuran", state.groups[0].name)
        assertEquals(listOf("Reguler", "Large"), state.groups[0].options.map { it.label })
    }

    @Test
    fun `empty response is a valid Loaded state, not Failed`() = runTest(testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 9)
        val state = vm.uiState.first { it.loadStatus !is VariantLoadStatus.Loading }

        assertEquals(VariantLoadStatus.Loaded, state.loadStatus)
        assertEquals(emptyList<Any>(), state.groups)
        assertEquals(9L, state.productId)
    }

    @Test
    fun `5xx response surfaces as Failed with a non-blank message`() = runTest(testDispatcher) {
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"db down"}"""))
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 4)
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Failed }

        val failed = state.loadStatus as VariantLoadStatus.Failed
        assertTrue("error message must not be blank", failed.message.isNotBlank())
        assertEquals(4L, state.productId)
    }

    @Test
    fun `retry re-fetches the currently-targeted product`() = runTest(testDispatcher) {
        // First fetch fails…
        server.enqueue(MockResponse().setResponseCode(500))
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 4)
        vm.uiState.first { it.loadStatus is VariantLoadStatus.Failed }

        // …then retry succeeds.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 50, "product_id": 4, "group_name": "Suhu",
                    "option_label": "Panas", "price_modifier": 0,
                    "is_default": 1, "sort_order": 0}]""".trimIndent(),
            ),
        )

        vm.retry()
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertEquals(1, state.groups.size)
        assertEquals("Suhu", state.groups[0].name)
        // Same productId, two requests landed on the server.
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `retry before any loadFor is a no-op`() = runTest(testDispatcher) {
        val vm = PosVariantViewModel(repository)

        vm.retry()
        advanceUntilIdle()

        assertEquals(VariantLoadStatus.Idle, vm.uiState.value.loadStatus)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `loadFor with same productId while loading is deduped`() = runTest(testDispatcher) {
        // Only enqueue ONE response — if the second call were not
        // deduped the test would deadlock waiting for a second
        // response that never arrives.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 60, "product_id": 8, "group_name": "Ukuran",
                    "option_label": "Reguler", "price_modifier": 0,
                    "is_default": 1, "sort_order": 0}]""".trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 8)
        vm.loadFor(productId = 8) // dedupe — same product, still Loading
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertEquals(1, server.requestCount)
        assertEquals(1, state.groups.size)
    }

    @Test
    fun `pivoting to a different productId clears stale groups and re-fetches`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 70, "product_id": 1, "group_name": "Ukuran",
                    "option_label": "Reguler", "price_modifier": 0,
                    "is_default": 1, "sort_order": 0}]""".trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 1)
        vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        // Pivot — second fetch for a different product.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 71, "product_id": 2, "group_name": "Topping",
                    "option_label": "Keju", "price_modifier": 5000,
                    "is_default": 0, "sort_order": 0}]""".trimIndent(),
            ),
        )

        vm.loadFor(productId = 2)
        // Synchronously after pivot but before Loaded: Loading state
        // for the new productId, with previous groups CLEARED.
        val mid = vm.uiState.value
        assertEquals(VariantLoadStatus.Loading, mid.loadStatus)
        assertEquals(2L, mid.productId)
        assertEquals(
            "stale groups for the previous product must be cleared on pivot",
            emptyList<Any>(),
            mid.groups,
        )

        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }
        assertEquals("Topping", state.groups.single().name)
    }

    // ---- P3-07 third slice — selection state ---------------------

    @Test
    fun `Loaded auto-picks the is_default-flagged option in each group`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 11, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "is_default": 1, "sort_order": 0},
                  {"id": 12, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Large", "price_modifier": 4000,
                   "is_default": 0, "sort_order": 1},
                  {"id": 21, "product_id": 7, "group_name": "Topping",
                   "option_label": "Keju", "price_modifier": 5000,
                   "is_default": 0, "sort_order": 0},
                  {"id": 22, "product_id": 7, "group_name": "Topping",
                   "option_label": "Cokelat", "price_modifier": 6000,
                   "is_default": 1, "sort_order": 1}
                ]
                """.trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 7)
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertEquals(11L, state.selectedOptionIdsByGroup["Ukuran"])
        assertEquals(22L, state.selectedOptionIdsByGroup["Topping"])
        assertTrue("ready to add to cart once every group is picked", state.isReadyToAddToCart)
        assertEquals(
            "selected uplift = Reguler(0) + Cokelat(6000) = 6000",
            6_000L,
            state.selectedPriceUpliftIdr,
        )
    }

    @Test
    fun `Loaded falls back to first option when no row is is_default-flagged`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 30, "product_id": 9, "group_name": "Suhu",
                   "option_label": "Panas", "price_modifier": 0,
                   "is_default": 0, "sort_order": 0},
                  {"id": 31, "product_id": 9, "group_name": "Suhu",
                   "option_label": "Dingin", "price_modifier": 2000,
                   "is_default": 0, "sort_order": 1}
                ]
                """.trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 9)
        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertEquals(30L, state.selectedOptionIdsByGroup["Suhu"])
        assertTrue(state.isReadyToAddToCart)
        assertEquals(0L, state.selectedPriceUpliftIdr)
    }

    @Test
    fun `selectOption replaces the selection in the picked group only`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 11, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "is_default": 1, "sort_order": 0},
                  {"id": 12, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Large", "price_modifier": 4000,
                   "is_default": 0, "sort_order": 1},
                  {"id": 21, "product_id": 7, "group_name": "Topping",
                   "option_label": "Keju", "price_modifier": 5000,
                   "is_default": 1, "sort_order": 0}
                ]
                """.trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 7)
        vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        vm.selectOption(groupName = "Ukuran", optionId = 12L)
        val state = vm.uiState.value

        assertEquals(12L, state.selectedOptionIdsByGroup["Ukuran"])
        assertEquals(
            "Topping selection must NOT be disturbed",
            21L,
            state.selectedOptionIdsByGroup["Topping"],
        )
        // Updated uplift = Large(4000) + Keju(5000) = 9000.
        assertEquals(9_000L, state.selectedPriceUpliftIdr)
    }

    @Test
    fun `selectOption is a no-op for unknown group or option ids`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 11, "product_id": 7, "group_name": "Ukuran",
                    "option_label": "Reguler", "price_modifier": 0,
                    "is_default": 1, "sort_order": 0}]""".trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 7)
        val before = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        vm.selectOption(groupName = "Tidak Ada", optionId = 11L) // unknown group
        vm.selectOption(groupName = "Ukuran", optionId = 9999L)  // unknown option

        assertEquals(
            "selection map must be unchanged after both no-ops",
            before.selectedOptionIdsByGroup,
            vm.uiState.value.selectedOptionIdsByGroup,
        )
    }

    @Test
    fun `pivoting to a different productId clears the selection map`() = runTest(testDispatcher) {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 11, "product_id": 1, "group_name": "Ukuran",
                    "option_label": "Reguler", "price_modifier": 0,
                    "is_default": 1, "sort_order": 0}]""".trimIndent(),
            ),
        )
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 1)
        vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }
        // Move off the auto-default so we can detect a clear vs. a re-default.
        // (Only Reguler exists, so selectOption is a no-op here; we need a
        // group with two options to distinguish.) — trivially still Reguler.

        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """[{"id": 21, "product_id": 2, "group_name": "Topping",
                    "option_label": "Keju", "price_modifier": 5000,
                    "is_default": 0, "sort_order": 0}]""".trimIndent(),
            ),
        )
        vm.loadFor(productId = 2)
        // Mid-pivot: Loading; selection map cleared synchronously alongside
        // the groups list (state is consistent — no stale picks reference
        // the previous product's options).
        val mid = vm.uiState.value
        assertEquals(VariantLoadStatus.Loading, mid.loadStatus)
        assertEquals(
            "selection map must be cleared on pivot",
            emptyMap<String, Long>(),
            mid.selectedOptionIdsByGroup,
        )

        // After Loaded: new product's groups + auto-default for the new groups.
        val after = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }
        assertEquals(21L, after.selectedOptionIdsByGroup["Topping"])
        assertNull(after.selectedOptionIdsByGroup["Ukuran"])
    }

    @Test
    fun `isReadyToAddToCart is true for an empty groups list`() = runTest(testDispatcher) {
        // A product with zero variant rows lands in Loaded with empty
        // groups; trivially ready (the modifier sheet wouldn't open
        // for such a product, but the predicate must stay
        // well-defined for callers that bind unconditionally).
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))
        val vm = PosVariantViewModel(repository)
        vm.loadFor(productId = 99)

        val state = vm.uiState.first { it.loadStatus is VariantLoadStatus.Loaded }

        assertTrue(state.isReadyToAddToCart)
        assertEquals(0L, state.selectedPriceUpliftIdr)
    }

    @Test
    fun `Loading state is NOT ready to add to cart and reports zero uplift`() = runTest(testDispatcher) {
        // We want to read the state synchronously while Loading, so
        // do NOT advanceUntilIdle inside this test.
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))
        val vm = PosVariantViewModel(repository)

        vm.loadFor(productId = 4)
        val state = vm.uiState.value

        assertEquals(VariantLoadStatus.Loading, state.loadStatus)
        assertFalse("Loading state cannot satisfy the add-to-cart gate", state.isReadyToAddToCart)
        assertEquals(0L, state.selectedPriceUpliftIdr)

        advanceUntilIdle() // drain so the dispatcher doesn't leak the launch
    }
}

/**
 * Runs every submitted task on the calling thread synchronously.
 * Wired into OkHttp's [okhttp3.Dispatcher] so that the response
 * lands on the test scheduler — same trick as the auth tests.
 */
private class SynchronousExecutorService : AbstractExecutorService() {
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
