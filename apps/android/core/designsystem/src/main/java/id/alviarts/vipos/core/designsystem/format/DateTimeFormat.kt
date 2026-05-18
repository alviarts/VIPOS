package id.alviarts.vipos.core.designsystem.format

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Date/time formatting utilities for consistent display across
 * the app (P4-13 localization support).
 *
 * All formatters use Indonesian locale by default. The app
 * displays dates in `dd/MM/yyyy` format and times in `HH:mm`
 * (24-hour) format per Indonesian convention.
 */
object DateTimeFormat {

    private val idLocale = Locale("id", "ID")

    /** Format: "08/05/2026" */
    fun formatDate(date: Date): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy", idLocale)
        return sdf.format(date)
    }

    /** Format: "08/05/2026 14:30" */
    fun formatDateTime(date: Date): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", idLocale)
        return sdf.format(date)
    }

    /** Format: "14:30" */
    fun formatTime(date: Date): String {
        val sdf = SimpleDateFormat("HH:mm", idLocale)
        return sdf.format(date)
    }

    /** Format: "Kamis, 8 Mei 2026" */
    fun formatDateLong(date: Date): String {
        val sdf = SimpleDateFormat("EEEE, d MMMM yyyy", idLocale)
        return sdf.format(date)
    }

    /** Format: "8 Mei 2026, 14:30" */
    fun formatDateTimeLong(date: Date): String {
        val sdf = SimpleDateFormat("d MMMM yyyy, HH:mm", idLocale)
        return sdf.format(date)
    }

    /** Parse an ISO-8601 string to Date. Returns null on failure. */
    fun parseIso(isoString: String): Date? {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            // Handle both with and without milliseconds/timezone
            val cleaned = isoString
                .replace("Z", "")
                .replace(Regex("\\.[0-9]+"), "")
                .replace(Regex("[+-]\\d{2}:\\d{2}$"), "")
            sdf.parse(cleaned)
        } catch (_: Exception) {
            null
        }
    }

    /** Format an ISO-8601 string to "dd/MM/yyyy HH:mm". */
    fun formatIsoDateTime(isoString: String): String {
        val date = parseIso(isoString) ?: return isoString
        return formatDateTime(date)
    }

    /** Format an ISO-8601 string to "dd/MM/yyyy". */
    fun formatIsoDate(isoString: String): String {
        val date = parseIso(isoString) ?: return isoString
        return formatDate(date)
    }

    /** Relative time: "baru saja", "5 menit lalu", "2 jam lalu", etc. */
    fun relativeTime(date: Date): String {
        val now = System.currentTimeMillis()
        val diff = now - date.time
        val seconds = diff / 1000
        val minutes = seconds / 60
        val hours = minutes / 60
        val days = hours / 24

        return when {
            seconds < 60 -> "baru saja"
            minutes < 60 -> "$minutes menit lalu"
            hours < 24 -> "$hours jam lalu"
            days < 7 -> "$days hari lalu"
            else -> formatDate(date)
        }
    }
}
