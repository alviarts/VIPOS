package id.alviarts.vipos.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StringExtensionsTest {

    @Test
    fun `capitalizeFirst capitalizes first letter only`() {
        assertEquals("Hello world", "hello world".capitalizeFirst())
        assertEquals("A", "a".capitalizeFirst())
        assertEquals("", "".capitalizeFirst())
    }

    @Test
    fun `truncate with ellipsis`() {
        assertEquals("Hello…", "Hello World".truncate(5))
        assertEquals("Hi", "Hi".truncate(5))
        assertEquals("", "".truncate(5))
    }

    @Test
    fun `truncate with custom suffix`() {
        assertEquals("Hello...", "Hello World".truncate(5, "..."))
    }

    @Test
    fun `removeWhitespace strips all spaces`() {
        assertEquals("helloworld", "  hello  world  ".removeWhitespace())
        assertEquals("abc", "a b c".removeWhitespace())
    }

    @Test
    fun `toSlug converts to URL-safe slug`() {
        assertEquals("hello-world", "Hello World!".toSlug())
        assertEquals("kopi-kenangan", "Kopi Kenangan".toSlug())
        assertEquals("test-123", "Test 123".toSlug())
    }

    @Test
    fun `maskPhone masks middle digits`() {
        assertEquals("0812****7890", "081234567890".maskPhone())
    }

    @Test
    fun `maskPhone returns short strings as-is`() {
        assertEquals("12345", "12345".maskPhone())
    }

    @Test
    fun `maskEmail masks local part`() {
        assertEquals("u***@example.com", "user@example.com".maskEmail())
    }

    @Test
    fun `maskEmail handles single char local`() {
        assertEquals("u@example.com", "u@example.com".maskEmail())
    }

    @Test
    fun `isIndonesianPhone validates correctly`() {
        assertTrue("081234567890".isIndonesianPhone())
        assertFalse("12345".isIndonesianPhone())
    }

    @Test
    fun `toIndonesianPhone normalizes`() {
        assertEquals("+6281234567890", "081234567890".toIndonesianPhone())
    }
}
