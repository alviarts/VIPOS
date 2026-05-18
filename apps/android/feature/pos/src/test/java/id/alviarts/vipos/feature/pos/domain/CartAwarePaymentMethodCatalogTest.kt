package id.alviarts.vipos.feature.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [CartAwarePaymentMethodCatalog].
 *
 * Coverage:
 *  - Walk-in cart filters CREDIT / DEPOSIT / LOYALTY_POINT
 *    regardless of online state.
 *  - Registered customer with positive deposit balance keeps
 *    DEPOSIT, drops LOYALTY_POINT until threshold is met.
 *  - Online and offline filter chains compose correctly with the
 *    inner [DefaultPaymentMethodCatalog].
 *  - Order from the inner catalogue is preserved.
 *  - The context provider is queried on every call (so a fresh
 *    cart picks up state changes without rebuilding the
 *    catalogue).
 */
class CartAwarePaymentMethodCatalogTest {

    @Test
    fun `walk-in cart filters credit deposit and loyalty regardless of online state`() {
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { CartContext.WALK_IN },
        )
        listOf(true, false).forEach { isOnline ->
            val methods = catalog.availableMethods(isOnline = isOnline)
            assertFalse(
                "CREDIT must be filtered for walk-in (isOnline=$isOnline)",
                methods.contains(PaymentMethod.CREDIT),
            )
            assertFalse(
                "DEPOSIT must be filtered for walk-in (isOnline=$isOnline)",
                methods.contains(PaymentMethod.DEPOSIT),
            )
            assertFalse(
                "LOYALTY_POINT must be filtered for walk-in (isOnline=$isOnline)",
                methods.contains(PaymentMethod.LOYALTY_POINT),
            )
        }
    }

    @Test
    fun `walk-in cart still keeps cash and EDC and QRIS`() {
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { CartContext.WALK_IN },
        )
        val online = catalog.availableMethods(isOnline = true)
        listOf(
            PaymentMethod.CASH,
            PaymentMethod.EDC,
            PaymentMethod.QRIS_STATIC,
            PaymentMethod.QRIS_DYNAMIC,
            PaymentMethod.GOPAY,
            PaymentMethod.OVO,
            PaymentMethod.DANA,
            PaymentMethod.SHOPEEPAY,
            PaymentMethod.LINKAJA,
            PaymentMethod.BANK_TRANSFER,
            PaymentMethod.VOUCHER,
            PaymentMethod.OTHER,
        ).forEach { method ->
            assertTrue(
                "${method.code} must stay available for walk-in online",
                online.contains(method),
            )
        }
    }

    @Test
    fun `registered customer with positive deposit balance keeps deposit`() {
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 50_000L,
            customerLoyaltyPoints = 0L,
            loyaltyPointsRedeemThreshold = 100L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val methods = catalog.availableMethods(isOnline = true)
        assertTrue("CREDIT must be offered to registered customer", methods.contains(PaymentMethod.CREDIT))
        assertTrue(
            "DEPOSIT must be offered when balance > 0",
            methods.contains(PaymentMethod.DEPOSIT),
        )
        assertFalse(
            "LOYALTY_POINT below threshold must be filtered",
            methods.contains(PaymentMethod.LOYALTY_POINT),
        )
    }

    @Test
    fun `registered customer with zero deposit balance drops deposit only`() {
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 0L,
            customerLoyaltyPoints = 0L,
            loyaltyPointsRedeemThreshold = 0L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val methods = catalog.availableMethods(isOnline = true)
        assertTrue(methods.contains(PaymentMethod.CREDIT))
        assertFalse(
            "DEPOSIT must be filtered when balance is zero",
            methods.contains(PaymentMethod.DEPOSIT),
        )
    }

    @Test
    fun `loyalty offered when points meet threshold and threshold is positive`() {
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 0L,
            customerLoyaltyPoints = 250L,
            loyaltyPointsRedeemThreshold = 100L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val methods = catalog.availableMethods(isOnline = true)
        assertTrue(
            "LOYALTY_POINT must be offered when points >= threshold and threshold > 0",
            methods.contains(PaymentMethod.LOYALTY_POINT),
        )
    }

    @Test
    fun `loyalty filtered when threshold is zero even with points`() {
        // A misconfigured merchant (`threshold == 0`) should NOT
        // accidentally enable redemption — `0` is the default for
        // a fresh config and means "redemption is disabled".
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 0L,
            customerLoyaltyPoints = 1_000L,
            loyaltyPointsRedeemThreshold = 0L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val methods = catalog.availableMethods(isOnline = true)
        assertFalse(
            "LOYALTY_POINT must be filtered when threshold is zero (redemption disabled)",
            methods.contains(PaymentMethod.LOYALTY_POINT),
        )
    }

    @Test
    fun `offline filter from inner catalogue still applies`() {
        // Decorator never re-introduces methods the inner dropped.
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 100_000L,
            customerLoyaltyPoints = 1_000L,
            loyaltyPointsRedeemThreshold = 100L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val offline = catalog.availableMethods(isOnline = false)
        offline.forEach { method ->
            assertFalse(
                "${method.code} requires online but slipped past offline filter",
                method.requiresOnline,
            )
        }
    }

    @Test
    fun `order from inner catalogue is preserved`() {
        val context = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 100_000L,
            customerLoyaltyPoints = 1_000L,
            loyaltyPointsRedeemThreshold = 100L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = { context },
        )
        val online = catalog.availableMethods(isOnline = true)
        val expected = DefaultPaymentMethodCatalog.availableMethods(isOnline = true)
            .filter { it != PaymentMethod.CREDIT || !context.isWalkInCustomer }
            .filter { it != PaymentMethod.DEPOSIT || context.customerDepositBalanceIdr > 0L }
            .filter {
                it != PaymentMethod.LOYALTY_POINT ||
                    (
                        context.customerLoyaltyPoints >= context.loyaltyPointsRedeemThreshold &&
                            context.loyaltyPointsRedeemThreshold > 0L
                        )
            }
        assertEquals(expected, online)
    }

    @Test
    fun `context provider is queried on every call`() {
        var calls = 0
        val ctx1 = CartContext.WALK_IN
        val ctx2 = CartContext(
            isWalkInCustomer = false,
            customerDepositBalanceIdr = 50_000L,
            customerLoyaltyPoints = 200L,
            loyaltyPointsRedeemThreshold = 100L,
        )
        val catalog = CartAwarePaymentMethodCatalog(
            inner = DefaultPaymentMethodCatalog,
            contextProvider = {
                calls += 1
                if (calls == 1) ctx1 else ctx2
            },
        )
        val first = catalog.availableMethods(isOnline = true)
        val second = catalog.availableMethods(isOnline = true)
        assertEquals(2, calls)
        assertFalse(
            "First call (walk-in) must filter CREDIT",
            first.contains(PaymentMethod.CREDIT),
        )
        assertTrue(
            "Second call (registered + balance) must keep CREDIT and DEPOSIT and LOYALTY_POINT",
            second.contains(PaymentMethod.CREDIT) &&
                second.contains(PaymentMethod.DEPOSIT) &&
                second.contains(PaymentMethod.LOYALTY_POINT),
        )
    }
}
