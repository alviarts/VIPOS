package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for the dashboard/KPI endpoints (P4-07).
 */

@Serializable
data class DashboardSummaryDto(
    @SerialName("today_revenue") val todayRevenue: Long = 0,
    @SerialName("today_transactions") val todayTransactions: Int = 0,
    @SerialName("today_avg_basket") val todayAvgBasket: Long = 0,
    @SerialName("mtd_revenue") val mtdRevenue: Long = 0,
    @SerialName("mtd_transactions") val mtdTransactions: Int = 0,
    @SerialName("low_stock_count") val lowStockCount: Int = 0,
    @SerialName("pending_approvals") val pendingApprovals: Int = 0,
)
