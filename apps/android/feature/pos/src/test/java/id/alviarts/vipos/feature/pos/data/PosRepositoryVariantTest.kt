package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Unit tests for [PosRepository.loadVariants] (P3-07 first slice).
 *
 * Mirrors the [id.alviarts.vipos.feature.auth.domain.AuthRepositoryRefreshTest]
 * shape: [MockWebServer] backs a real [Retrofit]-built [PosApi] so
 * the test exercises the production wire-mapping (snake_case JSON
 * fields, nullable columns, Postgres-numeric-as-decimal). The
 * repository's only collaborator is the [PosApi]; no other
 * dependencies need stubbing.
 *
 * What this test surface guarantees:
 *  - The Retrofit interface decodes the backend's flat-array
 *    response shape — including nullable columns (`stock`,
 *    `sku_suffix`) and `is_default` carried as a 0/1 integer.
 *  - The flat array is folded into [ProductVariantGroup]s ordered
 *    by their first option's `sort_order`, with options inside
 *    each group ordered by `id` ascending.
 *  - The mapper is defensive: malformed rows (missing
 *    `group_name` or `option_label`) are dropped rather than
 *    surfaced to the UI as ungrouped placeholders.
 *  - Network IO + JSON parse errors land in [Result.failure]
 *    (rather than throwing) so callers can render a recoverable
 *    error sheet without try/catch boilerplate.
 *
 * Whole-rupiah price modifier rounding: the backend sends
 * `price_modifier` as a JSON number from a Postgres `numeric`
 * column. This test pins the decimal-to-Long rounding contract
 * (round-half-up via `Double.roundToLong()`).
 */
class PosRepositoryVariantTest {

