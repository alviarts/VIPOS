package id.alviarts.vipos.core.designsystem.format

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Date

class DateTimeFormatTest {

    @Test
    fun `formatDate returns dd-MM-yyyy format`() {
        val date = Date(1715155200000L)
        val result = DateTimeFormat.formatDate(date)
        assertTrue(result.contains("/"))
        assertEquals(10, result.length)
    }

    @Test
    fun `formatTime returns HH-mm format`() {
        val date = Date()
        val result = DateTimeFormat.formatTime(date)
        assertTrue(result.contains(":"))
        assertEquals(5, result.length)
    }

    @Test
    fun `parseIso handles standard ISO string`() {
        assertNotNull(DateTimeFormat.parseIso("2026-05-08T12:00:00Z"))
    }

    @Test
    fun `parseIso handles ISO with milliseconds`() {
        assertNotNull(DateTimeFormat.parseIso("2026-05-08T12:00:00.123Z"))
    }

    @Test
    fun `parseIso handles ISO with timezone offset`() {
        assertNotNull(DateTimeFormat.parseIso("2026-05-08T12:00:00+07:00"))
    }

    @Test
    fun `parseIso returns null for invalid string`() {
        assertNull(DateTimeFormat.parseIso("not-a-date"))
    }

    @Test
    fun `formatIsoDateTime formats correctly`() {
        val result = DateTimeFormat.formatIsoDateTime("2026-05-08T14:30:00Z")
        assertTrue(result.contains("/"))
        assertTrue(result.contains(":"))
    }

    @Test
    fun `relativeTime returns baru saja for recent`() {
        assertEquals("baru saja", DateTimeFormat.relativeTime(Date()))
    }

    @Test
    fun `relativeTime returns menit lalu`() {
        val fiveMinAgo = Date(System.currentTimeMillis() - 5 * 60 * 1000)
        assertTrue(DateTimeFormat.relativeTime(fiveMinAgo).contains("menit lalu"))
    }

    @Test
    fun `relativeTime returns jam lalu`() {
        val twoHoursAgo = Date(System.currentTimeMillis() - 2 * 60 * 60 * 1000)
        assertTrue(DateTimeFormat.relativeTime(twoHoursAgo).contains("jam lalu"))
    }
}
