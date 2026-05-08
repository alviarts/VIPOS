package id.alviarts.vipos.feature.pos.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
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

    /**
     * Commit a kasir transaction (P3-08 slice 5b).
     *
     * Backend handler at `apps/backend/src/routes/transactions.js`
     * inserts a `transactions` row + per-item `transaction_items`
     * rows + decrements `products.stock` per line atomically.
     * Returns 201 with the canonical row including the
     * server-generated invoice number + computed change amount.
     *
     * Failure modes (all 4xx / 5xx surface as Retrofit
     * `HttpException` upstream):
     *  - 400 `{error:"Minimal satu produk harus dipilih"}` — empty `items`.
     *  - 400 `{error:"Metode pembayaran tidak dikenali", allowed:[…]}` —
     *    `payment_method` outside allow-list.
     *  - 400 `{error:"Pembayaran kurang dari total belanja"}` —
     *    `payment_amount < total`.
     *  - 500 `{error:"Stok ${name} tidak mencukupi (tersedia: N)"}` —
     *    insufficient stock for any line.
     *  - 500 `{error:"Produk dengan ID N tidak ditemukan"}` — unknown
     *    product id.
     */
    @POST("api/v1/transactions")
    suspend fun createTransaction(
        @Body body: TransactionRequestDto,
    ): TransactionResponseDto

    /**
     * Mint a QRIS Dynamic invocation (P3-08 slice 5c).
     *
     * Backend handler at
     * `apps/backend/src/routes/payment-qris.js` creates an
     * in-memory invocation record keyed by a `QR-<uuid>` ref_id,
     * returns a stub QR code URL + polling URL, and sets a
     * 5-minute expiry window. The Android side renders the QR
     * from [QrisMintResponseDto.qrCodeUrl] and starts polling
     * [pollQrisStatus] every 3 seconds.
     *
     * Returns 201 with the mint response on success.
     * Returns 400 if `amount` is missing or non-positive.
     */
    @POST("api/v1/payment/qris/dynamic")
    suspend fun mintQrisDynamic(
        @Body body: QrisMintRequestDto,
    ): QrisMintResponseDto

    /**
     * Poll the status of a QRIS Dynamic invocation (P3-08
     * slice 5c).
     *
     * The backend lazily transitions `AWAITING → EXPIRED` when
     * `now > expires_at` on each poll, so the Android side
     * doesn't need its own expiry timer — just poll until the
     * status is terminal (`PAID` or `EXPIRED`).
     *
     * Returns 200 with the current status.
     * Returns 404 if [refId] is unknown or belongs to a
     * different tenant.
     */
    @GET("api/v1/payment/qris/{ref_id}/status")
    suspend fun pollQrisStatus(
        @Path("ref_id") refId: String,
    ): QrisStatusResponseDto

    // -- Customer endpoints (P3-16) -----------------------------

    /**
     * Search customers by name/phone. The backend matches against
     * name, kode, phone, email, and npwp fields.
     */
    @GET("api/v1/customers")
    suspend fun searchCustomers(
        @Query("search") search: String? = null,
        @Query("page") page: Long = 1,
        @Query("per_page") perPage: Long = 20,
    ): CustomerListResponseDto

    /**
     * Quick-add a new customer with minimal fields (name + phone).
     */
    @POST("api/v1/customers")
    suspend fun createCustomer(
        @Body body: CustomerCreateRequestDto,
    ): CustomerDto

    /**
     * Get a single customer by ID (for refreshing point balance).
     */
    @GET("api/v1/customers/{id}")
    suspend fun getCustomer(
        @Path("id") customerId: Long,
    ): CustomerDto

    // -- Inventory (P4-03 + P4-04) -------------------------------

    /**
     * List inventory movements for the current outlet.
     */
    @GET("api/v1/inventory")
    suspend fun listInventoryMovements(
        @Query("page") page: Long = 1,
        @Query("per_page") perPage: Long = 20,
        @Query("type") type: String? = null,
    ): InventoryMovementListDto

    /**
     * Request an inventory mutation (cashier-initiated).
     */
    @POST("api/v1/inventory")
    suspend fun createInventoryMutation(
        @Body body: InventoryMutationRequestDto,
    ): InventoryMovementDto

    // -- Transaction history (P4-05) ----------------------------

    /**
     * List transactions with optional filters.
     */
    @GET("api/v1/transactions")
    suspend fun listTransactions(
        @Query("page") page: Long = 1,
        @Query("per_page") perPage: Long = 20,
        @Query("status") status: String? = null,
        @Query("payment_method") paymentMethod: String? = null,
    ): TransactionListResponseDto

    // -- Dashboard / KPI (P4-07) --------------------------------

    /**
     * Get today's dashboard summary (revenue, transactions, etc.)
     */
    @GET("api/v1/dashboard/summary")
    suspend fun getDashboardSummary(): DashboardSummaryDto

    // -- Promo + coupon endpoints (P3-15) ---------------------

    /**
     * Validate a coupon code against the current cart total.
     */
    @POST("api/v1/coupon/validate")
    suspend fun validateCoupon(
        @Body body: CouponValidateRequestDto,
    ): CouponValidateResponseDto

    /**
     * Get all currently active promos (for auto-apply logic).
     * Only returns promos that don't require a coupon code.
     */
    @GET("api/v1/coupon/active-promos")
    suspend fun getActivePromos(): ActivePromosResponseDto

    // -- Cashier shift endpoints (P3-14) ----------------------

    /**
     * Get the current open shift for the authenticated user.
     * Returns `{ shift: null }` if no shift is open.
     */
    @GET("api/v1/cashier-shift/active")
    suspend fun getActiveShift(): CashierShiftResponseDto

    /**
     * Open a new cashier shift with the given opening cash.
     * Returns 409 if a shift is already open.
     */
    @POST("api/v1/cashier-shift/open")
    suspend fun openShift(
        @Body body: CashierShiftOpenRequestDto,
    ): CashierShiftResponseDto

    /**
     * Get shift summary for the close screen (transaction
     * breakdown, expected cash, etc.).
     */
    @GET("api/v1/cashier-shift/{id}/summary")
    suspend fun getShiftSummary(
        @Path("id") shiftId: Int,
    ): CashierShiftSummaryDto

    /**
     * Close an open shift with cash reconciliation.
     */
    @POST("api/v1/cashier-shift/{id}/close")
    suspend fun closeShift(
        @Path("id") shiftId: Int,
        @Body body: CashierShiftCloseRequestDto,
    ): CashierShiftCloseResponseDto
}
