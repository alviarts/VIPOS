package id.alviarts.vipos.feature.pos.util

import id.alviarts.vipos.feature.pos.ui.ReceiptGenerator
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Date

class ReceiptTemplateTest {

    private val sampleData = ReceiptGenerator.ReceiptData(
        invoiceNumber = "INV2605080001",
        cashierName = "Budi",
        dateTime = Date(),
        items = listOf(
            ReceiptGenerator.ReceiptItem("Es Kopi Susu", 2, 22_000, 44_000),
            ReceiptGenerator.ReceiptItem("Croissant", 1, 18_000, 18_000),
        ),
        subtotal = 62_000,
        discount = 5_000,
        total = 57_000,
        paymentMethod = "CASH",
        paymentAmount = 100_000,
        changeAmount = 43_000,
        customerName = "Siti",
        storeName = "Kopi Kenangan",
        storeAddress = "Jl. Sudirman No. 1",
        footerText = "Terima kasih atas kunjungan Anda!",
    )

    @Test
    fun `build58mm produces non-empty byte array`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        assertTrue(bytes.isNotEmpty())
    }

    @Test
    fun `build80mm produces non-empty byte array`() {
        val bytes = ReceiptTemplate.build80mm(sampleData)
        assertTrue(bytes.isNotEmpty())
    }

    @Test
    fun `build58mm contains store name`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("Kopi Kenangan"))
    }

    @Test
    fun `build58mm contains invoice number`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("INV2605080001"))
    }

    @Test
    fun `build58mm contains cashier name`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("Budi"))
    }

    @Test
    fun `build58mm contains product names`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("Es Kopi Susu"))
        assertTrue(str.contains("Croissant"))
    }

    @Test
    fun `build58mm contains customer name`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("Siti"))
    }

    @Test
    fun `build58mm contains footer`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        val str = String(bytes, Charsets.UTF_8)
        assertTrue(str.contains("Terima kasih"))
    }

    @Test
    fun `build80mm is larger than build58mm`() {
        val bytes58 = ReceiptTemplate.build58mm(sampleData)
        val bytes80 = ReceiptTemplate.build80mm(sampleData)
        // 80mm has wider separators so should be slightly larger
        assertTrue(bytes80.size >= bytes58.size)
    }

    @Test
    fun `build58mm ends with cut and cash drawer commands`() {
        val bytes = ReceiptTemplate.build58mm(sampleData)
        // Cash drawer kick is last: ESC p 0x00 0x19 0x19
        val last5 = bytes.takeLast(5)
        assertTrue(last5[0] == 0x1B.toByte()) // ESC
        assertTrue(last5[1] == 0x70.toByte()) // p
    }
}
