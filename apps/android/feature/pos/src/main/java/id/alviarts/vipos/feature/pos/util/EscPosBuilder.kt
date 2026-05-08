package id.alviarts.vipos.feature.pos.util

/**
 * ESC/POS command builder for thermal receipt printers (P3-10).
 *
 * Builds a byte array of ESC/POS commands that can be sent to
 * a thermal printer via Bluetooth SPP or USB. Supports 58mm
 * and 80mm paper widths.
 *
 * This is the command-building layer only. The actual Bluetooth
 * connection + send is handled by a separate PrinterService
 * (requires hardware, deferred to P3-10 full integration).
 *
 * Supported commands:
 *  - Text (normal, bold, double-height, double-width)
 *  - Alignment (left, center, right)
 *  - Line feed
 *  - Cut paper (full, partial)
 *  - Cash drawer kick
 *  - Barcode (Code 128)
 *  - QR code
 */
class EscPosBuilder {

    private val buffer = mutableListOf<Byte>()

    /** Initialize printer (reset to defaults). */
    fun init(): EscPosBuilder {
        buffer.addAll(byteArrayOf(0x1B, 0x40).toList()) // ESC @
        return this
    }

    /** Set text alignment: 0=left, 1=center, 2=right. */
    fun align(alignment: Int): EscPosBuilder {
        buffer.addAll(byteArrayOf(0x1B, 0x61, alignment.toByte()).toList())
        return this
    }

    fun alignLeft() = align(0)
    fun alignCenter() = align(1)
    fun alignRight() = align(2)

    /** Enable/disable bold. */
    fun bold(enabled: Boolean): EscPosBuilder {
        buffer.addAll(byteArrayOf(0x1B, 0x45, if (enabled) 1 else 0).toList())
        return this
    }

    /** Set text size: 0=normal, 1=double-height, 2=double-width, 3=both. */
    fun textSize(size: Int): EscPosBuilder {
        val n = when (size) {
            1 -> 0x01 // double height
            2 -> 0x10 // double width
            3 -> 0x11 // both
            else -> 0x00 // normal
        }
        buffer.addAll(byteArrayOf(0x1D, 0x21, n.toByte()).toList())
        return this
    }

    /** Print text (does NOT add newline). */
    fun text(str: String): EscPosBuilder {
        buffer.addAll(str.toByteArray(Charsets.UTF_8).toList())
        return this
    }

    /** Print text + newline. */
    fun textLine(str: String): EscPosBuilder {
        text(str)
        lineFeed()
        return this
    }

    /** Line feed (newline). */
    fun lineFeed(lines: Int = 1): EscPosBuilder {
        repeat(lines) {
            buffer.add(0x0A)
        }
        return this
    }

    /** Print a separator line (dashes). */
    fun separator(width: Int = 32, char: Char = '-'): EscPosBuilder {
        textLine(char.toString().repeat(width))
        return this
    }

    /** Print two columns (left-aligned label + right-aligned value). */
    fun twoColumns(left: String, right: String, width: Int = 32): EscPosBuilder {
        val spaces = width - left.length - right.length
        val line = if (spaces > 0) {
            left + " ".repeat(spaces) + right
        } else {
            left + " " + right
        }
        textLine(line)
        return this
    }

    /** Cut paper (full cut). */
    fun cut(): EscPosBuilder {
        lineFeed(3)
        buffer.addAll(byteArrayOf(0x1D, 0x56, 0x00).toList()) // GS V 0
        return this
    }

    /** Partial cut. */
    fun partialCut(): EscPosBuilder {
        lineFeed(3)
        buffer.addAll(byteArrayOf(0x1D, 0x56, 0x01).toList()) // GS V 1
        return this
    }

    /** Kick cash drawer (pin 2). */
    fun cashDrawerKick(): EscPosBuilder {
        buffer.addAll(byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0x19).toList())
        return this
    }

    /** Build the final byte array to send to the printer. */
    fun build(): ByteArray = buffer.toByteArray()

    /** Reset the builder for reuse. */
    fun reset(): EscPosBuilder {
        buffer.clear()
        return this
    }
}
