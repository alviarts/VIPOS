package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.database.entity.OutboxEntry
import id.alviarts.vipos.core.network.ConnectivityObserver
import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject

/**
 * Offline-first decorator for [TransactionRepository] (P3-09).
 *
 * When online, delegates directly to the inner (online)
 * repository for immediate server confirmation. When offline,
 * writes the transaction to the outbox table and returns an
 * optimistic success with a client-generated invoice number.
 * The [OutboxWorker] drains the entry when connectivity returns.
 *
 * The kasir sees immediate feedback in both cases — the only
 * difference is whether the server has confirmed yet. The
 * outbox badge in the UI shows pending sync count.
 */
class OfflineFirstTransactionRepository @Inject constructor(
    private val onlineRepository: DefaultTransactionRepository,
    private val outboxDao: OutboxDao,
    private val connectivityObserver: ConnectivityObserver,
    private val json: Json,
) : TransactionRepository {

    override suspend fun commit(
        request: CheckoutCommitRequest,
    ): Result<CheckoutCommitOutcome> {
        // Try online first if we think we're connected.
        if (isLikelyOnline()) {
            val result = onlineRepository.commit(request)
            if (result.isSuccess) return result
            // If online commit failed due to network error, fall
            // through to outbox. If it failed due to a business
            // error (400, stock insufficient, etc.), propagate
            // the failure — those won't succeed on retry either.
            val exception = result.exceptionOrNull()
            if (exception != null && !isNetworkError(exception)) {
                return result
            }
        }

        // Offline path: write to outbox + return optimistic success.
        return writeToOutbox(request)
    }

    private suspend fun writeToOutbox(
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
            else -> request.cartSubtotalIdr
        }
        val dto = TransactionRequestDto(
            items = items,
            paymentAmount = paymentAmount,
            paymentMethod = request.paymentMethod.code,
            notes = null,
        )

        val idempotencyKey = UUID.randomUUID().toString()
        val bodyJson = json.encodeToString(dto)

        outboxDao.insert(
            OutboxEntry(
                method = "POST",
                path = "api/v1/transactions",
                body = bodyJson,
                idempotencyKey = idempotencyKey,
            ),
        )

        // Return optimistic outcome with a client-generated
        // invoice number. The real invoice number will be
        // assigned by the server when the outbox drains.
        CheckoutCommitOutcome(
            transactionId = 0L, // Placeholder — server assigns real ID
            invoiceNumber = "OFFLINE-${idempotencyKey.take(8).uppercase()}",
            totalAmountIdr = request.cartSubtotalIdr,
            changeAmountIdr = when (val input = request.inputState) {
                is CheckoutInputState.CashInput ->
                    (input.tenderedIdr - request.cartSubtotalIdr).coerceAtLeast(0)
                else -> 0L
            },
        )
    }

    private fun isLikelyOnline(): Boolean {
        // Use the ConnectivityObserver's synchronous check if
        // available, otherwise assume online (optimistic).
        return try {
            val observer = connectivityObserver
            if (observer is id.alviarts.vipos.core.network.AndroidConnectivityObserver) {
                observer.isOnlineNow()
            } else {
                true // Fake observer in tests — assume online
            }
        } catch (_: Exception) {
            true
        }
    }

    private fun isNetworkError(throwable: Throwable): Boolean {
        return throwable is java.io.IOException ||
            throwable is java.net.SocketTimeoutException ||
            throwable is java.net.UnknownHostException ||
            throwable is java.net.ConnectException
    }
}
