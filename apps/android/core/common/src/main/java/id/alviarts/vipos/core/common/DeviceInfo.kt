package id.alviarts.vipos.core.common

import android.os.Build

/**
 * Device information utility for crash reports, analytics,
 * and user properties (P3-21 / P4-07).
 */
object DeviceInfo {

    val manufacturer: String get() = Build.MANUFACTURER
    val model: String get() = Build.MODEL
    val sdkVersion: Int get() = Build.VERSION.SDK_INT
    val androidVersion: String get() = Build.VERSION.RELEASE
    val device: String get() = "$manufacturer $model"

    /**
     * Build a properties map for analytics user properties.
     */
    fun toProperties(appVersion: String, tenantId: Int? = null, role: String? = null): Map<String, String> {
        val props = mutableMapOf(
            "device" to device,
            "os_version" to "Android $androidVersion (SDK $sdkVersion)",
            "app_version" to appVersion,
        )
        if (tenantId != null) props["tenant_id"] = tenantId.toString()
        if (role != null) props["role"] = role
        return props
    }

    /**
     * Check if the device is a tablet (screen width >= 600dp approximation).
     * Uses the screen density + resolution heuristic.
     */
    fun isTablet(context: android.content.Context): Boolean {
        val metrics = context.resources.displayMetrics
        val widthDp = metrics.widthPixels / metrics.density
        return widthDp >= 600
    }
}