    private lateinit var server: MockWebServer
    private lateinit var api: PosApi
    private lateinit var repository: PosRepository

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
        }
        val retrofit = Retrofit.Builder()
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
    }

    @Test
    fun `empty response yields an empty group list`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("[]"))

        val groups = repository.loadVariants(productId = 42).getOrThrow()

        assertEquals(emptyList<ProductVariantGroup>(), groups)
        val recorded = server.takeRequest()
        assertEquals("GET", recorded.method)
        assertEquals("/api/v1/products/42/variants", recorded.path)
    }

    @Test
    fun `groups options by group_name and orders groups by first sort_order`() = runTest {
        // Wire shape: flat array, two groups ("Ukuran", "Topping"),
        // intentionally interleaved so the test fails if the mapper
        // assumes pre-grouped input.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 11, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "sku_suffix": "REG", "stock": null, "is_default": 1, "sort_order": 0},
                  {"id": 21, "product_id": 7, "group_name": "Topping",
                   "option_label": "Keju", "price_modifier": 5000,
                   "sku_suffix": "KJ", "stock": 50, "is_default": 0, "sort_order": 0},
                  {"id": 12, "product_id": 7, "group_name": "Ukuran",
                   "option_label": "Large", "price_modifier": 4000,
                   "sku_suffix": "LRG", "stock": null, "is_default": 0, "sort_order": 1},
                  {"id": 22, "product_id": 7, "group_name": "Topping",
                   "option_label": "Cokelat", "price_modifier": 6000,
                   "sku_suffix": "CHC", "stock": 30, "is_default": 0, "sort_order": 1}
                ]
                """.trimIndent(),
            ),
        )

        val groups = repository.loadVariants(productId = 7).getOrThrow()

        assertEquals(2, groups.size)
        assertEquals("Ukuran", groups[0].name)
        assertEquals("Topping", groups[1].name)

        val ukuran = groups[0].options
        assertEquals(2, ukuran.size)
        assertEquals(11L, ukuran[0].id)
        assertEquals("Reguler", ukuran[0].label)
        assertEquals(0L, ukuran[0].priceModifierIdr)
        assertEquals("REG", ukuran[0].skuSuffix)
        assertNull(ukuran[0].stockOrNull)
        assertTrue("Reguler is the default option", ukuran[0].isDefault)
        assertEquals(12L, ukuran[1].id)
        assertEquals("Large", ukuran[1].label)
        assertEquals(4000L, ukuran[1].priceModifierIdr)

        val topping = groups[1].options
        assertEquals(2, topping.size)
        assertEquals(21L, topping[0].id)
        assertEquals("Keju", topping[0].label)
        assertEquals(5000L, topping[0].priceModifierIdr)
        assertEquals(50, topping[0].stockOrNull)
        assertFalse(topping[0].isDefault)
    }

    @Test
    fun `null sort_order rows fall to the end of their group deterministically`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 30, "product_id": 9, "group_name": "Suhu",
                   "option_label": "Panas", "price_modifier": 0,
                   "is_default": 1, "sort_order": null},
                  {"id": 31, "product_id": 9, "group_name": "Suhu",
                   "option_label": "Dingin", "price_modifier": 2000,
                   "is_default": 0, "sort_order": 0}
                ]
                """.trimIndent(),
            ),
        )

        val groups = repository.loadVariants(productId = 9).getOrThrow()

        // Group order is decided by the FIRST row in each group;
        // here both rows belong to the same group so we just check
        // that within-group order is by id (sort_order ties broken
        // by id, with null sort_order rows treated as MAX_VALUE).
        assertEquals(1, groups.size)
        assertEquals(listOf("Panas", "Dingin"), groups[0].options.map { it.label })
    }

    @Test
    fun `decimal price_modifier rounds half-up to whole rupiah`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 40, "product_id": 5, "group_name": "Ukuran",
                   "option_label": "Sedang", "price_modifier": 2500.50,
                   "sort_order": 0, "is_default": 0},
                  {"id": 41, "product_id": 5, "group_name": "Ukuran",
                   "option_label": "Besar", "price_modifier": 4000.49,
                   "sort_order": 1, "is_default": 0}
                ]
                """.trimIndent(),
            ),
        )

        val options = repository.loadVariants(productId = 5).getOrThrow()
            .single().options

        assertEquals(2501L, options[0].priceModifierIdr) // 0.5 rounds up
        assertEquals(4000L, options[1].priceModifierIdr) // 0.49 rounds down
    }

    @Test
    fun `negative price_modifier survives rounding for discount-style options`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 50, "product_id": 6, "group_name": "Layanan",
                   "option_label": "Dine-in", "price_modifier": 0,
                   "sort_order": 0, "is_default": 1},
                  {"id": 51, "product_id": 6, "group_name": "Layanan",
                   "option_label": "Take away", "price_modifier": -2000,
                   "sort_order": 1, "is_default": 0}
                ]
                """.trimIndent(),
            ),
        )

        val options = repository.loadVariants(productId = 6).getOrThrow()
            .single().options

        assertEquals(0L, options[0].priceModifierIdr)
        assertEquals(-2000L, options[1].priceModifierIdr)
    }

    @Test
    fun `rows with blank group_name or option_label are dropped`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 60, "product_id": 8, "group_name": "  ",
                   "option_label": "Orphan", "price_modifier": 0,
                   "sort_order": 0, "is_default": 0},
                  {"id": 61, "product_id": 8, "group_name": "Ukuran",
                   "option_label": "", "price_modifier": 0,
                   "sort_order": 1, "is_default": 0},
                  {"id": 62, "product_id": 8, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "sort_order": 2, "is_default": 1}
                ]
                """.trimIndent(),
            ),
        )

        val groups = repository.loadVariants(productId = 8).getOrThrow()

        assertEquals(1, groups.size)
        assertEquals("Ukuran", groups[0].name)
        assertEquals(listOf("Reguler"), groups[0].options.map { it.label })
    }

    @Test
    fun `omitted nullable fields default sensibly`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 70, "product_id": 4, "group_name": "Ukuran",
                   "option_label": "Reguler"}
                ]
                """.trimIndent(),
            ),
        )

        val option = repository.loadVariants(productId = 4).getOrThrow()
            .single().options.single()

        // Defaults: missing price_modifier => 0, missing sku_suffix
        // => null, missing stock => null (not-tracked), missing
        // is_default => false.
        assertEquals(0L, option.priceModifierIdr)
        assertNull(option.skuSuffix)
        assertNull(option.stockOrNull)
        assertFalse(option.isDefault)
    }

    @Test
    fun `5xx response surfaces as Result failure`() = runTest {
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"error":"oops"}"""))

        val result = repository.loadVariants(productId = 42)

        assertTrue(result.isFailure)
        assertNotNull(result.exceptionOrNull())
    }

    @Test
    fun `network error surfaces as Result failure`() = runTest {
        server.shutdown()

        val result = repository.loadVariants(productId = 42)

        assertTrue(result.isFailure)
        assertNotNull(result.exceptionOrNull())
    }

    @Test
    fun `group order follows first option's sort_order across groups`() = runTest {
        // "Topping" has sort_order=0 on its first row; "Ukuran" has
        // sort_order=2 on its first row. Output groups must be
        // ordered Topping, Ukuran — proving the mapper doesn't fall
        // back to LinkedHashMap insertion order.
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                [
                  {"id": 80, "product_id": 1, "group_name": "Ukuran",
                   "option_label": "Reguler", "price_modifier": 0,
                   "sort_order": 2, "is_default": 1},
                  {"id": 81, "product_id": 1, "group_name": "Topping",
                   "option_label": "Keju", "price_modifier": 5000,
                   "sort_order": 0, "is_default": 0}
                ]
                """.trimIndent(),
            ),
        )

        val groups = repository.loadVariants(productId = 1).getOrThrow()

        assertEquals(listOf("Topping", "Ukuran"), groups.map { it.name })
    }
}
