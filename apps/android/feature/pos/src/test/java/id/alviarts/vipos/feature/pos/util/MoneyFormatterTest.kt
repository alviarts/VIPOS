package id.alviarts.vipos.feature.pos.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MoneyFormatterTest {

    @Test
    fun `suggestTenderedAmounts includes exact amount`() {
        val suggestions = MoneyFormatter.suggestTenderedAmounts(37_500)
        assertTrue(suggestions.contains(37_500L))
    }

    @Test
    fun `suggestTenderedAmounts includes round-ups`() {
        val suggestions = MoneyFormatter.suggestTenderedAmounts(37_500)
        assertTrue(suggestions.contains(38_000L)) // round to 1k
        assertTrue(suggestions.contains(40_000L)) // round to 5k
        assertTrue(suggestions.contains(50_000L)) // round to 50k denom
    }

    @Test
    fun `suggestTenderedAmounts returns sorted ascending`() {
        val suggestions = MoneyFormatter.suggestTenderedAmounts(37_500)
        assertEquals(suggestions, suggestions.sorted())
    }

    @Test
    fun `suggestTenderedAmounts returns max 6 items`() {
        val suggestions = MoneyFormatter.suggestTenderedAmounts(37_500)
        assertTrue(suggestions.size <= 6)
    }

    @Test
    fun `suggestTenderedAmounts returns empty for zero`() {
        assertTrue(MoneyFormatter.suggestTenderedAmounts(0).isEmpty())
    }

    @Test
    fun `breakdownChange returns correct denominations`() {
        val breakdown = MoneyFormatter.breakdownChange(175_000)
        assertEquals(1, breakdown[100_000L])
        assertEquals(1, breakdown[50_000L])
        assertEquals(1, breakdown[20_000L])
        assertEquals(1, breakdown[5_000L])
    }

    @Test
    fun `breakdownChange returns empty for zero`() {
        assertTrue(MoneyFormatter.breakdownChange(0).isEmpty())
    }

    @Test
    fun `breakdownChange handles exact denomination`() {
        val breakdown = MoneyFormatter.breakdownChange(50_000)
        assertEquals(1, breakdown[50_000L])
        assertEquals(1, breakdown.size)
    }
}
