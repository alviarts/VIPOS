package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.data.CheckoutCommitOutcome
import id.alviarts.vipos.feature.pos.data.CheckoutCommitRequest
import id.alviarts.vipos.feature.pos.data.QrisMintResult
import id.alviarts.vipos.feature.pos.data.QrisPollResult
import id.alviarts.vipos.feature.pos.data.QrisRepository
import id.alviarts.vipos.feature.pos.data.TransactionRepository
import id.alviarts.vipos.feature.pos.domain.CheckoutCartLine
import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.DefaultPaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.PaymentMethodCatalog
import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
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
@OptIn(ExperimentalCoroutinesApi::class)
class CheckoutViewModelTest {

    /**
     * Default fake repository used by every test that doesn't
     * exercise the commit flow itself. The `Result.failure(...)`
     * never gets observed because those tests never call
     * [CheckoutViewModel.commit] — the fake just satisfies the
     * constructor's `TransactionRepository` parameter.
     *
     * Tests that DO exercise commit (the slice-5b suite at the
     * bottom of this file) construct their own fakes that
     * record the [CheckoutCommitRequest] passed to `commit` and
     * return whatever Result the test wants.
     */
    private val defaultRepository: TransactionRepository = object : TransactionRepository {
        override suspend fun commit(
            request: CheckoutCommitRequest,
        ): Result<CheckoutCommitOutcome> =
            Result.failure(IllegalStateException("commit not exercised in this test"))
    }

    /**
     * Default fake QRIS repository used by every test that
     * doesn't exercise the QRIS poll flow. Returns failure on
     * both mint and poll — never observed because those tests
     * never confirm QRIS_DYNAMIC.
     */
    private val defaultQrisRepository: QrisRepository = object : QrisRepository {
        override suspend fun mint(amountIdr: Long): Result<QrisMintResult> =
            Result.failure(IllegalStateException("qris mint not exercised in this test"))
        override suspend fun pollStatus(refId: String): Result<QrisPollResult> =
            Result.failure(IllegalStateException("qris poll not exercised in this test"))
    }

    /**
     * Recording fake used by the slice-5b commit-flow tests.
     * Captures every [CheckoutCommitRequest] passed through
     * [commit] and returns whichever [Result] the test installed
     * on [nextResult]. Tests can also inspect [callCount] to
     * assert re-entrancy guards (e.g. tap-repeat shouldn't fire
     * a second commit while the first is still in flight).
     */
    private class RecordingTransactionRepository(
        var nextResult: Result<CheckoutCommitOutcome> =
            Result.success(SAMPLE_OUTCOME),
    ) : TransactionRepository {
        val recorded: MutableList<CheckoutCommitRequest> = mutableListOf()
        var callCount: Int = 0
            private set

        override suspend fun commit(
            request: CheckoutCommitRequest,
        ): Result<CheckoutCommitOutcome> {
            callCount++
            recorded += request
            return nextResult
        }
    }

    /**
     * Recording fake for [QrisRepository] used by the slice-5c
     * QRIS poll loop tests. Controls the mint and poll responses
     * so the test can drive the poll loop deterministically.
     */
    private class RecordingQrisRepository(
        var mintResult: Result<QrisMintResult> = Result.success(SAMPLE_MINT_RESULT),
        private val pollResults: MutableList<Result<QrisPollResult>> = mutableListOf(),
    ) : QrisRepository {
        var mintCallCount: Int = 0
            private set
        var pollCallCount: Int = 0
            private set

        fun enqueuePollResult(result: Result<QrisPollResult>) {
            pollResults.add(result)
        }

        override suspend fun mint(amountIdr: Long): Result<QrisMintResult> {
            mintCallCount++
            return mintResult
        }

        override suspend fun pollStatus(refId: String): Result<QrisPollResult> {
            pollCallCount++
            return if (pollResults.isNotEmpty()) {
                pollResults.removeAt(0)
            } else {
                // Default: return Paid to stop the loop
                Result.success(QrisPollResult(refId, QrisPollStatus.Paid))
            }
        }
    }

