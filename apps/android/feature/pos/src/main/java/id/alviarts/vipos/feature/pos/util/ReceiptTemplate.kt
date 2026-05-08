package id.alviarts.vipos.feature.pos.util

import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.feature.pos.ui.ReceiptGenerator

/**
 * Thermal receipt template using ESC/POS commands (P3-10/P3-13).
 *
 * Formats a [ReceiptGenerator.ReceiptData] into ESC/POS byte
 * commands ready to send to a 58mm or 80mm thermal printer.
 */
object ReceiptTemplate {

    private const val WIDTH_58MM = 32
    private const val WIDTH_80MM = 48

    /**
     * Build a receipt for a 58mm printer.
     */
    fun build58mm(data: ReceiptGenerator.ReceiptData): ByteArray {
        return buildReceipt(data, WIDTH_58MM)
    }

    /**
     * Build a receipt for an 80mm printer.
     */
    fun build80mm(data: ReceiptGenerator.ReceiptData): ByteArray {
        return buildReceipt(data, WIDTH_80MM)
    }

    private fun buildReceipt(data: ReceiptGenerator.ReceiptData, width: Int): ByteArray {
        val b = EscPosBuilder().init()

        // Header
        b.alignCenter()
        b.bold(true).textSize(1)
        b.textLine(data.storeName)
        b.textSize(0).bold(false)
        if (data.storeAddress != null) {
            b.textLine(data.storeAddress)
        }
        b.lineFeed()
        b.separator(width)

        // Invoice info
        b.alignLeft()
        b.textLine("No: ${data.invoiceNumber}")
        b.textLine("Kasir: ${data.cashierName}")
        val dateStr = java.text.SimpleDateFormat("dd/MM/yy HH:mm", java.util.Locale("id"))
            .format(data.dateTime)
        b.textLine("Tgl: $dateStr")
        if (data.customerName != null) {
            b.textLine("Plg: ${data.customerName}")
        }
        b.separator(width)

        // Items
        for (item in data.items) {
            b.textLine(item.name)
            b.twoColumns(
                "  ${item.quantity} x ${formatIdrLabel(item.unitPrice)}",
                formatIdrLabel(item.lineTotal),
                width,
            )
        }
        b.separator(width)

        // Totals
        b.twoColumns("Subtotal", formatIdrLabel(data.subtotal), width)
        if (data.discount > 0) {
            b.twoColumns("Diskon", "-${formatIdrLabel(data.discount)}", width)
        }
        b.bold(true)
        b.twoColumns("TOTAL", formatIdrLabel(data.total), width)
        b.bold(false)
        b.separator(width)

        // Payment
        b.twoColumns("Bayar (${data.paymentMethod})", formatIdrLabel(data.paymentAmount), width)
        if (data.changeAmount > 0) {
            b.twoColumns("Kembalian", formatIdrLabel(data.changeAmount), width)
        }

        // Footer
        b.lineFeed()
        b.alignCenter()
        if (data.footerText != null) {
            b.textLine(data.footerText)
        }
        b.textLine("Terima kasih!")
        b.lineFeed()

        // Cut + cash drawer
        b.cut()
        b.cashDrawerKick()

        return b.build()
    }
}
