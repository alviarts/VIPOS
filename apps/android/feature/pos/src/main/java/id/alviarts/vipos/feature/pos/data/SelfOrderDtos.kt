package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for Self Order kiosk (P5-05 through P5-08) and
 * Customer Display (P5-09 through P5-11).
 */

// -- Self Order menu (P5-06) ----------------------------------

@Serializable
data class SelfOrderMenuItemDto(
    @SerialName("id") val id: Long,
    @SerialName("name") val name: String,
    @SerialName("price") val price: Long,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("description") val description: String? = null,
    @SerialName("is_available") val isAvailable: Boolean = true,
)

@Serializable
data class SelfOrderMenuResponseDto(
    @SerialName("data") val data: List<SelfOrderMenuItemDto>,
    @SerialName("categories") val categories: List<String> = emptyList(),
)

// -- Customer Display (P5-10) ---------------------------------

@Serializable
data class CustomerDisplayStateDto(
    @SerialName("mode") val mode: String = "idle", // "idle", "cart", "payment", "receipt"
    @SerialName("cart_items") val cartItems: List<CustomerDisplayCartItemDto> = emptyList(),
    @SerialName("subtotal") val subtotal: Long = 0,
    @SerialName("discount") val discount: Long = 0,
    @SerialName("total") val total: Long = 0,
    @SerialName("promo_banner_url") val promoBannerUrl: String? = null,
)

@Serializable
data class CustomerDisplayCartItemDto(
    @SerialName("name") val name: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("price") val price: Long,
)
