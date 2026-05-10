package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for customer loyalty (P4-09).
 * 
 * Covers:
 * - Customer points balance
 * - Loyalty transactions (earn/redeem/adjust)
 * - Loyalty rules (earn/redemption)
 */

@Serializable
data class CustomerLoyaltyDto(
    @SerialName("customer_id") val customerId: Long,
    @SerialName("customer_name") val customerName: String,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("points_balance") val pointsBalance: Int,
    @SerialName("total_earned") val totalEarned: Int,
    @SerialName("total_redeemed") val totalRedeemed: Int,
    @SerialName("total_adjusted") val totalAdjusted: Int,
    @SerialName("member_since") val memberSince: String? = null,
)

@Serializable
data class LoyaltyTransactionDto(
    @SerialName("id") val id: Long,
    @SerialName("customer_id") val customerId: Long,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("type") val type: String, // earn, redeem, adjust, expire
    @SerialName("points") val points: Int,
    @SerialName("balance_after") val balanceAfter: Int,
    @SerialName("transaction_id") val transactionId: Long? = null,
    @SerialName("rule_id") val ruleId: Long? = null,
    @SerialName("rule_name") val ruleName: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class LoyaltyRuleDto(
    @SerialName("id") val id: Long,
    @SerialName("name") val name: String,
    @SerialName("rule_type") val ruleType: String, // earn_per_total, earn_per_product, redemption
    @SerialName("earn_rate") val earnRate: Double? = null,
    @SerialName("bonus_points") val bonusPoints: Int? = null,
    @SerialName("target_product_ids") val targetProductIds: List<Long>? = null,
    @SerialName("redemption_rate") val redemptionRate: Double? = null,
    @SerialName("min_redeem_per_transaction") val minRedeemPerTransaction: Int? = null,
    @SerialName("max_redeem_per_transaction") val maxRedeemPerTransaction: Int? = null,
    @SerialName("points_expire_after_months") val pointsExpireAfterMonths: Int? = null,
    @SerialName("valid_from") val validFrom: String? = null,
    @SerialName("valid_until") val validUntil: String? = null,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class LoyaltyAdjustRequestDto(
    @SerialName("customer_id") val customerId: Long,
    @SerialName("points") val points: Int,
    @SerialName("notes") val notes: String? = null,
)

@Serializable
data class LoyaltyRedeemRequestDto(
    @SerialName("customer_id") val customerId: Long,
    @SerialName("points") val points: Int,
    @SerialName("transaction_id") val transactionId: Long? = null,
)
