package id.alviarts.vipos.feature.pos.util

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BarcodeDecoderTest {

    @Test
    fun `isValidEan13 accepts valid EAN-13`() {
        // Standard EAN-13 with valid checksum
        assertTrue(BarcodeDecoder.isValidEan13("4006381333931"))
        assertTrue(BarcodeDecoder.isValidEan13("5901234123457"))
    }

    @Test
    fun `isValidEan13 rejects invalid checksum`() {
        assertFalse(BarcodeDecoder.isValidEan13("4006381333932")) // wrong check digit
        assertFalse(BarcodeDecoder.isValidEan13("5901234123458"))
    }

    @Test
    fun `isValidEan13 rejects wrong length`() {
        assertFalse(BarcodeDecoder.isValidEan13("123456789012")) // 12 digits
        assertFalse(BarcodeDecoder.isValidEan13("12345678901234")) // 14 digits
    }

    @Test
    fun `isValidEan13 rejects non-numeric`() {
        assertFalse(BarcodeDecoder.isValidEan13("400638133393A"))
        assertFalse(BarcodeDecoder.isValidEan13("abcdefghijklm"))
    }

    @Test
    fun `decode returns null for empty pixels`() {
        val pixels = IntArray(100 * 100) { 0xFFFFFFFF.toInt() } // all white
        val result = BarcodeDecoder.decode(pixels, 100, 100)
        // No barcode in white image
        assertTrue(result == null)
    }
}
