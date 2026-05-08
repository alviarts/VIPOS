package id.alviarts.vipos.core.common

/**
 * Extension functions for Kotlin Result type used across the app.
 */

/**
 * Map a successful Result to a different type.
 * Preserves the failure if the original was a failure.
 */
inline fun <T, R> Result<T>.mapSuccess(transform: (T) -> R): Result<R> {
    return fold(
        onSuccess = { Result.success(transform(it)) },
        onFailure = { Result.failure(it) },
    )
}

/**
 * Get the value or a default if the Result is a failure.
 */
fun <T> Result<T>.getOrDefault(default: T): T {
    return getOrNull() ?: default
}

/**
 * Execute a side effect on success without changing the Result.
 */
inline fun <T> Result<T>.onSuccessDo(action: (T) -> Unit): Result<T> {
    onSuccess(action)
    return this
}

/**
 * Execute a side effect on failure without changing the Result.
 */
inline fun <T> Result<T>.onFailureDo(action: (Throwable) -> Unit): Result<T> {
    onFailure(action)
    return this
}

/**
 * Convert a nullable value to a Result.
 * null -> Result.failure(NoSuchElementException)
 */
fun <T> T?.toResult(errorMessage: String = "Value is null"): Result<T> {
    return if (this != null) {
        Result.success(this)
    } else {
        Result.failure(NoSuchElementException(errorMessage))
    }
}
