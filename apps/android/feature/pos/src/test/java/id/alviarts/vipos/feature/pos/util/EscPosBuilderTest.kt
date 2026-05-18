package id.alviarts.vipos.feature.pos.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosBuilderTest {

    @Test
    fun `init sends ESC @ command`() {
        val bytes = EscPosBuilder().init().build()
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x40.toByte(), bytes[1])
    }

    @Test
    fun `alignCenter sends correct command`() {
        val bytes = EscPosBuilder().alignCenter().build()
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x61.toByte(), bytes[1])
        assertEquals(1.toByte(), bytes[2])
    }

    @Test
    fun `bold on sends ESC E 1`() {
        val bytes = EscPosBuilder().bold(true).build()
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x45.toByte(), bytes[1])
        assertEquals(1.toByte(), bytes[2])
    }

    @Test
    fun `bold off sends ESC E 0`() {
        val bytes = EscPosBuilder().bold(false).build()
        assertEquals(0x45.toByte(), bytes[1])
        assertEquals(0.toByte(), bytes[2])
    }

    @Test
    fun `textLine appends text plus newline`() {
        val bytes = EscPosBuilder().textLine("Hello").build()
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.startsWith("Hello"))
        assertEquals(0x0A.toByte(), bytes.last())
    }

    @Test
    fun `separator creates dashes`() {
        val bytes = EscPosBuilder().separator(10, '-').build()
        val str = String(bytes.dropLast(1).toByteArray(), Charsets.UTF_8)
        assertEquals("----------", str)
    }

    @Test
    fun `twoColumns aligns left and right`() {
        val bytes = EscPosBuilder().twoColumns("Left", "Right", 20).build()
        val str = String(bytes.dropLast(1).toByteArray(), Charsets.UTF_8)
        assertEquals(20, str.length)
        assertTrue(str.startsWith("Left"))
        assertTrue(str.endsWith("Right"))
    }

    @Test
    fun `cut sends GS V 0`() {
        val bytes = EscPosBuilder().cut().build()
        // 3 line feeds + GS V 0
        val cutCmd = bytes.takeLast(3)
        assertEquals(0x1D.toByte(), cutCmd[0])
        assertEquals(0x56.toByte(), cutCmd[1])
        assertEquals(0x00.toByte(), cutCmd[2])
    }

    @Test
    fun `cashDrawerKick sends ESC p command`() {
        val bytes = EscPosBuilder().cashDrawerKick().build()
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x70.toByte(), bytes[1])
    }

    @Test
    fun `reset clears buffer`() {
        val builder = EscPosBuilder().textLine("Hello")
        assertTrue(builder.build().isNotEmpty())
        builder.reset()
        assertTrue(builder.build().isEmpty())
    }

    @Test
    fun `chaining produces correct sequence`() {
        val bytes = EscPosBuilder()
            .init()
            .alignCenter()
            .bold(true)
            .textLine("VIPOS")
            .bold(false)
            .build()
        assertTrue(bytes.size > 10)
        // First 2 bytes: ESC @
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x40.toByte(), bytes[1])
    }
}
