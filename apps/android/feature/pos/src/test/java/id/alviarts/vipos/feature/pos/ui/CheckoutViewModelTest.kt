package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.DefaultPaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [CheckoutViewModel] (P3-08 second + third
 * slice — picker state-machine + method-specific input state).
 *
 * Acceptance focus (slice 2):
 *  - `start(subtotal, isOnline)` snapshots the cart subtotal +
 *    the catalogue projection at call time, and pivots the
 *    picker lifecycle from Idle → Picking.
 *  - `selectMethod` replaces selection in place, no-ops when
 *    the picker is closed, no-ops when the method is filtered
 *    out of [CheckoutUiState.availableMethods].
 *  - `clearSelection` returns to no-pick without leaving the
 *    picker.
 *  - `confirmSelection` advances to Picked iff
 *    [CheckoutUiState.isReadyToConfirmMethod].
 *  - `reopenPicker` restores Picking from Picked without
 *    losing the previous selection (kasir hits "back").
 *  - `cancel` resets to fresh Idle.
 *  - The catalogue snapshot is *stable* across the picker —
 *    a network state change after `start` does NOT mutate
 *    [CheckoutUiState.availableMethods].
 *  - The `requiresOnline` filter from [DefaultPaymentMethodCatalog]
 *    flows through `start(isOnline=false)`.
 *
 * Acceptance focus (slice 3):
 *  - `confirmSelection` seeds [CheckoutUiState.inputState] with
 *    the right per-method default for cash / EDC / QRIS Dynamic.
 *  - Methods that don't need a per-method input
 *    (QRIS Statis / bank transfer / credit / deposit / voucher /
 *    loyalty / other) advance to Picked with
 *    [CheckoutUiState.inputState] left as `null` and
 *    [CheckoutUiState.isReadyForCommit] = `true`.
 *  - `setCashTendered`, `setEdcApprovalRef`, `setEdcLast4`,
 *    `setQrisStatus` mutators update only the matching field
 *    of the matching input shape, no-op otherwise.
 *  - [CheckoutUiState.isReadyForCommit] gates on the
 *    method-specific input state validating against the
 *    snapshotted cart subtotal.
 *  - `reopenPicker` clears the in-flight input state — the
 *    kasir wants to change method, half-typed amounts shouldn't
 *    survive the pivot.
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

    // -------------------------------------------------------------------
    // Slice 3 — method-specific input state.
    // -------------------------------------------------------------------

    @Test
    fun `confirmSelection seeds CashInput for CASH`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Picked, state.pickerStatus)
        assertEquals(CheckoutInputState.CashInput(tenderedIdr = 0L), state.inputState)
        // 0 tendered < 30k subtotal → not yet ready to commit.
        assertFalse(state.isReadyForCommit)
    }

    @Test
    fun `confirmSelection seeds EdcInput for EDC`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        val state = vm.uiState.value
        assertEquals(CheckoutInputState.EdcInput(approvalRef = "", last4 = null), state.inputState)
        // Empty approval ref → not yet ready.
        assertFalse(state.isReadyForCommit)
    }

    @Test
    fun `confirmSelection seeds QrisDynamicInput for QRIS_DYNAMIC`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        val state = vm.uiState.value
        assertEquals(
            CheckoutInputState.QrisDynamicInput(refId = null, status = QrisPollStatus.Generating),
            state.inputState,
        )
        // Generating → not yet Paid → not ready.
        assertFalse(state.isReadyForCommit)
    }

    @Test
    fun `confirmSelection leaves inputState null for single-tap-settle methods`() {
        // QRIS Statis / bank transfer / credit / deposit / voucher / loyalty / other
        // don't need a per-method input — the slice-4 dialog will be a single-tap
        // confirm. inputState stays null + isReadyForCommit goes true on the strength
        // of the picker advancing to Picked alone.
        val singleTapMethods = listOf(
            PaymentMethod.QRIS_STATIC,
            PaymentMethod.BANK_TRANSFER,
            PaymentMethod.CREDIT,
            PaymentMethod.DEPOSIT,
            PaymentMethod.VOUCHER,
            PaymentMethod.LOYALTY_POINT,
            PaymentMethod.OTHER,
        )
        for (method in singleTapMethods) {
            val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
            vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
            vm.selectMethod(method)
            vm.confirmSelection()
            val state = vm.uiState.value
            assertEquals(
                "method=$method should be Picked",
                CheckoutPickerStatus.Picked,
                state.pickerStatus,
            )
            assertNull("method=$method should leave inputState null", state.inputState)
            assertTrue(
                "method=$method should be ready to commit on single-tap settle",
                state.isReadyForCommit,
            )
        }
    }

    @Test
    fun `setCashTendered updates tendered and gates isReadyForCommit`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()

        // Below subtotal → still not ready.
        vm.setCashTendered(20_000L)
        var state = vm.uiState.value
        assertEquals(CheckoutInputState.CashInput(tenderedIdr = 20_000L), state.inputState)
        assertFalse(state.isReadyForCommit)

        // Equal to subtotal → ready, change = 0.
        vm.setCashTendered(30_000L)
        state = vm.uiState.value
        assertTrue(state.isReadyForCommit)
        assertEquals(0L, (state.inputState as CheckoutInputState.CashInput).changeIdr(state.cartSubtotalIdr))

        // Above subtotal → ready, change > 0.
        vm.setCashTendered(50_000L)
        state = vm.uiState.value
        assertTrue(state.isReadyForCommit)
        assertEquals(20_000L, (state.inputState as CheckoutInputState.CashInput).changeIdr(state.cartSubtotalIdr))
    }

    @Test
    fun `setCashTendered clamps negatives to zero`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(-1_000L)
        assertEquals(0L, (vm.uiState.value.inputState as CheckoutInputState.CashInput).tenderedIdr)
    }

    @Test
    fun `setCashTendered is no-op when not in CashInput state`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        // EDC seeded → setCashTendered should refuse to mutate the EdcInput.
        vm.setCashTendered(50_000L)
        assertEquals(
            CheckoutInputState.EdcInput(approvalRef = "", last4 = null),
            vm.uiState.value.inputState,
        )
    }

    @Test
    fun `setCashTendered is no-op while picker is still open`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Did NOT confirmSelection → still Picking, inputState null.
        vm.setCashTendered(40_000L)
        assertNull(vm.uiState.value.inputState)
    }

    @Test
    fun `setEdcApprovalRef updates approvalRef and gates isReadyForCommit`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        assertFalse(vm.uiState.value.isReadyForCommit)

        vm.setEdcApprovalRef("APR-001")
        val state = vm.uiState.value
        assertEquals("APR-001", (state.inputState as CheckoutInputState.EdcInput).approvalRef)
        assertTrue(state.isReadyForCommit)
    }

    @Test
    fun `setEdcApprovalRef does not trim whitespace at write time`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        vm.setEdcApprovalRef("  APR-001\n")
        val edc = vm.uiState.value.inputState as CheckoutInputState.EdcInput
        // Stored verbatim — the kasir's keystrokes aren't munged.
        assertEquals("  APR-001\n", edc.approvalRef)
        // But the *validation* trims — non-empty after trim → ready.
        assertTrue(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `setEdcApprovalRef whitespace-only is not valid`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        vm.setEdcApprovalRef("   ")
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `setEdcLast4 updates last4 independently of approvalRef`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        vm.setEdcApprovalRef("APR-001")
        vm.setEdcLast4("1234")
        val edc = vm.uiState.value.inputState as CheckoutInputState.EdcInput
        assertEquals("APR-001", edc.approvalRef)
        assertEquals("1234", edc.last4)

        // Pass null to clear it.
        vm.setEdcLast4(null)
        assertNull((vm.uiState.value.inputState as CheckoutInputState.EdcInput).last4)
    }

    @Test
    fun `setQrisStatus advances through poll lifecycle`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()

        // Generating → Awaiting (gateway returned a refId).
        vm.setQrisStatus(refId = "QR-9001", status = QrisPollStatus.Awaiting)
        var qris = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertEquals("QR-9001", qris.refId)
        assertEquals(QrisPollStatus.Awaiting, qris.status)
        assertFalse(vm.uiState.value.isReadyForCommit)

        // Awaiting → Paid.
        vm.setQrisStatus(refId = "QR-9001", status = QrisPollStatus.Paid)
        qris = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertEquals(QrisPollStatus.Paid, qris.status)
        assertTrue(vm.uiState.value.isReadyForCommit)

        // Awaiting → Expired (alternate timeline).
        vm.setQrisStatus(refId = "QR-9001", status = QrisPollStatus.Expired)
        qris = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertEquals(QrisPollStatus.Expired, qris.status)
        // Expired → not ready any more.
        assertFalse(vm.uiState.value.isReadyForCommit)

        // Failed carries a message.
        vm.setQrisStatus(refId = null, status = QrisPollStatus.Failed("gateway timeout"))
        qris = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertNull(qris.refId)
        assertEquals(QrisPollStatus.Failed("gateway timeout"), qris.status)
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `setQrisStatus is no-op when input shape is not QrisDynamic`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setQrisStatus(refId = "X", status = QrisPollStatus.Paid)
        // CashInput stays untouched.
        assertEquals(
            CheckoutInputState.CashInput(tenderedIdr = 0L),
            vm.uiState.value.inputState,
        )
    }

    @Test
    fun `reopenPicker clears in-flight inputState`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(50_000L)
        // Kasir hits "back".
        vm.reopenPicker()
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Picking, state.pickerStatus)
        assertNull(state.inputState)
        // Selection itself is preserved (so the kasir sees their last pick highlighted).
        assertEquals(PaymentMethod.CASH, state.selectedMethod)
    }

    @Test
    fun `re-confirming after reopenPicker re-seeds fresh inputState`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(50_000L)
        vm.reopenPicker()
        // Kasir confirms the same method again — they should see a fresh dialog.
        vm.confirmSelection()
        assertEquals(
            CheckoutInputState.CashInput(tenderedIdr = 0L),
            vm.uiState.value.inputState,
        )
    }

    @Test
    fun `cancel clears inputState`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(50_000L)
        vm.cancel()
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Idle, state.pickerStatus)
        assertNull(state.inputState)
    }

    @Test
    fun `isReadyForCommit is false while picker is still open`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Picker is still Picking — even with a selection, commit gate stays false.
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `isReadyToCommit alias still tracks the picker step`() {
        // Back-compat: slice-2 readers can still reference the old name.
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Same predicate as isReadyToConfirmMethod.
        assertEquals(
            vm.uiState.value.isReadyToConfirmMethod,
            vm.uiState.value.isReadyToCommit,
        )
        assertTrue(vm.uiState.value.isReadyToCommit)
    }
}
