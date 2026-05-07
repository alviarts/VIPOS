package id.alviarts.vipos.feature.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the [PaymentMethod] enum + [PaymentMethodCatalog]
 * (P3-08 first slice — payment-method data layer).
 *
 * Acceptance focus:
 * - [PaymentMethod.fromCode] is a total partial inverse of
 *   [PaymentMethod.code]; round-trips for every known entry and
 *   returns `null` (not throws) for unknown.
 * - [DefaultPaymentMethodCatalog.availableMethods] gates online-
 *   required entries on the [isOnline] flag.
 * - Cash + EDC manual + QRIS Statis stay available offline (every
 *   kasir must always be able to take cash).
 * - The picker order is the enum declaration order — re-ordering
 *   the enum re-orders the picker, which is documented and
 *   intentional.
 */
class PaymentMethodCatalogTest {

    @Test
    fun `fromCode round-trips every enum entry`() {
        PaymentMethod.entries.forEach { method ->
            val resolved = PaymentMethod.fromCode(method.code)
            assertNotNull("code=${method.code} must resolve", resolved)
            assertSame(method, resolved)
        }
    }

    @Test
    fun `fromCode returns null for unknown code`() {
        assertNull(PaymentMethod.fromCode("BITCOIN"))
        assertNull(PaymentMethod.fromCode(""))
        // Case-sensitive on purpose — the wire format is upper-snake.
        assertNull(PaymentMethod.fromCode("cash"))
    }

    @Test
    fun `available methods online includes every entry`() {
        val online = DefaultPaymentMethodCatalog.availableMethods(isOnline = true)
        assertEquals(PaymentMethod.entries.size, online.size)
        assertTrue(online.containsAll(PaymentMethod.entries.toList()))
    }

    @Test
    fun `available methods offline filters online-required`() {
        val offline = DefaultPaymentMethodCatalog.availableMethods(isOnline = false)
        val onlineRequired = PaymentMethod.entries.filter { it.requiresOnline }
        // Every method that needs the wire is dropped.
        offline.forEach { assertFalse(it.requiresOnline) }
        // No method that doesn't need the wire is dropped.
        val expectedOffline = PaymentMethod.entries.filterNot { it.requiresOnline }
        assertEquals(expectedOffline, offline)
        // And dropped count matches the online-required count.
        assertEquals(
            PaymentMethod.entries.size - onlineRequired.size,
            offline.size,
        )
    }

    @Test
    fun `cash is always available even when offline`() {
        val offline = DefaultPaymentMethodCatalog.availableMethods(isOnline = false)
        assertTrue("Cash MUST always be pickable", offline.contains(PaymentMethod.CASH))
        assertEquals(PaymentMethod.CASH, offline.first())
    }

    @Test
    fun `qris dynamic and e-wallets are filtered offline`() {
        val offline = DefaultPaymentMethodCatalog.availableMethods(isOnline = false)
        listOf(
            PaymentMethod.QRIS_DYNAMIC,
            PaymentMethod.GOPAY,
            PaymentMethod.OVO,
            PaymentMethod.DANA,
            PaymentMethod.SHOPEEPAY,
            PaymentMethod.LINKAJA,
        ).forEach { method ->
            assertFalse(
                "${method.code} must be filtered offline",
                offline.contains(method),
            )
        }
    }

    @Test
    fun `qris statis stays available offline`() {
        val offline = DefaultPaymentMethodCatalog.availableMethods(isOnline = false)
        assertTrue(
            "QRIS Statis verifies after the fact, must work offline",
            offline.contains(PaymentMethod.QRIS_STATIC),
        )
    }

    @Test
    fun `online catalogue order matches enum declaration order`() {
        val online = DefaultPaymentMethodCatalog.availableMethods(isOnline = true)
        // Picker priority is documented as the enum order; assert
        // the contract so a reorder is a deliberate test update.
        assertEquals(PaymentMethod.entries.toList(), online)
    }

    @Test
    fun `every method has a non-blank display label`() {
        PaymentMethod.entries.forEach { method ->
            assertTrue(
                "code=${method.code} has blank displayLabel",
                method.displayLabel.isNotBlank(),
            )
        }
    }

    @Test
    fun `code matches the v2-14 catalog literal`() {
        // Tight regression guard: codes are persisted on the
        // backend `transactions.payment_method` column. Spot-check
        // a few against the literals from
        // `docs/v2/14_PAYMENT_METHODS.md` §1 so a typo here turns
        // into a unit test failure, not a kasir-flow runtime bug.
        assertEquals("CASH", PaymentMethod.CASH.code)
        assertEquals("EDC", PaymentMethod.EDC.code)
        assertEquals("QRIS_STATIC", PaymentMethod.QRIS_STATIC.code)
        assertEquals("QRIS_DYNAMIC", PaymentMethod.QRIS_DYNAMIC.code)
        assertEquals("BANK_TRANSFER", PaymentMethod.BANK_TRANSFER.code)
        assertEquals("LOYALTY_POINT", PaymentMethod.LOYALTY_POINT.code)
    }
}
