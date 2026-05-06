package id.alviarts.vipos.core.network.api

import retrofit2.http.GET

/**
 * Smallest possible Retrofit interface (P3-05).
 *
 * Hits the backend's `/api/v1/health` endpoint, which returns a
 * minimal JSON envelope. The interface exists so the Phase 3
 * bootstrap can prove the wiring (Retrofit + OkHttp + kotlinx-
 * serialization) compiles end-to-end without yet committing to
 * a real domain model — that lands in P3-03 (auth) and onwards.
 *
 * Note: the bootstrap UI does NOT call this on cold-start. P3-05
 * only exercises the Hilt graph (provider chain) at instantiation
 * time. A real ping-on-launch lands later, gated by network
 * availability + a kill-switch.
 */
interface HealthApi {
    @GET("api/v1/health")
    suspend fun health(): HealthResponse
}
