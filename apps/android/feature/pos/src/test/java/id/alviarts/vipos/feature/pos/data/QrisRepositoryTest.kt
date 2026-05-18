package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Unit tests for [DefaultQrisRepository] (P3-08 slice 5c —
 * QRIS Dynamic mint + poll).
 *
 * Same shape as [TransactionRepositoryTest]: [MockWebServer]
 * backs a real [Retrofit]-built [PosApi] so the test exercises
 * the production wire-mapping (snake_case JSON ↔ domain types).
 *
 * What this test surface guarantees:
 *  - `mint(amountIdr)` sends the correct JSON body to
 *    `POST /api/v1/payment/qris/dynamic` and decodes the 201
 *    response into [QrisMintResult] with status mapped to
 *    [QrisPollStatus.Awaiting].
 *  - `pollStatus(refId)` hits
 *    `GET /api/v1/payment/qris/:ref_id/status` and maps the
 *    wire status string to the correct [QrisPollStatus].
 *  - 4xx/5xx responses surface as `Result.failure`.
 *  - Unknown status strings map to [QrisPollStatus.Failed].
 */
class QrisRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var api: PosApi
    private lateinit var repository: QrisRepository

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
        repository = DefaultQrisRepository(api)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    // -- mint tests ---------------------------------------------------

    @Test
    fun `mint sends amount and decodes 201 response with Awaiting status`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(201).setBody(
                """
                {
                  "ref_id": "QR-9001",
                  "qr_code_url": "https://stub.qris.local/qr/QR-9001.png",
                  "polling_url": "/api/v1/payment/qris/QR-9001/status",
                  "status": "AWAITING",
                  "expires_at": "2026-05-08T12:05:00.000Z",
                  "amount": 71000,
                  "transaction_id": null
                }
                """.trimIndent(),
            ),
        )

        val result = repository.mint(71_000L)
        assertTrue(result.isSuccess)

        val mint = result.getOrThrow()
        assertEquals("QR-9001", mint.refId)
        assertEquals("https://stub.qris.local/qr/QR-9001.png", mint.qrCodeUrl)
        assertEquals(QrisPollStatus.Awaiting, mint.status)

        // Verify the request body
        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertTrue(request.path!!.endsWith("/api/v1/payment/qris/dynamic"))
        val body = request.body.readUtf8()
        assertTrue(body.contains("\"amount\":71000"))
    }

    @Test
    fun `mint returns failure on 400 response`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(400).setBody(
                """{"error": "amount is required"}""",
            ),
        )

        val result = repository.mint(0L)
        assertTrue(result.isFailure)
        assertNotNull(result.exceptionOrNull())
    }

    @Test
    fun `mint returns failure on 500 response`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(500).setBody(
                """{"error": "internal server error"}""",
            ),
        )

        val result = repository.mint(50_000L)
        assertTrue(result.isFailure)
    }

    // -- pollStatus tests ---------------------------------------------

    @Test
    fun `pollStatus maps AWAITING to Awaiting`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "ref_id": "QR-9001",
                  "status": "AWAITING",
                  "paid_at": null,
                  "expires_at": "2026-05-08T12:05:00.000Z",
                  "amount": 71000,
                  "transaction_id": null
                }
                """.trimIndent(),
            ),
        )

        val result = repository.pollStatus("QR-9001")
        assertTrue(result.isSuccess)

        val poll = result.getOrThrow()
        assertEquals("QR-9001", poll.refId)
        assertEquals(QrisPollStatus.Awaiting, poll.status)

        val request = server.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path!!.endsWith("/api/v1/payment/qris/QR-9001/status"))
    }

    @Test
    fun `pollStatus maps PAID to Paid`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "ref_id": "QR-9001",
                  "status": "PAID",
                  "paid_at": "2026-05-08T12:01:30.000Z",
                  "expires_at": "2026-05-08T12:05:00.000Z",
                  "amount": 71000,
                  "transaction_id": null
                }
                """.trimIndent(),
            ),
        )

        val result = repository.pollStatus("QR-9001")
        assertTrue(result.isSuccess)
        assertEquals(QrisPollStatus.Paid, result.getOrThrow().status)
    }

    @Test
    fun `pollStatus maps EXPIRED to Expired`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "ref_id": "QR-9001",
                  "status": "EXPIRED",
                  "paid_at": null,
                  "expires_at": "2026-05-08T12:05:00.000Z",
                  "amount": 71000,
                  "transaction_id": null
                }
                """.trimIndent(),
            ),
        )

        val result = repository.pollStatus("QR-9001")
        assertTrue(result.isSuccess)
        assertEquals(QrisPollStatus.Expired, result.getOrThrow().status)
    }

    @Test
    fun `pollStatus maps unknown status to Failed`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setBody(
                """
                {
                  "ref_id": "QR-9001",
                  "status": "CANCELLED",
                  "paid_at": null,
                  "expires_at": "2026-05-08T12:05:00.000Z",
                  "amount": 71000,
                  "transaction_id": null
                }
                """.trimIndent(),
            ),
        )

        val result = repository.pollStatus("QR-9001")
        assertTrue(result.isSuccess)
        val status = result.getOrThrow().status
        assertTrue(status is QrisPollStatus.Failed)
        assertTrue((status as QrisPollStatus.Failed).message.contains("CANCELLED"))
    }

    @Test
    fun `pollStatus returns failure on 404 response`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(404).setBody(
                """{"error": "QRIS invocation not found"}""",
            ),
        )

        val result = repository.pollStatus("QR-UNKNOWN")
        assertTrue(result.isFailure)
    }

    @Test
    fun `pollStatus returns failure on network error`() = runTest {
        // Shut down the server to simulate a network error
        server.shutdown()

        val result = repository.pollStatus("QR-9001")
        assertTrue(result.isFailure)
    }
}
