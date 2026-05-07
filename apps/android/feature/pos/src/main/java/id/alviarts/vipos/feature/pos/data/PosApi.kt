package id.alviarts.vipos.feature.pos.data

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit interface for the `/api/v1/products` endpoint
 * (P3-06).
 *
 * The endpoint is mounted under `/api/v1/products` by the
 * backend's `apps/backend/src/app.js` router and gates every
 * route through `authenticateToken` middleware. The OkHttp
 * `AuthInterceptor` (in `:core:network`) stamps
 * `Authorization: Bearer <accessToken>` on every request leaving
 * this interface; this file therefore omits an explicit
 * `@Header("Authorization")` argument — keeping it off the
 * method signature is what makes the interceptor responsible
 * for token plumbing across all current and future POS endpoints.
 *
 * The kasir catalogue always asks for the paged response shape
 * (`page=1&per_page=…`) so the return type is predictable; the
 * legacy bare-array response is intentionally not modelled here.
 */
interface PosApi {
    @GET("api/v1/products")
    suspend fun listProducts(
        @Query("page") page: Long = 1,
        @Query("per_page") perPage: Long = 100,
        @Query("active_only") activeOnly: String = "true",
        @Query("is_tampil_di_menu") tampilDiMenu: String? = null,
        @Query("category_id") categoryId: Long? = null,
    ): ProductsPageDto

    /**
     * Fetch the option groups + per-option price modifiers for a
     * product (P3-07 first slice).
     *
     * The backend route in
     * `apps/backend/src/routes/product-variants.js` returns a flat
     * array of variant rows (see [ProductVariantDto]); the kasir UI
     * groups them by `group_name` in [PosRepository.loadVariants].
     * Returns an empty array for products without variants.
     */
    @GET("api/v1/products/{id}/variants")
    suspend fun listVariants(
        @Path("id") productId: Long,
    ): List<ProductVariantDto>
}
