package id.alviarts.vipos.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that stamps the API version header on
 * every outgoing request (P2-07 follow-up).
 *
 * The backend uses this header to:
 *  - Route to the correct handler version (future)
 *  - Log which client versions are in the wild
 *  - Deprecation warnings in response headers
 *
 * Header: `X-API-Version: 1`
 * Header: `X-Client-Version: <appVersion>`
 */
class ApiVersionInterceptor(
    private val apiVersion: String = "1",
    private val clientVersion: String = "0.0.1",
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("X-API-Version", apiVersion)
            .header("X-Client-Version", clientVersion)
            .build()
        return chain.proceed(request)
    }
}
