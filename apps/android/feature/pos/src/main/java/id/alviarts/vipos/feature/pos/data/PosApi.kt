package id.alviarts.vipos.feature.pos.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
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
        @Query("search") search: String? = null,
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

    // -- Online orders (P4-01) -----------------------------------

    /**
     * List pending/active online orders for the kasir queue.
     */
    @GET("api/v1/online-order")
    suspend fun listOnlineOrders(
        @Query("status") status: String? = null,
        @Query("channel") channel: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("limit") limit: Int = 100,
        @Query("offset") offset: Int = 0,
    ): OnlineOrderListResponseDto

    /**
     * Get single online order detail with items.
     */
    @GET("api/v1/online-order/{id}")
    suspend fun getOnlineOrderDetail(
        @Path("id") orderId: Long,
    ): OnlineOrderDto

    /**
     * Accept an online order (NEW → PREPARING).
     */
    @POST("api/v1/online-order/{id}/accept")
    suspend fun acceptOnlineOrder(
        @Path("id") orderId: Long,
    ): OnlineOrderDto

    /**
     * Reject an online order (NEW/PREPARING → REJECTED).
     */
    @POST("api/v1/online-order/{id}/reject")
    suspend fun rejectOnlineOrder(
        @Path("id") orderId: Long,
        @Body body: OnlineOrderActionRequestDto,
    ): OnlineOrderDto

    /**
     * Mark order as ready (PREPARING → READY).
     */
    @POST("api/v1/online-order/{id}/ready")
    suspend fun markOnlineOrderReady(
        @Path("id") orderId: Long,
    ): OnlineOrderDto

    /**
     * Complete an order (READY → COMPLETED).
     */
    @POST("api/v1/online-order/{id}/complete")
    suspend fun completeOnlineOrder(
        @Path("id") orderId: Long,
    ): OnlineOrderDto

    /**
     * Cancel an order (any pre-COMPLETED → CANCELLED).
     */
    @POST("api/v1/online-order/{id}/cancel")
    suspend fun cancelOnlineOrder(
        @Path("id") orderId: Long,
        @Body body: OnlineOrderActionRequestDto,
    ): OnlineOrderDto

    // -- Appointments (P4-02) ---------------------------------

    /**
     * List today's appointments/reservations.
     */
    @GET("api/v1/appointments")
    suspend fun listAppointments(
        @Query("date") date: String? = null,
        @Query("status") status: String? = null,
    ): AppointmentListResponseDto

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

    // -- Tenant config ------------------------------------------

    /**
     * Read all tenant configuration as key-value map.
     */
    @GET("api/v1/config")
    suspend fun getTenantConfig(): TenantConfigResponseDto

    // -- Dashboard / KPI (P4-07) --------------------------------

    /**
     * Get today's dashboard summary (revenue, transactions, etc.)
     */
    @GET("api/v1/dashboard-kpi/summary")
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

    // -- Transaction history endpoints (P4-05) ---------------

    /**
     * Get paginated transaction history with optional filters.
     * Supports filtering by date, date range, and status.
     */
    @GET("api/v1/transactions")
    suspend fun getTransactionHistory(
        @Query("date") date: String? = null,
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): TransactionHistoryResponseDto

    /**
     * Get single transaction detail with items.
     */
    @GET("api/v1/transactions/{id}")
    suspend fun getTransactionDetail(
        @Path("id") transactionId: Long,
    ): TransactionDetailDto

    // -- Appointment endpoints (P4-02) ----------------------

    /**
     * Get paginated appointment list with optional filters.
     * Supports filtering by status, staff, and date range.
     */
    @GET("api/v1/appointments")
    suspend fun listAppointments(
        @Query("status") status: String? = null,
        @Query("staff_id") staffId: Long? = null,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): AppointmentListResponseDto

    /**
     * Get single appointment detail with services.
     */
    @GET("api/v1/appointments/{id}")
    suspend fun getAppointmentDetail(
        @Path("id") appointmentId: Long,
    ): AppointmentDto

    /**
     * Create new appointment.
     */
    @POST("api/v1/appointments")
    suspend fun createAppointment(
        @Body body: AppointmentCreateRequestDto,
    ): AppointmentDto

    /**
     * Confirm appointment (PENDING → CONFIRMED).
     */
    @POST("api/v1/appointments/{id}/confirm")
    suspend fun confirmAppointment(
        @Path("id") appointmentId: Long,
    ): AppointmentDto

    /**
     * Start appointment (CONFIRMED → IN_PROGRESS).
     */
    @POST("api/v1/appointments/{id}/start")
    suspend fun startAppointment(
        @Path("id") appointmentId: Long,
    ): AppointmentDto

    /**
     * Complete appointment (IN_PROGRESS → COMPLETED).
     */
    @POST("api/v1/appointments/{id}/complete")
    suspend fun completeAppointment(
        @Path("id") appointmentId: Long,
    ): AppointmentDto

    /**
     * Cancel appointment with optional reason.
     */
    @POST("api/v1/appointments/{id}/cancel")
    suspend fun cancelAppointment(
        @Path("id") appointmentId: Long,
        @Body body: AppointmentActionRequestDto? = null,
    ): AppointmentDto

    /**
     * Mark appointment as no-show with optional reason.
     */
    @POST("api/v1/appointments/{id}/no-show")
    suspend fun markNoShow(
        @Path("id") appointmentId: Long,
        @Body body: AppointmentActionRequestDto? = null,
    ): AppointmentDto

    /**
     * Reschedule appointment to new date/time.
     */
    @POST("api/v1/appointments/{id}/reschedule")
    suspend fun rescheduleAppointment(
        @Path("id") appointmentId: Long,
        @Body body: AppointmentActionRequestDto,
    ): AppointmentDto

    // -- Inventory endpoints (P4-03, P4-04) ----------------

    /**
     * Get inventory movements with optional filters.
     */
    @GET("api/inventory/movements")
    suspend fun getInventoryMovements(
        @Query("product_id") productId: Long? = null,
        @Query("tipe") tipe: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("limit") limit: Int = 100,
    ): List<InventoryMovementDto>

    /**
     * Create inventory movement (stok_in, stok_out, opname).
     */
    @POST("api/inventory/movements")
    suspend fun createInventoryMovement(
        @Body body: InventoryMovementCreateRequestDto,
    ): InventoryMovementDto

    /**
     * Get inventory summary for all products.
     */
    @GET("api/inventory/summary")
    suspend fun getInventorySummary(): List<InventorySummaryDto>

    /**
     * Get stock opname list with optional status filter.
     */
    @GET("api/stock-opname")
    suspend fun getStockOpnameList(
        @Query("status") status: String? = null,
    ): List<StockOpnameDto>

    /**
     * Get single stock opname detail with items.
     */
    @GET("api/stock-opname/{id}")
    suspend fun getStockOpnameDetail(
        @Path("id") opnameId: Long,
    ): StockOpnameDto

    /**
     * Create new stock opname session.
     */
    @POST("api/stock-opname")
    suspend fun createStockOpname(
        @Body body: StockOpnameCreateRequestDto,
    ): StockOpnameDto

    /**
     * Update physical count for an item in stock opname.
     */
    @PUT("api/stock-opname/{id}/items/{product_id}")
    suspend fun updateStockOpnameItem(
        @Path("id") opnameId: Long,
        @Path("product_id") productId: Long,
        @Body body: StockOpnameUpdateItemRequestDto,
    ): StockOpnameDto

    /**
     * Finalize stock opname and apply adjustments.
     */
    @POST("api/stock-opname/{id}/finalize")
    suspend fun finalizeStockOpname(
        @Path("id") opnameId: Long,
        @Body body: StockOpnameFinalizeRequestDto,
    ): StockOpnameDto

    /**
     * Delete draft stock opname.
     */
    @DELETE("api/stock-opname/{id}")
    suspend fun deleteStockOpname(
        @Path("id") opnameId: Long,
    ): Unit
}
