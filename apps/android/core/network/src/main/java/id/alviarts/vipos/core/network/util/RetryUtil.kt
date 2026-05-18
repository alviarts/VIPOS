package id.alviarts.vipos.core.network.util

import kotlinx.coroutines.delay
import retrofit2.HttpException
import java.io.IOException

/**
 * Retry configuration for API calls.
 */
data class RetryConfig(
    val maxAttempts: Int = 3,
    val initialDelayMillis: Long = 1000,
    val maxDelayMillis: Long = 5000,
    val factor: Double = 2.0,
    val retryOn: (Throwable) -> Boolean = { it is IOException || (it is HttpException && it.code() >= 500) },
)

/**
 * Executes a suspending block with exponential backoff retry logic.
 *
 * Retries the operation if it fails with a retryable exception (by default,
 * IOException or 5xx HTTP errors). Uses exponential backoff with jitter.
 *
 * Example:
 * ```
 * val result = retryWithBackoff {
 *     api.getData()
 * }
 * ```
 */
suspend fun <T> retryWithBackoff(
    config: RetryConfig = RetryConfig(),
    block: suspend () -> T,
): T {
    var currentDelay = config.initialDelayMillis
    var lastException: Throwable? = null

    repeat(config.maxAttempts) { attempt ->
        try {
            return block()
        } catch (e: Throwable) {
            lastException = e

            // Don't retry if this is the last attempt or if exception is not retryable
            if (attempt == config.maxAttempts - 1 || !config.retryOn(e)) {
                throw e
            }

            // Wait before retrying with exponential backoff + jitter
            val jitter = (currentDelay * 0.1 * Math.random()).toLong()
            delay(currentDelay + jitter)

            // Increase delay for next attempt
            currentDelay = (currentDelay * config.factor).toLong().coerceAtMost(config.maxDelayMillis)
        }
    }

    // This should never be reached, but throw the last exception just in case
    throw lastException ?: IllegalStateException("Retry failed without exception")
}

/**
 * Executes a suspending block with simple retry logic (no backoff).
 *
 * Retries the operation immediately if it fails, up to [maxAttempts] times.
 */
suspend fun <T> retrySimple(
    maxAttempts: Int = 3,
    retryOn: (Throwable) -> Boolean = { it is IOException },
    block: suspend () -> T,
): T {
    var lastException: Throwable? = null

    repeat(maxAttempts) { attempt ->
        try {
            return block()
        } catch (e: Throwable) {
            lastException = e

            if (attempt == maxAttempts - 1 || !retryOn(e)) {
                throw e
            }
        }
    }

    throw lastException ?: IllegalStateException("Retry failed without exception")
}
