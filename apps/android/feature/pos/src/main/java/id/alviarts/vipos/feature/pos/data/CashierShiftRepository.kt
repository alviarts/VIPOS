package id.alviarts.vipos.feature.pos.data

import javax.inject.Inject

/**
 * Repository façade for cashier shift management (P3-14).
 *
 * Wraps the Retrofit [PosApi] calls and maps wire DTOs to
 * domain-friendly result types. The ViewModel calls these
 * methods and reacts to the [Result] — no try/catch in the VM.
 */
interface CashierShiftRepository {

    /** Get the currently open shift, or null if none. */
    suspend fun getActiveShift(): Result<CashierShiftDto?>

    /** Open a new shift with the given opening cash. */
    suspend fun openShift(openingCash: Long, notes: String? = null): Result<CashierShiftDto>

    /** Get shift summary for the close screen. */
    suspend fun getShiftSummary(shiftId: Int): Result<CashierShiftSummaryDto>

    /** Close a shift with cash reconciliation. */
    suspend fun closeShift(
        shiftId: Int,
        closingCashCounted: Long,
        varianceReason: String? = null,
        notes: String? = null,
    ): Result<CashierShiftCloseResult>
}

/**
 * Domain result from [CashierShiftRepository.closeShift].
 */
data class CashierShiftCloseResult(
    val shift: CashierShiftDto,
    val varianceExceedsThreshold: Boolean,
)

/**
 * Production binding for [CashierShiftRepository].
 */
class DefaultCashierShiftRepository @Inject constructor(
    private val api: PosApi,
) : CashierShiftRepository {

    override suspend fun getActiveShift(): Result<CashierShiftDto?> = runCatching {
        api.getActiveShift().shift
    }

    override suspend fun openShift(
        openingCash: Long,
        notes: String?,
    ): Result<CashierShiftDto> = runCatching {
        val response = api.openShift(
            CashierShiftOpenRequestDto(openingCash = openingCash, notes = notes),
        )
        response.shift ?: throw IllegalStateException("Server returned null shift on open")
    }

    override suspend fun getShiftSummary(shiftId: Int): Result<CashierShiftSummaryDto> = runCatching {
        api.getShiftSummary(shiftId)
    }

    override suspend fun closeShift(
        shiftId: Int,
        closingCashCounted: Long,
        varianceReason: String?,
        notes: String?,
    ): Result<CashierShiftCloseResult> = runCatching {
        val response = api.closeShift(
            shiftId,
            CashierShiftCloseRequestDto(
                closingCashCounted = closingCashCounted,
                varianceReason = varianceReason,
                notes = notes,
            ),
        )
        CashierShiftCloseResult(
            shift = response.shift,
            varianceExceedsThreshold = response.varianceExceedsThreshold,
        )
    }
}
