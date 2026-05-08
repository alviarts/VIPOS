package id.alviarts.vipos.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidatorsTest {

    @Test
    fun `isValidPhone accepts 08xx format`() {
        assertTrue(Validators.isValidPhone("081234567890"))
        assertTrue(Validators.isValidPhone("08123456789"))
    }

    @Test
    fun `isValidPhone accepts +628xx format`() {
        assertTrue(Validators.isValidPhone("+6281234567890"))
    }

    @Test
    fun `isValidPhone accepts 628xx format`() {
        assertTrue(Validators.isValidPhone("6281234567890"))
    }

    @Test
    fun `isValidPhone rejects invalid numbers`() {
        assertFalse(Validators.isValidPhone("12345"))
        assertFalse(Validators.isValidPhone("abcdefgh"))
        assertFalse(Validators.isValidPhone(""))
        assertFalse(Validators.isValidPhone("071234567890")) // not 08xx
    }

    @Test
    fun `isValidEmail accepts valid emails`() {
        assertTrue(Validators.isValidEmail("user@example.com"))
        assertTrue(Validators.isValidEmail("test.user+tag@domain.co.id"))
    }

    @Test
    fun `isValidEmail rejects invalid emails`() {
        assertFalse(Validators.isValidEmail(""))
        assertFalse(Validators.isValidEmail("notanemail"))
        assertFalse(Validators.isValidEmail("@domain.com"))
        assertFalse(Validators.isValidEmail("user@"))
    }

    @Test
    fun `isPositiveInteger works correctly`() {
        assertTrue(Validators.isPositiveInteger("1"))
        assertTrue(Validators.isPositiveInteger("100"))
        assertFalse(Validators.isPositiveInteger("0"))
        assertFalse(Validators.isPositiveInteger("-1"))
        assertFalse(Validators.isPositiveInteger("abc"))
        assertFalse(Validators.isPositiveInteger(""))
    }

    @Test
    fun `isValidSku accepts valid SKUs`() {
        assertTrue(Validators.isValidSku("MN-001"))
        assertTrue(Validators.isValidSku("ABC123"))
        assertTrue(Validators.isValidSku("A-B-C"))
    }

    @Test
    fun `isValidSku rejects invalid SKUs`() {
        assertFalse(Validators.isValidSku("AB")) // too short
        assertFalse(Validators.isValidSku("has space"))
        assertFalse(Validators.isValidSku("special!char"))
    }

    @Test
    fun `normalizePhone converts 08xx to +628xx`() {
        assertEquals("+6281234567890", Validators.normalizePhone("081234567890"))
    }

    @Test
    fun `normalizePhone keeps +62 as is`() {
        assertEquals("+6281234567890", Validators.normalizePhone("+6281234567890"))
    }

    @Test
    fun `normalizePhone converts 62xx to +62xx`() {
        assertEquals("+6281234567890", Validators.normalizePhone("6281234567890"))
    }

    @Test
    fun `isStrongPassword requires min 6 chars`() {
        assertTrue(Validators.isStrongPassword("123456"))
        assertTrue(Validators.isStrongPassword("abcdefgh"))
        assertFalse(Validators.isStrongPassword("12345"))
        assertFalse(Validators.isStrongPassword(""))
    }
}
