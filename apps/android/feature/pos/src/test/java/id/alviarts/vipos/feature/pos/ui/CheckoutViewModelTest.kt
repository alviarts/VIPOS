package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.DefaultPaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [CheckoutViewModel] (P3-08 second slice —
 * picker state-machine).
 *
 * Acceptance focus:
 *  - `start(subtotal, isOnline)` snapshots the cart subtotal +
 *    the catalogue projection at call time, and pivots the
 *    picker lifecycle from Idle → Picking.
 *  - `selectMethod` replaces selection in place, no-ops when
 *    the picker is closed, no-ops when the method is filtered
 *    out of [CheckoutUiState.availableMethods].
 *  - `clearSelection` returns to no-pick without leaving the
 *    picker.
 *  - `confirmSelection` advances to Picked iff
 *    [CheckoutUiState.isReadyToCommit].
 *  - `reopenPicker` restores Picking from Picked without
 *    losing the previous selection (kasir hits "back").
 *  - `cancel` resets to fresh Idle.
 *  - The catalogue snapshot is *stable* across the picker —
 *    a network state change after `start` does NOT mutate
 *    [CheckoutUiState.availableMethods].
 *  - The `requiresOnline` filter from [DefaultPaymentMethodCatalog]
 *    flows through `start(isOnline=false)`.
 */
class CheckoutViewModelTest {

    @Test
    fun `initial state is Idle with empty cart and no methods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Idle, state.pickerStatus)
        assertEquals(0L, state.cartSubtotalIdr)
        assertTrue(state.availableMethods.isEmpty())
        assertNull(state.selectedMethod)
        assertFalse(state.isReadyToCommit)
        assertFalse(state.isPickerOpen)
    }

    @Test
    fun `start opens picker and snapshots subtotal plus methods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 71_000L, isOnline = true)
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Picking, state.pickerStatus)
        assertEquals(71_000L, state.cartSubtotalIdr)
        assertEquals(PaymentMethod.entries.toList(), state.availableMethods)
        assertNull(state.selectedMethod)
        assertTrue(state.isPickerOpen)
        // No method picked yet → not ready.
        assertFalse(state.isReadyToCommit)
    }

    @Test
    fun `start offline filters online-required methods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = false)
        val state = vm.uiState.value
        assertTrue(state.availableMethods.contains(PaymentMethod.CASH))
        assertTrue(state.availableMethods.contains(PaymentMethod.QRIS_STATIC))
        assertFalse(state.availableMethods.contains(PaymentMethod.QRIS_DYNAMIC))
        assertFalse(state.availableMethods.contains(PaymentMethod.GOPAY))
        // Same set as the catalogue projection itself.
        assertEquals(
            DefaultPaymentMethodCatalog.availableMethods(isOnline = false),
            state.availableMethods,
        )
    }

    @Test
    fun `selectMethod sets selectedMethod when picker is open`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        val state = vm.uiState.value
        assertEquals(PaymentMethod.CASH, state.selectedMethod)
        // Subtotal positive + selection + Picking → ready.
        assertTrue(state.isReadyToCommit)
    }

    @Test
    fun `selectMethod replaces previous pick in place`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        assertEquals(PaymentMethod.QRIS_DYNAMIC, vm.uiState.value.selectedMethod)
    }

    @Test
    fun `selectMethod is no-op before start`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.selectMethod(PaymentMethod.CASH)
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Idle, state.pickerStatus)
        assertNull(state.selectedMethod)
    }

    @Test
    fun `selectMethod is no-op for method outside availableMethods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        // Offline → online-required methods are filtered out.
        vm.start(cartSubtotalIdr = 30_000L, isOnline = false)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        assertNull(vm.uiState.value.selectedMethod)
    }

    @Test
    fun `clearSelection returns to no-pick`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.clearSelection()
        val state = vm.uiState.value
        assertNull(state.selectedMethod)
        // Picker stays open.
        assertEquals(CheckoutPickerStatus.Picking, state.pickerStatus)
        // No selection → not ready.
        assertFalse(state.isReadyToCommit)
    }

    @Test
    fun `confirmSelection advances to Picked when ready`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        assertEquals(CheckoutPickerStatus.Picked, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `confirmSelection is no-op when nothing picked`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.confirmSelection()
        // No pick → predicate stays false → state unchanged.
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `confirmSelection is no-op when subtotal is zero`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 0L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        // Empty cart → not ready → confirm refuses to advance.
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `reopenPicker restores Picking and keeps selection`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.reopenPicker()
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Picking, state.pickerStatus)
        // Previous pick is preserved so the kasir can change their mind.
        assertEquals(PaymentMethod.CASH, state.selectedMethod)
    }

    @Test
    fun `reopenPicker is no-op when not Picked`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        // Currently Picking.
        vm.reopenPicker()
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `cancel resets to fresh Idle`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.cancel()
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Idle, state.pickerStatus)
        assertEquals(0L, state.cartSubtotalIdr)
        assertNull(state.selectedMethod)
        assertTrue(state.availableMethods.isEmpty())
    }

    @Test
    fun `start re-opens with fresh subtotal and clears prior pick`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        // Kasir voids cart + starts new transaction without leaving checkout.
        vm.start(cartSubtotalIdr = 50_000L, isOnline = false)
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Picking, state.pickerStatus)
        assertEquals(50_000L, state.cartSubtotalIdr)
        // Catalogue re-snapshotted with the new online state.
        assertEquals(
            DefaultPaymentMethodCatalog.availableMethods(isOnline = false),
            state.availableMethods,
        )
        // Previous pick cleared.
        assertNull(state.selectedMethod)
    }

    @Test
    fun `catalogue snapshot is stable across the picker open lifetime`() {
        // The ViewModel must not re-derive availableMethods on every
        // selectMethod / clearSelection / etc. call — that would let
        // a flaky network yank a method out from under the kasir
        // mid-pick. Use a counting fake to assert the catalogue is
        // queried exactly once per `start`.
        var queryCount = 0
        val countingCatalog = PaymentMethodCatalog { _ ->
            queryCount++
            DefaultPaymentMethodCatalog.availableMethods(isOnline = true)
        }
        val vm = CheckoutViewModel(countingCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        assertEquals(1, queryCount)
        vm.selectMethod(PaymentMethod.CASH)
        vm.selectMethod(PaymentMethod.GOPAY)
        vm.clearSelection()
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        vm.reopenPicker()
        // None of the post-start mutations should hit the catalogue.
        assertEquals(1, queryCount)
        // A fresh start re-queries.
        vm.start(cartSubtotalIdr = 99_000L, isOnline = true)
        assertEquals(2, queryCount)
    }

    @Test
    fun `fake catalogue plumbs through to availableMethods`() {
        // Substitute a small catalogue so the picker only sees a
        // subset (e.g. simulating a merchant allow-list filter that
        // a future slice will layer on).
        val fakeCatalog = PaymentMethodCatalog { _ ->
            listOf(PaymentMethod.CASH, PaymentMethod.QRIS_DYNAMIC)
        }
        val vm = CheckoutViewModel(fakeCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        val state = vm.uiState.value
        assertEquals(
            listOf(PaymentMethod.CASH, PaymentMethod.QRIS_DYNAMIC),
            state.availableMethods,
        )
        // Picking a method that's NOT in the fake catalogue is a no-op.
        vm.selectMethod(PaymentMethod.GOPAY)
        assertNull(vm.uiState.value.selectedMethod)
        // Picking a method that IS in the fake catalogue works.
        vm.selectMethod(PaymentMethod.CASH)
        assertEquals(PaymentMethod.CASH, vm.uiState.value.selectedMethod)
    }
}
