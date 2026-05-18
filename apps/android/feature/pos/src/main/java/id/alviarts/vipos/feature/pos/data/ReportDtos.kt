package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for sales reports (P4-06).
 * 
 * Covers:
 * - Sales summary report
 * - Daily/weekly/monthly aggregations
 * - Top products
 * - Payment method breakdown
 */

// -- Sales Summary Report ----------------------------------

@Serializable
data class SalesSummaryReportDto(
    @SerialName("period") val period: ReportPeriodDto,
    @SerialName("kpi") val kpi: SalesKpiDto,
    @SerialName("daily_trend") val dailyTrend: List<DailyTrendDto> = emptyList(),
    @SerialName("top_products") val topProducts: List<TopProductDto> = emptyList(),
    @SerialName("payment_breakdown") val paymentBreakdown: List<PaymentBreakdownDto> = emptyList(),
)

@Serializable
data class ReportPeriodDto(
    @SerialName("from") val from: String,
    @SerialName("to") val to: String,
)

@Serializable
data class SalesKpiDto(
    @SerialName("gross_revenue") val grossRevenue: Double,
    @SerialName("discount") val discount: Double = 0.0,
    @SerialName("tax") val tax: Double = 0.0,
    @SerialName("service_charge") val serviceCharge: Double = 0.0,
    @SerialName("net_revenue") val netRevenue: Double,
    @SerialName("transaction_count") val transactionCount: Int,
    @SerialName("avg_ticket") val avgTicket: Double,
    @SerialName("item_count") val itemCount: Int,
    @SerialName("unique_customers") val uniqueCustomers: Int,
    @SerialName("voided_count") val voidedCount: Int = 0,
    @SerialName("voided_value") val voidedValue: Double = 0.0,
)

@Serializable
data class DailyTrendDto(
    @SerialName("date") val date: String,
    @SerialName("revenue") val revenue: Double,
    @SerialName("transactions") val transactions: Int,
)

@Serializable
data class TopProductDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String,
    @SerialName("qty") val qty: Int,
    @SerialName("revenue") val revenue: Double,
)

// Note: PaymentBreakdownDto is defined in CashierShiftDtos.kt
// We reuse it here for consistency

// -- Sales Detail Report ----------------------------------

@Serializable
data class SalesDetailReportDto(
    @SerialName("period") val period: ReportPeriodDto,
    @SerialName("transactions") val transactions: List<TransactionSummaryDto> = emptyList(),
    @SerialName("total_revenue") val totalRevenue: Double,
    @SerialName("total_count") val totalCount: Int,
)

@Serializable
data class TransactionSummaryDto(
    @SerialName("id") val id: Long,
    @SerialName("invoice_number") val invoiceNumber: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("payment_method") val paymentMethod: String,
    @SerialName("status") val status: String,
    @SerialName("cashier_name") val cashierName: String? = null,
    @SerialName("customer_name") val customerName: String? = null,
)

// -- Sales by Product Report ----------------------------------

@Serializable
data class SalesByProductReportDto(
    @SerialName("period") val period: ReportPeriodDto,
    @SerialName("products") val products: List<ProductSalesDto> = emptyList(),
)

@Serializable
data class ProductSalesDto(
    @SerialName("product_id") val productId: Long,
    @SerialName("product_name") val productName: String,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("qty_sold") val qtySold: Int,
    @SerialName("revenue") val revenue: Double,
    @SerialName("avg_price") val avgPrice: Double,
)

// -- Sales by Payment Method Report ----------------------------------

@Serializable
data class SalesByPaymentMethodReportDto(
    @SerialName("period") val period: ReportPeriodDto,
    @SerialName("payment_methods") val paymentMethods: List<PaymentMethodSalesDto> = emptyList(),
)

@Serializable
data class PaymentMethodSalesDto(
    @SerialName("method") val method: String,
    @SerialName("transaction_count") val transactionCount: Int,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("percentage") val percentage: Double,
)
