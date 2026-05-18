package id.alviarts.vipos.core.network.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Response envelope for `GET /api/v1/health` (P3-05).
 *
 * Mirrors the backend's actual shape (verified against the staging
 * deployment at `http://103.74.5.44/api/v1/health`):
 *
 * ```
 * { "status": "ok", "uptime": 123.45 }
 * ```
 *
 * Both fields are tolerant: `status` defaults to `"unknown"` and
 * `uptime` is nullable so a backend that omits it (or an older
 * deployment) still parses cleanly given the
 * `ignoreUnknownKeys = true` / `coerceInputValues = true` settings
 * on [id.alviarts.vipos.core.network.NetworkClientFactory.json].
 */
@Serializable
data class HealthResponse(
    @SerialName("status")
    val status: String = "unknown",
    @SerialName("uptime")
    val uptime: Double? = null,
)
