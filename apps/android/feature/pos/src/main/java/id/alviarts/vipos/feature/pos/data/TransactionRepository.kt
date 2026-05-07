package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.CheckoutCartLine
import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import javax.inject.Inject

/**
 * Repository façade for the kasir transaction commit
 * (P3-08 slice 5b).
 *
 * Lifts the `POST /api/v1/transactions` Retrofit call out of the
 * ViewModel so the request-shape mapping (cart lines + per-method
 * input → wire body) lives in one place and stays unit-testable
 * against [okhttp3.mockwebserver.MockWebServer]. The ViewModel
 * just calls [commit] and reacts to the [Result] in
 * [kotlinx.coroutines.flow.StateFlow] state — no `try`/`catch`
 * scattered through the VM.
 *
 * The result is a [Result]-wrapped [CheckoutCommitOutcome]; any
 * Retrofit / IO failure surfaces as a `Result.failure(throwable)`
 * with the throwable's `localizedMessage` carrying the backend's
 * `{error: "..."}` body when present (the kotlinx-serialization
 * converter throws `HttpException` on 4xx/5xx and the upstream
 * VM maps the message to a Snackbar — handled at the [commit]
 * call site).
 */
interface TransactionRepository {

    /**
     * Commit a kasir transaction.
     *
     * Wire mapping:
     *  - `items[].product_id`  ← `request.cartLines[].productId`
     *  - `items[].price`       ← `request.cartLines[].effectiveUnitPriceIdr`
     *  - `items[].quantity`    ← `request.cartLines[].quantity`
     *  - `payment_amount`      ← derived from [CheckoutCommitRequest.inputState]:
     *      - `CashInput.tenderedIdr` for cash
     *      - `cartSubtotalIdr` for every other method (gateway
     *        / EDC / QRIS / single-tap settle take the full
     *        amount, no change due)
     *  - `payment_method`      ← `request.paymentMethod.code`
     *    (canonical Android code; backend allow-list at
     *    `apps/backend/src/lib/payment-methods.js` accepts both
     *    legacy lowercase + canonical uppercase, but Android
     *    always sends canonical)
     *  - `notes`               ← always `null` for slice 5b; the
     *    UI doesn't expose a notes field yet (a separate Tier-2
     *    follow-up adds a per-transaction notes input)
     */
    suspend fun commit(request: CheckoutCommitRequest): Result<CheckoutCommitOutcome>
}

/**
 * Snapshot of the data the commit needs at the time the kasir
 * taps "Bayar".
 *
 * All four fields are snapshotted by [CheckoutViewModel.start]
 * (the cart subtotal + cart lines) and [CheckoutViewModel.confirmSelection]
 * / per-method mutators (selected method + input state) so the
 * commit always sees a coherent point-in-time view of the
 * checkout — even if the kasir somehow mutates the underlying
 * catalogue cart while a request is in flight, that mutation
 * doesn't leak into the in-flight commit.
 */
data class CheckoutCommitRequest(
    val cartLines: List<CheckoutCartLine>,
    val cartSubtotalIdr: Long,
    val paymentMethod: PaymentMethod,
    val inputState: CheckoutInputState?,
)

/**
 * Subset of the 201 response surfaced to the UI on commit
 * success. The receipt toast shows
 * `"Tersimpan #{invoiceNumber} — kembalian Rp X"`; the rest of
 * the row (status, created_at, items detail) is dropped on the
 * floor by the `ignoreUnknownKeys` converter.
 */
data class CheckoutCommitOutcome(
    val transactionId: Long,
    val invoiceNumber: String,
    val totalAmountIdr: Long,
    val changeAmountIdr: Long,
)

/**
 * Production binding for [TransactionRepository] — wraps the
 * Retrofit-generated [PosApi] and applies the wire mapping
 * documented on [TransactionRepository.commit].
 *
 * `runCatching` here means any thrown exception (Retrofit
 * `HttpException`, `IOException`, JSON parse failure, etc.)
 * lands as a `Result.failure` instead of bubbling out — the VM
 * can then map the failure into its `CheckoutCommitStatus.Failed`
 * state without a try/catch ladder.
 */
class DefaultTransactionRepository @Inject constructor(
    private val api: PosApi,
) : TransactionRepository {

    override suspend fun commit(
        request: CheckoutCommitRequest,
    ): Result<CheckoutCommitOutcome> = runCatching {
        val items = request.cartLines.map { line ->
            TransactionRequestItemDto(
                productId = line.productId,
                price = line.effectiveUnitPriceIdr,
                quantity = line.quantity,
            )
        }
        val paymentAmount = when (val input = request.inputState) {
            is CheckoutInputState.CashInput -> input.tenderedIdr
            // EDC / QRIS / single-tap settle: the gateway / kartu
            // / e-wallet / etc. takes the full subtotal, no
            // change due. Sending exactly the subtotal lines up
            // with the backend's `payment_amount >= total` check
            // (loop-3 PR #236) and produces `change_amount = 0`.
            else -> request.cartSubtotalIdr
        }
        val response = api.createTransaction(
            TransactionRequestDto(
                items = items,
                paymentAmount = paymentAmount,
                paymentMethod = request.paymentMethod.code,
                notes = null,
            ),
        )
        CheckoutCommitOutcome(
            transactionId = response.id,
            invoiceNumber = response.invoiceNumber,
            totalAmountIdr = response.totalAmount,
            changeAmountIdr = response.changeAmount,
        )
    }
}
