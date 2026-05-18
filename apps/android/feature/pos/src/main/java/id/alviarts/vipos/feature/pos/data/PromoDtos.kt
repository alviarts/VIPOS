package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for promo + coupon endpoints (P3-15).
 */

@Serializable
data class CouponValidateRequestDto(
    @SerialName("code") val code: String,
    @SerialName("cart_total") val cartTotal: Long? = null,
)

@Serializable
data class CouponValidateResponseDto(
    @SerialName("valid") val valid: Boolean,
    @SerialName("error") val error: String? = null,
    @SerialName("coupon") val coupon: CouponInfoDto? = null,
    @SerialName("promo") val promo: PromoInfoDto? = null,
    @SerialName("discount_amount") val discountAmount: Long? = null,
)

@Serializable
data class CouponInfoDto(
    @SerialName("id") val id: Long,
    @SerialName("code") val code: String,
    @SerialName("promo_id") val promoId: Long,
)

@Serializable
data class PromoInfoDto(
    @SerialName("name") val name: String,
    @SerialName("type") val type: String,
    @SerialName("discount_value") val discountValue: Double,
    @SerialName("max_discount") val maxDiscount: Double? = null,
    @SerialName("discount_target") val discountTarget: String? = null,
)

@Serializable
data class ActivePromoDto(
    @SerialName("id") val id: Long,
    @SerialName("name") val name: String,
    @SerialName("description") val description: String? = null,
    @SerialName("promo_type") val promoType: String,
    @SerialName("discount_value") val discountValue: Double,
    @SerialName("max_discount") val maxDiscount: Double? = null,
    @SerialName("min_purchase") val minPurchase: Double? = null,
    @SerialName("discount_target") val discountTarget: String? = null,
    @SerialName("requires_coupon") val requiresCoupon: Int = 0,
)

@Serializable
data class ActivePromosResponseDto(
    @SerialName("promos") val promos: List<ActivePromoDto>,
)
