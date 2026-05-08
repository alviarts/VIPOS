package id.alviarts.vipos.core.network

import kotlinx.coroutines.delay

/**
 * Retry policy for network operations (P4-11).
 *
 * Provides exponential backoff retry logic for transient
 * network failures. Used by repositories and the outbox worker.
 *
 * Usage:
 * ```
 * val result = RetryPolicy.withRetry(maxAttempts = 3) {
 *     api.someCall()
 * }
 * ```
 */
object RetryPolicy {

    private const val INITIAL_DELAY_MS = 1000L
    private const val MAX_DELAY_MS = 30_000L
    private const val BACKOFF_MULTIPLIER = 2.0

    /**
     * Execute [block] with exponential backoff retry.
     *
     * @param maxAttempts maximum number of attempts (including first)
     * @param shouldRetry predicate to determine if the exception is retryable
     * @param block the suspend function to execute
     * @return the result of [block] on success
     * @throws the last exception if all attempts fail
     */
    suspend fun <T> withRetry(
        maxAttempts: Int = 3,
        shouldRetry: (Throwable) -> Boolean = ::isRetryable,
        block: suspend () -> T,
    ): T {
        var lastException: Throwable? = null
        var currentDelay = INITIAL_DELAY_MS

        repeat(maxAttempts) { attempt ->
            try {
                return block()
            } catch (e: Throwable) {
                lastException = e
                if (attempt == maxAttempts - 1 || !shouldRetry(e)) {
                    throw e
                }
                delay(currentDelay)
                currentDelay = (currentDelay * BACKOFF_MULTIPLIER).toLong()
                    .coerceAtMost(MAX_DELAY_MS)
            }
        }

        throw lastException ?: IllegalStateException("Retry exhausted")
    }

    /**
     * Default retryable check: network errors are retryable,
     * business errors (4xx) are not.
     */
    fun isRetryable(throwable: Throwable): Boolean {
        return throwable is java.io.IOException ||
            throwable is java.net.SocketTimeoutException ||
            throwable is java.net.ConnectException
    }
}
