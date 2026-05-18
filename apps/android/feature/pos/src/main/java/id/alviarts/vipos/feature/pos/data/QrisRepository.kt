package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import javax.inject.Inject

/**
 * Repository façade for the QRIS Dynamic mint + poll endpoints
 * (P3-08 slice 5c).
 *
 * Lifts the two Retrofit calls out of the ViewModel so the
 * wire-shape mapping (DTO → domain) lives in one place and stays
 * unit-testable against [okhttp3.mockwebserver.MockWebServer].
 *
 * The ViewModel calls [mint] once when the kasir confirms
 * QRIS_DYNAMIC, then calls [pollStatus] every 3 seconds until
 * the returned [QrisPollResult] carries a terminal status
 * ([QrisPollStatus.Paid], [QrisPollStatus.Expired], or
 * [QrisPollStatus.Failed]).
 */
interface QrisRepository {

    /**
     * Mint a fresh QRIS Dynamic invocation.
     *
     * @param amountIdr the IDR total to settle (cart subtotal).
     * @return [QrisMintResult] with the gateway-issued [refId],
     *   [qrCodeUrl] for rendering, and the initial status
     *   (always [QrisPollStatus.Awaiting] on success).
     */
    suspend fun mint(amountIdr: Long): Result<QrisMintResult>

    /**
     * Poll the current status of a previously-minted invocation.
     *
     * @param refId the `QR-<uuid>` reference from [mint].
     * @return [QrisPollResult] with the mapped [QrisPollStatus].
     */
    suspend fun pollStatus(refId: String): Result<QrisPollResult>
}

/**
 * Domain result from [QrisRepository.mint]. Carries the fields
 * the ViewModel needs to seed the [CheckoutInputState.QrisDynamicInput]
 * and render the QR.
 */
data class QrisMintResult(
    val refId: String,
    val qrCodeUrl: String,
    val status: QrisPollStatus,
)

/**
 * Domain result from [QrisRepository.pollStatus]. Carries the
 * mapped status the ViewModel feeds into [setQrisStatus].
 */
data class QrisPollResult(
    val refId: String,
    val status: QrisPollStatus,
)

/**
 * Production binding for [QrisRepository] — wraps the
 * Retrofit-generated [PosApi] and maps the wire DTOs to domain
 * types.
 *
 * Status mapping from the backend's string literals:
 *  - `"AWAITING"` → [QrisPollStatus.Awaiting]
 *  - `"PAID"`     → [QrisPollStatus.Paid]
 *  - `"EXPIRED"`  → [QrisPollStatus.Expired]
 *  - anything else → [QrisPollStatus.Failed] with the raw status
 *    as the message (defensive against future backend states).
 */
class DefaultQrisRepository @Inject constructor(
    private val api: PosApi,
) : QrisRepository {

    override suspend fun mint(amountIdr: Long): Result<QrisMintResult> = runCatching {
        val response = api.mintQrisDynamic(
            QrisMintRequestDto(amount = amountIdr),
        )
        QrisMintResult(
            refId = response.refId,
            qrCodeUrl = response.qrCodeUrl,
            status = mapStatus(response.status),
        )
    }

    override suspend fun pollStatus(refId: String): Result<QrisPollResult> = runCatching {
        val response = api.pollQrisStatus(refId)
        QrisPollResult(
            refId = response.refId,
            status = mapStatus(response.status),
        )
    }

    private companion object {
        fun mapStatus(wire: String): QrisPollStatus = when (wire) {
            "AWAITING" -> QrisPollStatus.Awaiting
            "PAID" -> QrisPollStatus.Paid
            "EXPIRED" -> QrisPollStatus.Expired
            else -> QrisPollStatus.Failed("Status tidak dikenali: $wire")
        }
    }
}
