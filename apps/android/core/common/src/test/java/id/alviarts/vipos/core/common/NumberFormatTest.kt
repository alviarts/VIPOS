package id.alviarts.vipos.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NumberFormatTest {

    @Test
    fun `formatInteger adds thousand separators`() {
        assertEquals("1.000.000", NumberFormat.formatInteger(1_000_000))
        assertEquals("500", NumberFormat.formatInteger(500))
        assertEquals("0", NumberFormat.formatInteger(0))
    }

    @Test
    fun `formatDecimal uses comma for decimal`() {
        val result = NumberFormat.formatDecimal(1234.5)
        // Indonesian format: 1.234,5
        assertEquals("1.234,5", result)
    }

    @Test
    fun `formatPercent formats correctly`() {
        assertEquals("15%", NumberFormat.formatPercent(0.15))
        assertEquals("100%", NumberFormat.formatPercent(1.0))
    }

    @Test
    fun `parseIndonesian parses dot-separated numbers`() {
        assertEquals(1_000_000L, NumberFormat.parseIndonesian("1.000.000"))
        assertEquals(500L, NumberFormat.parseIndonesian("500"))
    }

    @Test
    fun `parseIndonesian returns null for invalid`() {
        assertNull(NumberFormat.parseIndonesian("abc"))
    }

    @Test
    fun `formatCompact formats millions as jt`() {
        assertEquals("1,5jt", NumberFormat.formatCompact(1_500_000))
    }

    @Test
    fun `formatCompact formats thousands as rb`() {
        assertEquals("50rb", NumberFormat.formatCompact(50_000))
    }

    @Test
    fun `formatCompact returns raw for small numbers`() {
        assertEquals("999", NumberFormat.formatCompact(999))
    }
}
