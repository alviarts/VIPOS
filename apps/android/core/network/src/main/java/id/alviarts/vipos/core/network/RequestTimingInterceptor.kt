package id.alviarts.vipos.core.network

import android.util.Log
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that logs request timing for performance
 * monitoring (P4-14).
 *
 * Logs a warning when any request takes longer than
 * [SLOW_REQUEST_THRESHOLD_MS] milliseconds. This helps identify
 * slow endpoints that need optimization.
 *
 * Only active in non-production builds (controlled by the
 * `loggingEnabled` flag in `NetworkClientFactory`).
 */
class RequestTimingInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val startMs = System.currentTimeMillis()

        val response = chain.proceed(request)

        val durationMs = System.currentTimeMillis() - startMs
        val path = request.url.encodedPath
        val method = request.method

        if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
            Log.w(
                TAG,
                "SLOW REQUEST: $method $path took ${durationMs}ms (threshold: ${SLOW_REQUEST_THRESHOLD_MS}ms)",
            )
        } else {
            Log.d(TAG, "$method $path: ${durationMs}ms [${response.code}]")
        }

        return response
    }

    companion object {
        private const val TAG = "RequestTiming"
        /** Requests slower than this are logged as warnings. */
        const val SLOW_REQUEST_THRESHOLD_MS = 500L
    }
}
