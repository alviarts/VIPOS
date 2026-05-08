package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the QRIS Dynamic endpoints (P3-08 slice 5c).
 *
 * Mirrors the backend handler in
 * `apps/backend/src/routes/payment-qris.js`:
 *
 *  - Mint:   `POST /api/v1/payment/qris/dynamic`
 *            Body: `{ amount, transaction_id? }`
 *            201:  `{ ref_id, qr_code_url, polling_url, status,
 *                     expires_at, amount, transaction_id }`
 *
 *  - Poll:   `GET  /api/v1/payment/qris/:ref_id/status`
 *            200:  `{ ref_id, status, paid_at, expires_at,
 *                     amount, transaction_id }`
 *
 * The backend's in-memory stub (loop #5 PR #244) uses a 5-minute
 * expiry window and three terminal states: `AWAITING`, `PAID`,
 * `EXPIRED`. The Android side polls every 3 seconds until a
 * terminal state is reached.
 */

/**
 * Body of `POST /api/v1/payment/qris/dynamic`.
 *
 * [amount] is the IDR total to settle. [transactionId] is
 * optional — the backend stores it on the invocation record for
 * reconciliation but doesn't require it for the stub.
 */
@Serializable
data class QrisMintRequestDto(
    @SerialName("amount") val amount: Long,
    @SerialName("transaction_id") val transactionId: Long? = null,
)

/**
 * 201 response from `POST /api/v1/payment/qris/dynamic`.
 *
 * [qrCodeUrl] is the URL to the QR image (stub returns a
 * placeholder like `https://stub.qris.local/qr/QR-xxxx.png`).
 * [pollingUrl] is the full URL for status polling (convenience;
 * the Android side constructs its own path from [refId]).
 * [status] is always `"AWAITING"` on a fresh mint.
 * [expiresAt] is an ISO-8601 timestamp 5 minutes in the future.
 */
@Serializable
data class QrisMintResponseDto(
    @SerialName("ref_id") val refId: String,
    @SerialName("qr_code_url") val qrCodeUrl: String,
    @SerialName("polling_url") val pollingUrl: String,
    @SerialName("status") val status: String,
    @SerialName("expires_at") val expiresAt: String,
    @SerialName("amount") val amount: Long,
    @SerialName("transaction_id") val transactionId: Long? = null,
)

/**
 * 200 response from `GET /api/v1/payment/qris/:ref_id/status`.
 *
 * [status] transitions: `"AWAITING"` → `"PAID"` or `"EXPIRED"`.
 * [paidAt] is non-null only when [status] is `"PAID"`.
 */
@Serializable
data class QrisStatusResponseDto(
    @SerialName("ref_id") val refId: String,
    @SerialName("status") val status: String,
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("expires_at") val expiresAt: String,
    @SerialName("amount") val amount: Long,
    @SerialName("transaction_id") val transactionId: Long? = null,
)
