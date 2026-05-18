package id.alviarts.vipos.core.designsystem.format

import java.text.NumberFormat
import java.util.Locale

/**
 * Locale-aware IDR formatting helper.
 *
 * Returns the supplied whole-rupiah [amount] formatted as a
 * `Rp `-prefixed label using `id-ID` thousands grouping with no
 * fractional digits. Indonesia's `NumberFormat.getCurrencyInstance`
 * for `id-ID` returns `Rp 123.456,00` — the trailing zero
 * decimals are noise on the kasir UI, so this helper builds a
 * custom format with grouping but no fraction digits.
 *
 * Single source of truth for the kasir flow's IDR rendering;
 * previously duplicated as private helpers in
 * [`PosCatalogueScreen`][id.alviarts.vipos.feature.pos.ui], the
 * variant sheet, and the checkout sheet.
 */
fun formatIdrLabel(amount: Long): String {
    val formatter = NumberFormat.getNumberInstance(Locale("id", "ID")).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }
    return "Rp " + formatter.format(amount)
}
