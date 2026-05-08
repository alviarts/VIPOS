package id.alviarts.vipos.feature.pos.ui

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Receipt PDF generator + share utility (P3-13).
 *
 * Generates a simple receipt PDF from transaction data and
 * provides share intents for WhatsApp and generic sharing.
 *
 * The receipt layout mimics a 58mm thermal printer format:
 * narrow width, monospace-style alignment, dashed separators.
 *
 * For actual thermal printing (P3-10), a separate ESC/POS
 * byte-stream builder will be needed. This class handles the
 * digital receipt (PDF + share) use case.
 */
object ReceiptGenerator {

    private const val PAGE_WIDTH = 226 // ~58mm at 72dpi (actually 164pt but we use 226 for readability)
    private const val PAGE_HEIGHT = 600
    private const val MARGIN = 12f
    private const val LINE_HEIGHT = 14f

    data class ReceiptData(
        val invoiceNumber: String,
        val cashierName: String,
        val dateTime: Date = Date(),
        val items: List<ReceiptItem>,
        val subtotal: Long,
        val discount: Long = 0,
        val total: Long,
        val paymentMethod: String,
        val paymentAmount: Long,
        val changeAmount: Long,
        val customerName: String? = null,
        val storeName: String = "VIPOS",
        val storeAddress: String? = null,
        val footerText: String? = null,
    )

    data class ReceiptItem(
        val name: String,
        val quantity: Int,
        val unitPrice: Long,
        val lineTotal: Long,
    )

    /**
     * Generate a receipt PDF file in the app's cache directory.
     * Returns the [File] path for sharing.
     */
    fun generatePdf(context: Context, data: ReceiptData): File {
        val document = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, 1).create()
        val page = document.startPage(pageInfo)
        val canvas = page.canvas

        val paint = Paint().apply {
            textSize = 9f
            isAntiAlias = true
        }
        val boldPaint = Paint(paint).apply {
            isFakeBoldText = true
        }
        val smallPaint = Paint(paint).apply {
            textSize = 7f
        }

        var y = MARGIN + LINE_HEIGHT
        val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("id"))

        // Header
        canvas.drawText(data.storeName, MARGIN, y, boldPaint)
        y += LINE_HEIGHT
        if (data.storeAddress != null) {
            canvas.drawText(data.storeAddress, MARGIN, y, smallPaint)
            y += LINE_HEIGHT
        }
        y += 4f
        canvas.drawText("─".repeat(30), MARGIN, y, smallPaint)
        y += LINE_HEIGHT

        // Invoice info
        canvas.drawText("No: ${data.invoiceNumber}", MARGIN, y, paint)
        y += LINE_HEIGHT
        canvas.drawText("Kasir: ${data.cashierName}", MARGIN, y, paint)
        y += LINE_HEIGHT
        canvas.drawText("Tgl: ${dateFormat.format(data.dateTime)}", MARGIN, y, paint)
        if (data.customerName != null) {
            y += LINE_HEIGHT
            canvas.drawText("Pelanggan: ${data.customerName}", MARGIN, y, paint)
        }
        y += LINE_HEIGHT + 4f
        canvas.drawText("─".repeat(30), MARGIN, y, smallPaint)
        y += LINE_HEIGHT

        // Items
        for (item in data.items) {
            canvas.drawText("${item.name}", MARGIN, y, paint)
            y += LINE_HEIGHT
            val qtyLine = "  ${item.quantity} x ${formatIdrLabel(item.unitPrice)}"
            val totalStr = formatIdrLabel(item.lineTotal)
            canvas.drawText(qtyLine, MARGIN, y, smallPaint)
            canvas.drawText(totalStr, PAGE_WIDTH - MARGIN - paint.measureText(totalStr), y, paint)
            y += LINE_HEIGHT
        }

        y += 4f
        canvas.drawText("─".repeat(30), MARGIN, y, smallPaint)
        y += LINE_HEIGHT

        // Totals
        drawAlignedRow(canvas, "Subtotal", formatIdrLabel(data.subtotal), MARGIN, y, paint)
        y += LINE_HEIGHT
        if (data.discount > 0) {
            drawAlignedRow(canvas, "Diskon", "-${formatIdrLabel(data.discount)}", MARGIN, y, paint)
            y += LINE_HEIGHT
        }
        drawAlignedRow(canvas, "TOTAL", formatIdrLabel(data.total), MARGIN, y, boldPaint)
        y += LINE_HEIGHT + 4f
        canvas.drawText("─".repeat(30), MARGIN, y, smallPaint)
        y += LINE_HEIGHT

        // Payment
        drawAlignedRow(canvas, "Bayar (${data.paymentMethod})", formatIdrLabel(data.paymentAmount), MARGIN, y, paint)
        y += LINE_HEIGHT
        if (data.changeAmount > 0) {
            drawAlignedRow(canvas, "Kembalian", formatIdrLabel(data.changeAmount), MARGIN, y, paint)
            y += LINE_HEIGHT
        }

        // Footer
        y += LINE_HEIGHT
        if (data.footerText != null) {
            canvas.drawText(data.footerText, MARGIN, y, smallPaint)
            y += LINE_HEIGHT
        }
        canvas.drawText("Terima kasih!", MARGIN, y, paint)

        document.finishPage(page)

        // Write to cache
        val file = File(context.cacheDir, "receipt_${data.invoiceNumber}.pdf")
        FileOutputStream(file).use { document.writeTo(it) }
        document.close()

        return file
    }

    /**
     * Create a share intent for the receipt PDF.
     * Can be used with WhatsApp or any other app.
     */
    fun createShareIntent(context: Context, file: File, mimeType: String = "application/pdf"): Intent {
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
        return Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "Struk pembayaran VIPOS")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    /**
     * Create a WhatsApp-specific share intent.
     */
    fun createWhatsAppShareIntent(context: Context, file: File, phoneNumber: String? = null): Intent {
        val intent = createShareIntent(context, file)
        intent.setPackage("com.whatsapp")
        if (phoneNumber != null) {
            // Format: country code + number without leading 0
            val formatted = phoneNumber.removePrefix("0").let { "62$it" }
            intent.putExtra("jid", "$formatted@s.whatsapp.net")
        }
        return intent
    }

    private fun drawAlignedRow(canvas: Canvas, label: String, value: String, x: Float, y: Float, paint: Paint) {
        canvas.drawText(label, x, y, paint)
        canvas.drawText(value, PAGE_WIDTH - MARGIN - paint.measureText(value), y, paint)
    }
}
