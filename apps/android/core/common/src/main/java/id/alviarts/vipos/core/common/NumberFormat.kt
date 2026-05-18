package id.alviarts.vipos.core.common

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Number formatting utilities for Indonesian locale.
 */
object NumberFormat {

    private val idSymbols = DecimalFormatSymbols(Locale("id", "ID")).apply {
        groupingSeparator = '.'
        decimalSeparator = ','
    }

    private val integerFormat = DecimalFormat("#,###", idSymbols)
    private val decimalFormat = DecimalFormat("#,###.##", idSymbols)
    private val percentFormat = DecimalFormat("#.#'%'", idSymbols)

    /** Format integer with thousand separators: 1000000 -> "1.000.000" */
    fun formatInteger(value: Long): String = integerFormat.format(value)

    /** Format decimal: 1234.5 -> "1.234,5" */
    fun formatDecimal(value: Double): String = decimalFormat.format(value)

    /** Format percentage: 0.15 -> "15%" */
    fun formatPercent(value: Double): String = percentFormat.format(value * 100)

    /** Parse Indonesian-formatted number: "1.000.000" -> 1000000 */
    fun parseIndonesian(text: String): Long? {
        return try {
            text.replace(".", "").replace(",", ".").toLongOrNull()
        } catch (_: Exception) {
            null
        }
    }

    /** Format compact: 1500000 -> "1,5jt", 50000 -> "50rb" */
    fun formatCompact(value: Long): String = when {
        value >= 1_000_000_000 -> "${decimalFormat.format(value / 1_000_000_000.0)}M"
        value >= 1_000_000 -> "${decimalFormat.format(value / 1_000_000.0)}jt"
        value >= 1_000 -> "${decimalFormat.format(value / 1_000.0)}rb"
        else -> value.toString()
    }
}
