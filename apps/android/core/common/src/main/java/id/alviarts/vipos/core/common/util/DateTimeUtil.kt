package id.alviarts.vipos.core.common.util

import java.text.SimpleDateFormat
import java.util.*

/**
 * Date and time formatting utilities.
 */
object DateTimeUtil {

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale("id", "ID"))
    private val timeFormat = SimpleDateFormat("HH:mm", Locale("id", "ID"))
    private val dateTimeFormat = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
    private val fullDateTimeFormat = SimpleDateFormat("dd MMMM yyyy, HH:mm:ss", Locale("id", "ID"))

    /**
     * Parses ISO 8601 date string to Date object.
     * Returns null if parsing fails.
     */
    fun parseIsoDate(isoString: String?): Date? {
        if (isoString == null) return null
        return try {
            isoFormat.parse(isoString)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Formats ISO 8601 date string to "dd MMM yyyy" format.
     * Example: "01 Jan 2024"
     */
    fun formatDate(isoString: String?): String {
        val date = parseIsoDate(isoString) ?: return isoString ?: "-"
        return dateFormat.format(date)
    }

    /**
     * Formats ISO 8601 date string to "HH:mm" format.
     * Example: "14:30"
     */
    fun formatTime(isoString: String?): String {
        val date = parseIsoDate(isoString) ?: return isoString ?: "-"
        return timeFormat.format(date)
    }

    /**
     * Formats ISO 8601 date string to "dd MMM yyyy, HH:mm" format.
     * Example: "01 Jan 2024, 14:30"
     */
    fun formatDateTime(isoString: String?): String {
        val date = parseIsoDate(isoString) ?: return isoString ?: "-"
        return dateTimeFormat.format(date)
    }

    /**
     * Formats ISO 8601 date string to "dd MMMM yyyy, HH:mm:ss" format.
     * Example: "01 Januari 2024, 14:30:45"
     */
    fun formatFullDateTime(isoString: String?): String {
        val date = parseIsoDate(isoString) ?: return isoString ?: "-"
        return fullDateTimeFormat.format(date)
    }

    /**
     * Returns relative time string (e.g., "2 jam yang lalu", "Kemarin").
     */
    fun formatRelativeTime(isoString: String?): String {
        val date = parseIsoDate(isoString) ?: return isoString ?: "-"
        val now = Date()
        val diffMillis = now.time - date.time
        val diffSeconds = diffMillis / 1000
        val diffMinutes = diffSeconds / 60
        val diffHours = diffMinutes / 60
        val diffDays = diffHours / 24

        return when {
            diffSeconds < 60 -> "Baru saja"
            diffMinutes < 60 -> "$diffMinutes menit yang lalu"
            diffHours < 24 -> "$diffHours jam yang lalu"
            diffDays == 1L -> "Kemarin"
            diffDays < 7 -> "$diffDays hari yang lalu"
            else -> formatDate(isoString)
        }
    }

    /**
     * Returns today's date in "yyyy-MM-dd" format.
     */
    fun getTodayDate(): String {
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return format.format(Date())
    }

    /**
     * Returns date N days ago in "yyyy-MM-dd" format.
     */
    fun getDateDaysAgo(days: Int): String {
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_MONTH, -days)
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return format.format(calendar.time)
    }

    /**
     * Returns start of current month in "yyyy-MM-dd" format.
     */
    fun getStartOfMonth(): String {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return format.format(calendar.time)
    }

    /**
     * Returns end of current month in "yyyy-MM-dd" format.
     */
    fun getEndOfMonth(): String {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_MONTH, calendar.getActualMaximum(Calendar.DAY_OF_MONTH))
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return format.format(calendar.time)
    }
}