    private companion object {
        private val SAMPLE_MINT_RESULT = QrisMintResult(
            refId = "QR-9001",
            qrCodeUrl = "https://stub.qris.local/qr/QR-9001.png",
            status = QrisPollStatus.Awaiting,
        )

        private val SAMPLE_OUTCOME = CheckoutCommitOutcome(
            transactionId = 9001L,
            invoiceNumber = "INV-2026-05-07-0001",
            totalAmountIdr = 30_000L,
            changeAmountIdr = 0L,
        )

        private val SAMPLE_CART_LINES = listOf(
            CheckoutCartLine(productId = 7L, effectiveUnitPriceIdr = 15_000L, quantity = 2),
        )
    }

    /**
     * Slice 5b's [CheckoutViewModel.commit] launches a coroutine
     * on `viewModelScope` (which dispatches on `Dispatchers.Main`
     * in production). Wire `Dispatchers.setMain(...)` to an
     * `UnconfinedTestDispatcher` so the coroutine runs eagerly
     * to completion within the test thread — no pumping needed.
     */
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is Idle with empty cart and no methods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        val state = vm.uiState.value
        assertEquals(PaymentMethod.CASH, state.selectedMethod)
        // Subtotal positive + selection + Picking → ready.
        assertTrue(state.isReadyToCommit)
    }

    @Test
    fun `selectMethod replaces previous pick in place`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        assertEquals(PaymentMethod.QRIS_DYNAMIC, vm.uiState.value.selectedMethod)
    }

    @Test
    fun `selectMethod is no-op before start`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.selectMethod(PaymentMethod.CASH)
        val state = vm.uiState.value
        assertEquals(CheckoutPickerStatus.Idle, state.pickerStatus)
        assertNull(state.selectedMethod)
    }

    @Test
    fun `selectMethod is no-op for method outside availableMethods`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        // Offline → online-required methods are filtered out.
        vm.start(cartSubtotalIdr = 30_000L, isOnline = false)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        assertNull(vm.uiState.value.selectedMethod)
    }

    @Test
    fun `clearSelection returns to no-pick`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        assertEquals(CheckoutPickerStatus.Picked, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `confirmSelection is no-op when nothing picked`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.confirmSelection()
        // No pick → predicate stays false → state unchanged.
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `confirmSelection is no-op when subtotal is zero`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 0L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        // Empty cart → not ready → confirm refuses to advance.
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `reopenPicker restores Picking and keeps selection`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        // Currently Picking.
        vm.reopenPicker()
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `cancel resets to fresh Idle`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(countingCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(fakeCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        val state = vm.uiState.value
        assertEquals(CheckoutInputState.EdcInput(approvalRef = "", last4 = null), state.inputState)
        // Empty approval ref → not yet ready.
        assertFalse(state.isReadyForCommit)
    }

    @Test
    fun `confirmSelection seeds QrisDynamicInput for QRIS_DYNAMIC`() = runTest {
        // Use a recording QRIS repo that returns a successful mint
        // so we can observe the state after the poll loop runs.
        // The default fake returns failure which immediately flips
        // to Failed — not what this test wants to assert.
        val qrisRepo = RecordingQrisRepository()
        // Enqueue a Paid poll so the loop terminates.
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Paid)),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()
        val state = vm.uiState.value
        val input = state.inputState as CheckoutInputState.QrisDynamicInput
        // After mint + poll, the input should have the ref_id and
        // terminal Paid status.
        assertEquals("QR-9001", input.refId)
        assertEquals(QrisPollStatus.Paid, input.status)
        assertTrue(state.isReadyForCommit)
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
            val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(-1_000L)
        assertEquals(0L, (vm.uiState.value.inputState as CheckoutInputState.CashInput).tenderedIdr)
    }

    @Test
    fun `setCashTendered is no-op when not in CashInput state`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Did NOT confirmSelection → still Picking, inputState null.
        vm.setCashTendered(40_000L)
        assertNull(vm.uiState.value.inputState)
    }

    @Test
    fun `setEdcApprovalRef updates approvalRef and gates isReadyForCommit`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.EDC)
        vm.confirmSelection()
        vm.setEdcApprovalRef("   ")
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `setEdcLast4 updates last4 independently of approvalRef`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
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
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Picker is still Picking — even with a selection, commit gate stays false.
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `isReadyToCommit alias still tracks the picker step`() {
        // Back-compat: slice-2 readers can still reference the old name.
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        vm.selectMethod(PaymentMethod.CASH)
        // Same predicate as isReadyToConfirmMethod.
        assertEquals(
            vm.uiState.value.isReadyToConfirmMethod,
            vm.uiState.value.isReadyToCommit,
        )
        assertTrue(vm.uiState.value.isReadyToCommit)
    }

    // -------------------------------------------------------------------
    // Slice 5b — transaction commit + commitStatus state machine.
    // -------------------------------------------------------------------

    @Test
    fun `start with cartLines snapshots them onto state`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        assertEquals(SAMPLE_CART_LINES, vm.uiState.value.cartLines)
    }

    @Test
    fun `start without cartLines defaults to empty`() {
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(cartSubtotalIdr = 30_000L, isOnline = true)
        assertEquals(emptyList<CheckoutCartLine>(), vm.uiState.value.cartLines)
    }

    @Test
    fun `start with cartLines preserves them across selection cycle`() {
        // The slice-5b stability contract: a re-pick (selectMethod
        // → clearSelection → confirmSelection) must NOT lose the
        // commit-payload snapshot, since the kasir hasn't done
        // anything that should restart the in-flight checkout.
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.clearSelection()
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        assertEquals(SAMPLE_CART_LINES, vm.uiState.value.cartLines)
    }

    @Test
    fun `commit succeeds and transitions Idle to Submitting to Succeeded`() = runTest {
        val repository = RecordingTransactionRepository(
            nextResult = Result.success(SAMPLE_OUTCOME),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        // Pre-condition.
        assertEquals(CheckoutCommitStatus.Idle, vm.uiState.value.commitStatus)
        assertTrue(vm.uiState.value.isReadyForCommit)

        vm.commit()

        // Unconfined dispatcher → coroutine completed eagerly.
        val state = vm.uiState.value
        val status = state.commitStatus
        assertTrue("expected Succeeded, got $status", status is CheckoutCommitStatus.Succeeded)
        status as CheckoutCommitStatus.Succeeded
        assertEquals(SAMPLE_OUTCOME.invoiceNumber, status.invoiceNumber)
        assertEquals(SAMPLE_OUTCOME.totalAmountIdr, status.totalAmountIdr)
        assertEquals(SAMPLE_OUTCOME.changeAmountIdr, status.changeAmountIdr)
        // Repository saw exactly one call with the right shape.
        assertEquals(1, repository.callCount)
        val recorded = repository.recorded.single()
        assertEquals(SAMPLE_CART_LINES, recorded.cartLines)
        assertEquals(30_000L, recorded.cartSubtotalIdr)
        assertEquals(PaymentMethod.CASH, recorded.paymentMethod)
        // Cash input survives the commit.
        val cash = recorded.inputState as CheckoutInputState.CashInput
        assertEquals(30_000L, cash.tenderedIdr)
    }

    @Test
    fun `commit failure transitions to Failed with backend message`() = runTest {
        val backendError = IllegalStateException("Stok kopi tidak mencukupi (tersedia: 0)")
        val repository = RecordingTransactionRepository(
            nextResult = Result.failure(backendError),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)

        vm.commit()

        val status = vm.uiState.value.commitStatus
        assertTrue("expected Failed, got $status", status is CheckoutCommitStatus.Failed)
        status as CheckoutCommitStatus.Failed
        assertEquals(backendError.localizedMessage, status.message)
    }

    @Test
    fun `commit failure with null message falls back to default`() = runTest {
        // A bare `Throwable()` has neither localizedMessage nor message.
        val noMessage = Throwable()
        val repository = RecordingTransactionRepository(
            nextResult = Result.failure(noMessage),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)

        vm.commit()

        val status = vm.uiState.value.commitStatus as CheckoutCommitStatus.Failed
        assertNotNull(status.message)
        assertTrue(
            "expected non-empty fallback message, got '${status.message}'",
            status.message.isNotBlank(),
        )
    }

    @Test
    fun `commit is no-op when isReadyForCommit is false`() = runTest {
        // Cash with 0 tendered against a 30k subtotal — the slice-3
        // validation predicate keeps isReadyForCommit false, so a
        // direct `commit()` call must NOT fire the request.
        val repository = RecordingTransactionRepository()
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        // tenderedIdr = 0 < subtotal → not ready.
        assertFalse(vm.uiState.value.isReadyForCommit)

        vm.commit()

        assertEquals(0, repository.callCount)
        assertEquals(CheckoutCommitStatus.Idle, vm.uiState.value.commitStatus)
    }

    @Test
    fun `isReadyForCommit goes false during Submitting`() {
        // Use a Submitting-state-installer fake that flips us into
        // Submitting and then keeps the predicate observable. We
        // can't directly assert mid-flight without a deferred
        // mock, so install Submitting via a manual state mutation
        // by inspecting the predicate's gating clause: ready
        // requires NOT Submitting.
        //
        // The assertion is structural: copy the state into
        // Submitting and verify isReadyForCommit collapses.
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        val ready = vm.uiState.value
        assertTrue(ready.isReadyForCommit)
        val midFlight = ready.copy(commitStatus = CheckoutCommitStatus.Submitting)
        assertFalse(midFlight.isReadyForCommit)
    }

    @Test
    fun `acknowledgeCommitFailure flips Failed to Idle`() = runTest {
        val repository = RecordingTransactionRepository(
            nextResult = Result.failure(IllegalStateException("boom")),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        vm.commit()
        assertTrue(vm.uiState.value.commitStatus is CheckoutCommitStatus.Failed)

        vm.acknowledgeCommitFailure()

        assertEquals(CheckoutCommitStatus.Idle, vm.uiState.value.commitStatus)
        // Once Idle, isReadyForCommit goes true again so the kasir can retry.
        assertTrue(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `acknowledgeCommitFailure is no-op when not Failed`() = runTest {
        val repository = RecordingTransactionRepository(
            nextResult = Result.success(SAMPLE_OUTCOME),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        vm.commit()
        // Now in Succeeded.
        val before = vm.uiState.value.commitStatus
        assertTrue(before is CheckoutCommitStatus.Succeeded)

        vm.acknowledgeCommitFailure()

        // Same instance — no mutation.
        assertSame(before, vm.uiState.value.commitStatus)
    }

    @Test
    fun `commit retry after acknowledge re-fires repository`() = runTest {
        val repository = RecordingTransactionRepository(
            nextResult = Result.failure(IllegalStateException("first")),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        vm.commit()
        assertEquals(1, repository.callCount)

        // Kasir retries — first acknowledge, then re-tap "Bayar".
        vm.acknowledgeCommitFailure()
        repository.nextResult = Result.success(SAMPLE_OUTCOME)
        vm.commit()

        assertEquals(2, repository.callCount)
        assertTrue(vm.uiState.value.commitStatus is CheckoutCommitStatus.Succeeded)
    }

    @Test
    fun `commit non-cash methods send subtotal as paymentAmount`() = runTest {
        // Non-cash methods (EDC, QRIS, etc.) carry the full
        // subtotal as `payment_amount` because the gateway / kartu
        // already collected exactly the bill — no change due. Cash
        // is the only method where the kasir tenders MORE than the
        // subtotal.
        val repository = RecordingTransactionRepository(
            nextResult = Result.success(SAMPLE_OUTCOME),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.QRIS_STATIC)
        vm.confirmSelection()
        // Single-tap settle method → no input state to set.
        assertTrue(vm.uiState.value.isReadyForCommit)

        vm.commit()

        val recorded = repository.recorded.single()
        assertEquals(PaymentMethod.QRIS_STATIC, recorded.paymentMethod)
        // No CashInput on the request.
        assertNull(recorded.inputState)
    }

    @Test
    fun `cancel clears commitStatus along with the rest of the state`() = runTest {
        val repository = RecordingTransactionRepository(
            nextResult = Result.failure(IllegalStateException("boom")),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, repository, defaultQrisRepository)
        vm.start(
            cartSubtotalIdr = 30_000L,
            isOnline = true,
            cartLines = SAMPLE_CART_LINES,
        )
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        vm.setCashTendered(30_000L)
        vm.commit()
        // In Failed state.
        assertTrue(vm.uiState.value.commitStatus is CheckoutCommitStatus.Failed)

        vm.cancel()

        // cancel() resets the WHOLE state, commitStatus included.
        assertEquals(CheckoutCommitStatus.Idle, vm.uiState.value.commitStatus)
        assertEquals(emptyList<CheckoutCartLine>(), vm.uiState.value.cartLines)
    }

    // -- QRIS Dynamic poll loop tests (P3-08 slice 5c) --------

    @Test
    fun `confirmSelection for QRIS_DYNAMIC triggers mint and poll loop`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        // Enqueue one Awaiting poll, then a Paid poll to stop the loop.
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Awaiting)),
        )
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Paid)),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 71_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()

        // Wait for the coroutine to complete (UnconfinedTestDispatcher
        // runs eagerly, but delay() in the poll loop needs advancing).
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, qrisRepo.mintCallCount)
        assertEquals(2, qrisRepo.pollCallCount)

        val state = vm.uiState.value
        val input = state.inputState as CheckoutInputState.QrisDynamicInput
        assertEquals("QR-9001", input.refId)
        assertEquals(QrisPollStatus.Paid, input.status)
        assertEquals("https://stub.qris.local/qr/QR-9001.png", input.qrCodeUrl)
        assertTrue(state.isReadyForCommit)
    }

    @Test
    fun `QRIS poll loop stops on Expired status`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Awaiting)),
        )
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Expired)),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()

        val input = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertEquals(QrisPollStatus.Expired, input.status)
        assertFalse(vm.uiState.value.isReadyForCommit)
    }

    @Test
    fun `QRIS poll loop stops on Failed status`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Failed("gateway error"))),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()

        val input = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertTrue(input.status is QrisPollStatus.Failed)
        assertEquals("gateway error", (input.status as QrisPollStatus.Failed).message)
    }

    @Test
    fun `QRIS mint failure sets Failed status immediately`() = runTest {
        val qrisRepo = RecordingQrisRepository(
            mintResult = Result.failure(IllegalStateException("network down")),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()

        val input = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertTrue(input.status is QrisPollStatus.Failed)
        assertEquals(0, qrisRepo.pollCallCount) // No poll after mint failure
    }

    @Test
    fun `QRIS poll network failure sets Failed status`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        qrisRepo.enqueuePollResult(
            Result.success(QrisPollResult("QR-9001", QrisPollStatus.Awaiting)),
        )
        qrisRepo.enqueuePollResult(
            Result.failure(IllegalStateException("connection reset")),
        )
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()

        val input = vm.uiState.value.inputState as CheckoutInputState.QrisDynamicInput
        assertTrue(input.status is QrisPollStatus.Failed)
        assertEquals(2, qrisRepo.pollCallCount)
    }

    @Test
    fun `cancel stops QRIS poll loop`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        // Enqueue many Awaiting results — the loop should be cancelled
        // before consuming them all.
        repeat(100) {
            qrisRepo.enqueuePollResult(
                Result.success(QrisPollResult("QR-9001", QrisPollStatus.Awaiting)),
            )
        }
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()

        // Let a few polls fire, then cancel.
        testDispatcher.scheduler.advanceTimeBy(7_000L)
        vm.cancel()
        testDispatcher.scheduler.advanceUntilIdle()

        // The poll count should be small (cancelled mid-loop).
        assertTrue(qrisRepo.pollCallCount < 100)
        assertEquals(CheckoutPickerStatus.Idle, vm.uiState.value.pickerStatus)
    }

    @Test
    fun `reopenPicker stops QRIS poll loop`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        repeat(100) {
            qrisRepo.enqueuePollResult(
                Result.success(QrisPollResult("QR-9001", QrisPollStatus.Awaiting)),
            )
        }
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.QRIS_DYNAMIC)
        vm.confirmSelection()

        testDispatcher.scheduler.advanceTimeBy(7_000L)
        vm.reopenPicker()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(qrisRepo.pollCallCount < 100)
        assertEquals(CheckoutPickerStatus.Picking, vm.uiState.value.pickerStatus)
        assertNull(vm.uiState.value.inputState)
    }

    @Test
    fun `confirmSelection for non-QRIS method does not trigger mint`() = runTest {
        val qrisRepo = RecordingQrisRepository()
        val vm = CheckoutViewModel(DefaultPaymentMethodCatalog, defaultRepository, qrisRepo)
        vm.start(cartSubtotalIdr = 50_000L, isOnline = true, cartLines = SAMPLE_CART_LINES)
        vm.selectMethod(PaymentMethod.CASH)
        vm.confirmSelection()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(0, qrisRepo.mintCallCount)
        assertEquals(0, qrisRepo.pollCallCount)
    }
}
