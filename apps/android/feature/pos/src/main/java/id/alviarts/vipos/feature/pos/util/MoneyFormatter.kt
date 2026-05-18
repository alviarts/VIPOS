package id.alviarts.vipos.feature.pos.util

/**
 * Money formatting utilities for the POS (P4-13).
 *
 * Provides cash denomination suggestions for the kasir when
 * entering tendered amount (P3-08 AC #2: "suggest pecahan").
 */
object MoneyFormatter {

    /**
     * Indonesian cash denominations (notes + coins commonly used).
     */
    val DENOMINATIONS = listOf(
        100_000L,
        50_000L,
        20_000L,
        10_000L,
        5_000L,
        2_000L,
        1_000L,
        500L,
    )

    /**
     * Suggest rounded-up amounts the kasir might tender.
     *
     * For a total of Rp 37,500:
     *  - Exact: 37,500
     *  - Round up: 38,000, 40,000, 50,000, 100,000
     *
     * Returns a list of suggested amounts, sorted ascending.
     */
    fun suggestTenderedAmounts(totalIdr: Long): List<Long> {
        if (totalIdr <= 0) return emptyList()

        val suggestions = mutableSetOf(totalIdr) // Always include exact

        // Round up to nearest denomination multiples
        for (denom in DENOMINATIONS) {
            val rounded = ((totalIdr + denom - 1) / denom) * denom
            if (rounded >= totalIdr && rounded <= totalIdr * 3) {
                suggestions.add(rounded)
            }
        }

        // Common round-ups
        val roundTo1k = ((totalIdr + 999) / 1000) * 1000
        val roundTo5k = ((totalIdr + 4999) / 5000) * 5000
        val roundTo10k = ((totalIdr + 9999) / 10000) * 10000
        suggestions.add(roundTo1k)
        suggestions.add(roundTo5k)
        suggestions.add(roundTo10k)

        return suggestions
            .filter { it >= totalIdr }
            .sorted()
            .take(6)
            .toList()
    }

    /**
     * Calculate minimum notes/coins needed for change.
     * Returns a map of denomination -> count.
     */
    fun breakdownChange(changeIdr: Long): Map<Long, Int> {
        if (changeIdr <= 0) return emptyMap()

        val result = mutableMapOf<Long, Int>()
        var remaining = changeIdr

        for (denom in DENOMINATIONS) {
            if (remaining >= denom) {
                val count = (remaining / denom).toInt()
                result[denom] = count
                remaining -= denom * count
            }
        }

        return result
    }
}
