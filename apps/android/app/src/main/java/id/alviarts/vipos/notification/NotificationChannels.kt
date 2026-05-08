package id.alviarts.vipos.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * Notification channel definitions for VIPOS (P3-18 preparation).
 *
 * Android 8.0+ requires notification channels. This object
 * creates all channels on app startup so notifications can be
 * posted immediately when FCM is wired (P3-18/P3-21).
 *
 * Channel categories:
 *  - Orders: new online orders, order status updates
 *  - Stock: low stock alerts, stock opname reminders
 *  - Approvals: pending approval requests for managers
 *  - System: sync failures, app updates, maintenance
 */
object NotificationChannels {

    const val CHANNEL_ORDERS = "vipos_orders"
    const val CHANNEL_STOCK = "vipos_stock"
    const val CHANNEL_APPROVALS = "vipos_approvals"
    const val CHANNEL_SYSTEM = "vipos_system"

    /**
     * Create all notification channels. Safe to call multiple
     * times — Android ignores duplicate channel creation.
     * Call from Application.onCreate().
     */
    fun createAll(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager

        val channels = listOf(
            NotificationChannel(
                CHANNEL_ORDERS,
                "Pesanan",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Notifikasi pesanan online baru dan update status"
                enableVibration(true)
            },
            NotificationChannel(
                CHANNEL_STOCK,
                "Stok",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Peringatan stok rendah dan pengingat stock opname"
            },
            NotificationChannel(
                CHANNEL_APPROVALS,
                "Persetujuan",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Permintaan persetujuan dari kasir/karyawan"
                enableVibration(true)
            },
            NotificationChannel(
                CHANNEL_SYSTEM,
                "Sistem",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Sinkronisasi gagal, update aplikasi, pemeliharaan"
            },
        )

        manager.createNotificationChannels(channels)
    }
}
