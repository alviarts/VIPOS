package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the cashier shift endpoints (P3-14).
 *
 * Mirrors the backend handler in
 * `apps/backend/src/routes/cashier-shift.js`.
 */

// -- Open shift -----------------------------------------------

@Serializable
data class CashierShiftOpenRequestDto(
    @SerialName("opening_cash") val openingCash: Long,
    @SerialName("notes") val notes: String? = null,
)

// -- Close shift ----------------------------------------------

@Serializable
data class CashierShiftCloseRequestDto(
    @SerialName("closing_cash_counted") val closingCashCounted: Long,
    @SerialName("variance_reason") val varianceReason: String? = null,
    @SerialName("notes") val notes: String? = null,
)

// -- Cash movement (drop / pickup) ----------------------------

@Serializable
data class CashMovementRequestDto(
    @SerialName("amount") val amount: Long,
    @SerialName("reason") val reason: String? = null,
)

// -- Response shapes ------------------------------------------

@Serializable
data class CashierShiftDto(
    @SerialName("id") val id: Int,
    @SerialName("user_id") val userId: Int,
    @SerialName("opening_cash") val openingCash: Long,
    @SerialName("closing_cash_counted") val closingCashCounted: Long? = null,
    @SerialName("closing_cash_expected") val closingCashExpected: Long? = null,
    @SerialName("variance") val variance: Long? = null,
    @SerialName("variance_reason") val varianceReason: String? = null,
    @SerialName("status") val status: String,
    @SerialName("opened_at") val openedAt: String,
    @SerialName("closed_at") val closedAt: String? = null,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class CashierShiftResponseDto(
    @SerialName("shift") val shift: CashierShiftDto?,
)

@Serializable
data class CashierShiftCloseResponseDto(
    @SerialName("shift") val shift: CashierShiftDto,
    @SerialName("variance_exceeds_threshold") val varianceExceedsThreshold: Boolean,
)

@Serializable
data class PaymentBreakdownDto(
    @SerialName("method") val method: String,
    @SerialName("count") val count: Int,
    @SerialName("total") val total: Long,
)

@Serializable
data class CashierShiftSummaryDto(
    @SerialName("shift_id") val shiftId: Int,
    @SerialName("user_id") val userId: Int,
    @SerialName("status") val status: String,
    @SerialName("opened_at") val openedAt: String,
    @SerialName("opening_cash") val openingCash: Long,
    @SerialName("cash_sales") val cashSales: Long,
    @SerialName("cash_drops") val cashDrops: Long,
    @SerialName("cash_pickups") val cashPickups: Long,
    @SerialName("expected_cash") val expectedCash: Long,
    @SerialName("total_revenue") val totalRevenue: Long,
    @SerialName("total_transactions") val totalTransactions: Int,
    @SerialName("payment_breakdown") val paymentBreakdown: List<PaymentBreakdownDto>,
    @SerialName("variance_warning_threshold") val varianceWarningThreshold: Long,
)
