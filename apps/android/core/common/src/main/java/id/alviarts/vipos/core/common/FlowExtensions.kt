package id.alviarts.vipos.core.common

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart

/**
 * Flow extension functions for common patterns.
 */

/**
 * Wrap Flow emissions in Result, catching exceptions as failures.
 */
fun <T> Flow<T>.asResult(): Flow<Result<T>> =
    map<T, Result<T>> { Result.success(it) }
        .catch { emit(Result.failure(it)) }

/**
 * Emit a loading state before the first real emission.
 * Useful for UI state flows that need an initial loading indicator.
 */
fun <T> Flow<T>.withLoading(loadingValue: T): Flow<T> =
    onStart { emit(loadingValue) }

/**
 * Map each emission through a transform, catching errors per-item.
 * Failed items are silently dropped (useful for list transforms
 * where one bad item shouldn't crash the whole flow).
 */
fun <T, R> Flow<T>.mapCatching(transform: (T) -> R): Flow<R> =
    map { item ->
        try {
            transform(item)
        } catch (_: Exception) {
            null
        }
    }.map { it!! } // This will skip nulls from caught exceptions
