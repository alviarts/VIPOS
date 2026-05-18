package id.alviarts.vipos.feature.pos.util

import com.google.zxing.BarcodeFormat
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer

/**
 * Barcode decoder utility using ZXing (P3-11).
 *
 * Decodes barcodes from raw pixel data (camera frames).
 * Supports: EAN-13, EAN-8, Code 128, QR Code, UPC-A.
 *
 * This is the decode-only component. The camera integration
 * (CameraX + frame analysis) is a separate composable that
 * feeds pixel buffers into this decoder.
 *
 * Usage:
 * ```
 * val result = BarcodeDecoder.decode(pixels, width, height)
 * if (result != null) {
 *     // result.text = barcode value
 *     // result.format = barcode type
 * }
 * ```
 */
object BarcodeDecoder {

    private val reader = MultiFormatReader().apply {
        setHints(
            mapOf(
                DecodeHintType.POSSIBLE_FORMATS to listOf(
                    BarcodeFormat.EAN_13,
                    BarcodeFormat.EAN_8,
                    BarcodeFormat.CODE_128,
                    BarcodeFormat.QR_CODE,
                    BarcodeFormat.UPC_A,
                    BarcodeFormat.CODE_39,
                ),
                DecodeHintType.TRY_HARDER to true,
            ),
        )
    }

    data class BarcodeResult(
        val text: String,
        val format: String,
    )

    /**
     * Attempt to decode a barcode from an ARGB pixel array.
     *
     * @param pixels ARGB_8888 pixel array (width * height elements)
     * @param width image width in pixels
     * @param height image height in pixels
     * @return decoded barcode or null if none found
     */
    fun decode(pixels: IntArray, width: Int, height: Int): BarcodeResult? {
        return try {
            val source = RGBLuminanceSource(width, height, pixels)
            val bitmap = BinaryBitmap(HybridBinarizer(source))
            val result = reader.decodeWithState(bitmap)
            BarcodeResult(
                text = result.text,
                format = result.barcodeFormat.name,
            )
        } catch (_: Exception) {
            null
        } finally {
            reader.reset()
        }
    }

    /**
     * Validate an EAN-13 barcode checksum.
     */
    fun isValidEan13(code: String): Boolean {
        if (code.length != 13 || !code.all { it.isDigit() }) return false
        val digits = code.map { it.digitToInt() }
        val sum = digits.take(12).mapIndexed { i, d ->
            if (i % 2 == 0) d else d * 3
        }.sum()
        val checkDigit = (10 - (sum % 10)) % 10
        return checkDigit == digits[12]
    }
}
