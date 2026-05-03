# 02 · Data Models — Entity Schemas

> Master entity definitions inferred from the bundle, the HTML form snapshots, and the public marketing copy. These map directly to Kotlin data classes / Room entities for the Android app.
>
> Notation: `field: Type` ; `?` = nullable ; `[verified]`/`[inferred]` markers per field where ambiguous. Foreign keys are listed with `↗` pointing at the target entity.

## Index

- §1 Identity & access — `User`, `Role`, `Privilege`, `Outlet`, `Merchant`
- §2 Catalogue — `Department`, `Category`, `Product`, `Variant`, `ExtraGroup`, `Recipe`, `Unit`, `Tax`, `ServiceCharge`
- §3 Customer — `Customer`, `CustomerGroup`, `LoyaltyPoint`, `LoyaltyHistory`, `Deposit`, `Coupon`
- §4 Promo & loyalty — `Promo`, `PromoRule`, `PromoUsage`
- §5 Transaction core — `Transaction`, `TransactionItem`, `TransactionPayment`, `Void`, `Refund`, `KitchenTicket`, `Shift`
- §6 Inventory — `Stock`, `StockMovement`, `PurchaseOrder`, `GoodsReceived`, `Opname`, `Mutation`, `Production`, `Waste`, `Supplier`
- §7 Finance — `CashAccount`, `CashTransaction`, `Account`, `JournalEntry`, `Asset`, `Tax`, `Expense`, `Income`, `Invoice`
- §8 Employee — `Employee`, `Attendance`, `Schedule`, `Salary`, `Commission`, `Payroll`, `Announcement`
- §9 Marketing — `Campaign`, `BroadcastMessage`, `MessageTemplate`, `MarketingChannel`
- §10 Online order — `OnlineOrder`, `OrderChannel`, `MarketplaceMapping`
- §11 Reservation — `Reservation`, `Table`, `Room`
- §12 Misc — `AuditEvent`, `Notification`, `FeatureFlag`, `Banner`, `Image`

---

## §1 Identity & access

```kotlin
// User
data class User(
  val id: Long,                       // [verified] PK
  val username: String,               // [verified] login
  val name: String,                   // [verified] display
  val email: String?,                 // [inferred] used for slip gaji, KYC
  val phone: String?,                 // [inferred] used for OTP, WA blast
  val idRole: Long,                   // [verified] FK → Role
  val idMerchant: Long,               // [verified] FK → Merchant
  val idOutletPrimary: Long,          // [verified] FK → Outlet
  val outletAccess: List<Long> = listOf(), // [inferred] for multi-outlet
  val isActive: Boolean = true,
  val createdAt: Instant,
  val updatedAt: Instant,
  val lastLoginAt: Instant?,
)

// Role
data class Role(
  val id: Long,
  val code: String,           // ADMIN/MANAGER/KASIR/STAFF/WAREHOUSE/WAITERS/KITCHEN/ORDER_DISPLAY/SELF_ORDER/CUSTOM_PRIVILAGE
  val name: String,
  val isSystem: Boolean,      // built-in vs custom
  val merchantId: Long?,      // null for built-in
)

// Privilege (per role × menu)
data class Privilege(
  val idRole: Long,
  val menuKey: String,        // matches docs/majoo_menu_flat.tsv menu Path
  val canView: Boolean,
  val canCreate: Boolean,
  val canUpdate: Boolean,
  val canDelete: Boolean,
)

// Outlet
data class Outlet(
  val id: Long,
  val idMerchant: Long,
  val name: String,
  val address: String,
  val provinceId: Long,
  val cityId: Long,
  val districtId: Long,
  val villageId: Long?,
  val zip: String?,
  val phone: String?,
  val email: String?,
  val timezone: String = "Asia/Jakarta",
  val openTime: String?,         // "08:00"
  val closeTime: String?,        // "22:00"
  val taxIncluded: Boolean,
  val taxRate: BigDecimal?,
  val serviceChargeRate: BigDecimal?,
  val roundingRule: String,      // NONE / FLOOR_100 / CEIL_100
  val orderModesEnabled: Set<String>, // QS / DINE_IN / RETAIL / JASA / RESERVASI / MARKETPLACE
  val printerLayout: String,     // 58 / 80
  val isActive: Boolean,
  val logoUrl: String?,
)

// Merchant (the business entity)
data class Merchant(
  val id: Long,
  val name: String,
  val ownerName: String,
  val ownerEmail: String,
  val ownerPhone: String,
  val tier: String,              // LITE / STARTER / ADVANCE / PRIME / PRIME_PLUS
  val tierValidUntil: Instant,
  val outletCountPaid: Int,
  val createdAt: Instant,
  val features: Map<String, Boolean>, // feature flags override
)
```

## §2 Catalogue

```kotlin
data class Department(
  val id: Long,
  val name: String,
  val merchantId: Long,
  val sortOrder: Int,
  val isActive: Boolean,
)

data class Category(
  val id: Long,
  val name: String,
  val idDepartment: Long?,            // optional in some plans
  val merchantId: Long,
  val isActive: Boolean,
  val sortOrder: Int,
  val color: String?,                 // hex for POS button
)

data class Product(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val sku: String?,                   // unique per merchant
  val barcode: String?,
  val idCategory: Long,
  val idDepartment: Long?,
  val price: BigDecimal,              // price online (default sale price)
  val priceOffline: BigDecimal?,      // tier ≥ Advance — different POS price
  val priceModal: BigDecimal,         // cost / HPP
  val unit: String,                   // pcs / kg / liter / ...
  val type: String,                   // GOODS / SERVICE / RECIPE
  val isFavorite: Boolean,            // shows in POS quick row
  val isWholesale: Boolean,           // unlocks tier price ladder
  val isSerialNumber: Boolean,        // [Prime+]
  val isBatchExpired: Boolean,        // [Prime+]
  val taxId: Long?,                   // override; null = use outlet default
  val serviceChargeId: Long?,
  val image: String?,                 // CDN URL
  val isActive: Boolean,
  val sortOrder: Int,
  val variants: List<Variant>,        // attached
  val extras: List<ExtraGroup>,       // attached
  val recipe: Recipe?,                // for type=RECIPE
  val onlineOrderName: String?,       // override for marketplace listing
  val onlineOrderImage: String?,
  val onlineOrderDescription: String?,
)

data class Variant(
  val id: Long,
  val idProduct: Long,
  val name: String,           // Size, Color, Sweetness, ...
  val options: List<VariantOption>,
)

data class VariantOption(
  val id: Long,
  val idVariant: Long,
  val name: String,           // S, M, L
  val priceDelta: BigDecimal, // +0 / +2000 / +5000
  val sku: String?,           // sub-SKU
  val isActive: Boolean,
)

data class ExtraGroup(
  val id: Long,
  val idProduct: Long?,             // null = re-usable across products
  val name: String,                 // "Topping", "Saus", "Spice level"
  val minSelect: Int = 0,
  val maxSelect: Int = 1,
  val isRequired: Boolean,
  val options: List<ExtraOption>,
)

data class ExtraOption(
  val id: Long,
  val idExtraGroup: Long,
  val name: String,
  val price: BigDecimal,
  val isActive: Boolean,
)

data class Recipe(
  val idProduct: Long,
  val ingredients: List<RecipeIngredient>,
)

data class RecipeIngredient(
  val idRawMaterial: Long,    // → Product type=GOODS, but flagged "bahan baku"
  val qty: BigDecimal,
  val unit: String,
)

data class Unit(
  val id: Long,
  val merchantId: Long,
  val name: String,           // pcs, kg, liter, dozen
  val isBase: Boolean,
  val parentUnitId: Long?,    // for multi-unit (1 dozen = 12 pcs)
  val parentRatio: BigDecimal?,
)

data class Tax(
  val id: Long,
  val merchantId: Long,
  val name: String,           // "PPN 11%", "Pajak Daerah 10%"
  val rate: BigDecimal,
  val isInclusive: Boolean,   // included in price vs added on top
  val applyTo: String,        // PRODUCT / TRANSACTION / BOTH
  val isActive: Boolean,
)

data class ServiceCharge(
  val id: Long,
  val merchantId: Long,
  val name: String,           // "Service 5%"
  val rate: BigDecimal,
  val isInclusive: Boolean,
  val isActive: Boolean,
)
```

## §3 Customer

```kotlin
data class Customer(
  val id: Long,
  val merchantId: Long,
  val code: String,                    // PLG-0001 (auto-generated)
  val name: String,
  val phone: String?,
  val email: String?,
  val gender: String?,                 // MALE / FEMALE / OTHER
  val birthDate: LocalDate?,
  val address: String?,
  val provinceId: Long?,
  val cityId: Long?,
  val districtId: Long?,
  val villageId: Long?,
  val zip: String?,
  val idCustomerGroup: Long?,
  val photo: String?,
  val isActive: Boolean,
  val totalSpent: BigDecimal,
  val totalTransaction: Int,
  val firstTransactionAt: Instant?,
  val lastTransactionAt: Instant?,
  val depositBalance: BigDecimal,      // saldo deposit
  val pointBalance: Int,
  val customFields: Map<String, String>, // [Prime+]
)

data class CustomerGroup(
  val id: Long,
  val merchantId: Long,
  val name: String,                    // "VIP", "Reseller", "Member Gold"
  val priceLevel: Int = 0,             // 0 = retail, 1+ = grosir tier
  val pointMultiplier: BigDecimal = BigDecimal.ONE,
  val isActive: Boolean,
)

data class LoyaltyPoint(
  val idCustomer: Long,
  val balance: Int,
  val updatedAt: Instant,
)

data class LoyaltyHistory(
  val id: Long,
  val idCustomer: Long,
  val type: String,           // EARN / REDEEM / EXPIRE / ADJUST
  val points: Int,
  val description: String,
  val idTransaction: Long?,
  val createdAt: Instant,
)

data class Deposit(
  val id: Long,
  val idCustomer: Long,
  val type: String,           // DEPOSIT / WITHDRAWAL / USE
  val amount: BigDecimal,
  val paymentMethodId: Long?,
  val description: String,
  val idTransaction: Long?,
  val createdAt: Instant,
)

data class Coupon(
  val id: Long,
  val merchantId: Long,
  val code: String,
  val type: String,           // PERCENT / NOMINAL / FREE_PRODUCT
  val value: BigDecimal,
  val maxRedeem: Int?,
  val redeemedCount: Int,
  val validFrom: Instant,
  val validUntil: Instant,
  val isActive: Boolean,
)
```

## §4 Promo

```kotlin
data class Promo(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val description: String,
  val type: String,                       // PER_PRODUCT / PER_TRANSACTION / BUNDLE / BOGO
  val discountType: String,               // PERCENT / NOMINAL / FREE_PRODUCT
  val discountValue: BigDecimal,
  val minPurchase: BigDecimal?,
  val maxDiscount: BigDecimal?,
  val applicableProducts: List<Long>,     // empty = all
  val applicableCategories: List<Long>,
  val excludedProducts: List<Long>,
  val applicableCustomerGroups: List<Long>,
  val outletIds: List<Long>,              // empty = all
  val orderTypes: List<String>,           // QS / DINE_IN / DELIVERY / TAKEAWAY / OJEK / ONLINE
  val daysOfWeek: Set<Int> = setOf(1,2,3,4,5,6,7),
  val timeStart: String?,                 // "08:00"
  val timeEnd: String?,                   // "22:00"
  val multiplier: Boolean,                // can apply N times if condition met N times
  val maxRedemptionsPerCustomer: Int?,
  val maxRedemptionsTotal: Int?,
  val validFrom: Instant,
  val validUntil: Instant,
  val isActive: Boolean,
  val isAutoApply: Boolean,               // vs manual via promo code
  val image: String?,
)

data class PromoRule(
  val id: Long,
  val idPromo: Long,
  val condition: String,         // QTY_GTE / SUBTOTAL_GTE / NTH_ITEM_FREE / ...
  val params: Map<String, String>,
)

data class PromoUsage(
  val id: Long,
  val idPromo: Long,
  val idTransaction: Long,
  val idCustomer: Long?,
  val discountAmount: BigDecimal,
  val createdAt: Instant,
)
```

## §5 Transaction core

```kotlin
data class Transaction(
  val id: Long,                                  // server-side
  val clientId: String,                          // UUID generated offline; server replays
  val merchantId: Long,
  val outletId: Long,
  val terminalId: String,                        // X-Terminal-Id
  val orderNumber: String,                       // human-readable, e.g. "001/05/2026"
  val orderType: String,                         // QS/DINE_IN/RETAIL/JASA/RESERVASI/DELIVERY/TAKEAWAY/OJEK/ONLINE
  val tableId: Long?,                            // null for QS
  val tableName: String?,
  val customerId: Long?,                         // null for walk-in
  val cashierUserId: Long,
  val waitersUserId: Long?,
  val status: String,                            // OPEN / SENT_TO_KITCHEN / READY / SERVED / PAID / SETTLED / VOIDED / REFUNDED
  val subtotal: BigDecimal,
  val discountAmount: BigDecimal,
  val promoIds: List<Long>,
  val taxAmount: BigDecimal,
  val serviceChargeAmount: BigDecimal,
  val rounding: BigDecimal,
  val total: BigDecimal,
  val paid: BigDecimal,
  val change: BigDecimal,
  val notes: String?,
  val items: List<TransactionItem>,
  val payments: List<TransactionPayment>,
  val voidedAt: Instant?,
  val voidReason: String?,
  val voidByUserId: Long?,
  val refundedAt: Instant?,
  val createdAt: Instant,
  val updatedAt: Instant,
  val syncedAt: Instant?,                        // null if still in offline queue
)

data class TransactionItem(
  val id: Long,
  val idTransaction: Long,
  val idProduct: Long,
  val productName: String,                       // snapshot
  val variantOptionIds: List<Long>,
  val variantNameSnapshot: String?,              // "Size: M, Sweetness: 50 %"
  val extraOptionIds: List<Long>,
  val extraSnapshot: List<ExtraSnap>,
  val qty: BigDecimal,
  val unit: String,
  val unitPrice: BigDecimal,
  val discount: BigDecimal,
  val tax: BigDecimal,
  val serviceCharge: BigDecimal,
  val subtotal: BigDecimal,
  val isComplimentary: Boolean,
  val notes: String?,
  val cookStatus: String,                        // NOT_SENT / SENT / READY / SERVED
  val sentToKitchenAt: Instant?,
  val readyAt: Instant?,
  val servedAt: Instant?,
)

data class ExtraSnap(val name: String, val price: BigDecimal)

data class TransactionPayment(
  val id: Long,
  val idTransaction: Long,
  val method: String,                            // CASH / EDC / QRIS / E_WALLET / DEPOSIT / VOUCHER / TRANSFER / CREDIT
  val methodId: Long?,                           // FK PaymentMethod (configured per outlet)
  val amount: BigDecimal,
  val refNumber: String?,                        // EDC trace, QRIS RRN, e-wallet ref, voucher code
  val cardLast4: String?,
  val cardType: String?,                         // VISA / MASTERCARD / GPN / debit / credit
  val mdrAmount: BigDecimal?,
  val createdAt: Instant,
)

data class KitchenTicket(
  val id: Long,
  val idTransaction: Long,
  val printerName: String,                       // "Dapur Utama", "Bar"
  val items: List<TransactionItem>,
  val printedAt: Instant?,
)

data class Shift(                                // a.k.a. "Buka Kasir / Tutup Kasir"
  val id: Long,
  val idOutlet: Long,
  val idTerminal: String,
  val cashierUserId: Long,
  val openedAt: Instant,
  val closedAt: Instant?,
  val openingCash: BigDecimal,
  val closingCashCounted: BigDecimal?,
  val closingCashExpected: BigDecimal?,
  val variance: BigDecimal?,
  val cashTransactions: List<CashTransaction>,   // cash drop, cash pickup
  val totalSales: BigDecimal,
  val totalCashSales: BigDecimal,
  val totalEdcSales: BigDecimal,
  val totalQrisSales: BigDecimal,
  val totalEwalletSales: BigDecimal,
  val totalVoid: BigDecimal,
  val totalRefund: BigDecimal,
  val notes: String?,
)
```

## §6 Inventory

```kotlin
data class Stock(
  val idProduct: Long,
  val idOutlet: Long,
  val qty: BigDecimal,
  val unit: String,
  val avgCost: BigDecimal,                       // running COGS average
  val lowStockThreshold: BigDecimal?,
  val updatedAt: Instant,
)

data class StockMovement(
  val id: Long,
  val idProduct: Long,
  val idOutlet: Long,
  val type: String,             // IN / OUT / OPNAME / MUTATION_OUT / MUTATION_IN / WASTE / PRODUCE / SALE / VOID / REFUND
  val qty: BigDecimal,
  val unit: String,
  val unitCost: BigDecimal?,    // optional for inferred OUT
  val refType: String?,         // PO / GR / OPNAME / MUTATION / WASTE / TRANSACTION / PRODUCTION
  val refId: Long?,
  val notes: String?,
  val userId: Long,
  val createdAt: Instant,
)

data class PurchaseOrder(
  val id: Long,
  val number: String,           // "PO-001/05/2026"
  val idSupplier: Long,
  val idOutlet: Long,
  val items: List<POItem>,
  val subtotal: BigDecimal,
  val discount: BigDecimal,
  val tax: BigDecimal,
  val total: BigDecimal,
  val status: String,           // DRAFT / OPEN / PARTIAL / RECEIVED / CLOSED / CANCELLED
  val orderedAt: Instant,
  val expectedAt: Instant?,
  val createdByUserId: Long,
  val notes: String?,
)

data class POItem(
  val idProduct: Long,
  val qtyOrdered: BigDecimal,
  val qtyReceived: BigDecimal,
  val unitCost: BigDecimal,
)

data class GoodsReceived(
  val id: Long,
  val number: String,           // "GR-001/05/2026"
  val idPO: Long,
  val items: List<GRItem>,
  val receivedAt: Instant,
  val receivedByUserId: Long,
  val notes: String?,
  val invoiceNumber: String?,
  val invoiceFile: String?,
)

data class GRItem(
  val idProduct: Long,
  val qty: BigDecimal,
  val unitCost: BigDecimal,
  val batchNumber: String?,     // [Prime+]
  val expiredAt: LocalDate?,    // [Prime+]
  val serialNumbers: List<String>?, // [Prime+]
)

data class Opname(
  val id: Long,
  val number: String,           // "OPN-001/05/2026"
  val idOutlet: Long,
  val items: List<OpnameItem>,
  val status: String,           // DRAFT / FINAL
  val createdAt: Instant,
  val finalizedAt: Instant?,
  val createdByUserId: Long,
  val notes: String?,
)

data class OpnameItem(
  val idProduct: Long,
  val qtyExpected: BigDecimal,
  val qtyCounted: BigDecimal,
  val variance: BigDecimal,
  val reason: String?,
  val photoUrl: String?,
)

data class Mutation(                              // [Prime] inter-outlet transfer
  val id: Long,
  val number: String,
  val fromOutletId: Long,
  val toOutletId: Long,
  val items: List<MutationItem>,
  val status: String,                             // DRAFT / IN_TRANSIT / RECEIVED / CANCELLED
  val sentAt: Instant?,
  val receivedAt: Instant?,
  val createdByUserId: Long,
  val notes: String?,
)

data class MutationItem(
  val idProduct: Long,
  val qty: BigDecimal,
  val unitCost: BigDecimal,
)

data class Production(                            // recipe-based stock-up
  val id: Long,
  val number: String,
  val idOutlet: Long,
  val idProduct: Long,                            // the produced item (recipe parent)
  val qty: BigDecimal,
  val ingredientUsage: List<RecipeIngredient>,    // snapshot
  val createdAt: Instant,
  val createdByUserId: Long,
)

data class Waste(
  val id: Long,
  val idOutlet: Long,
  val items: List<WasteItem>,
  val createdAt: Instant,
  val createdByUserId: Long,
  val notes: String?,
)

data class WasteItem(
  val idProduct: Long,
  val qty: BigDecimal,
  val reason: String,                             // EXPIRED / DAMAGED / SHRINKAGE / OTHER
  val photoUrl: String?,
)

data class Supplier(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val contactPerson: String?,
  val phone: String?,
  val email: String?,
  val address: String?,
  val taxNumber: String?,
  val paymentTerm: Int?,                          // days
  val isActive: Boolean,
)
```

## §7 Finance

```kotlin
data class CashAccount(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val type: String,                               // CASH / BANK / E_WALLET
  val accountNumber: String?,
  val bankName: String?,
  val balance: BigDecimal,                        // computed
  val isActive: Boolean,
)

data class CashTransaction(
  val id: Long,
  val idCashAccount: Long,
  val type: String,                               // IN / OUT / TRANSFER
  val amount: BigDecimal,
  val description: String,
  val refType: String?,                           // SALE / EXPENSE / DEPOSIT / WITHDRAWAL / SHIFT_OPEN / SHIFT_CLOSE / TRANSFER
  val refId: Long?,
  val attachmentUrl: String?,
  val createdAt: Instant,
  val createdByUserId: Long,
)

data class Account(                               // chart of accounts
  val id: Long,
  val merchantId: Long,
  val code: String,                               // 1-1000
  val name: String,                               // "Kas", "Piutang Usaha"
  val type: String,                               // ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE
  val parentId: Long?,
  val isPosting: Boolean,                         // can have entries
)

data class JournalEntry(
  val id: Long,
  val number: String,
  val date: LocalDate,
  val description: String,
  val lines: List<JournalLine>,
  val refType: String?,                           // TRANSACTION / EXPENSE / PAYROLL / ADJUSTMENT
  val refId: Long?,
  val isPosted: Boolean,
  val createdAt: Instant,
)

data class JournalLine(
  val idAccount: Long,
  val debit: BigDecimal,
  val credit: BigDecimal,
  val description: String?,
)

data class Asset(                                 // fixed asset
  val id: Long,
  val merchantId: Long,
  val name: String,
  val category: String,                           // EQUIPMENT / VEHICLE / FURNITURE / BUILDING / LAND / OTHER
  val acquisitionCost: BigDecimal,
  val acquisitionDate: LocalDate,
  val usefulLifeYears: Int,
  val depreciationMethod: String,                 // STRAIGHT_LINE / DECLINING
  val accumulatedDepreciation: BigDecimal,
  val bookValue: BigDecimal,
  val disposedAt: Instant?,
  val disposalProceeds: BigDecimal?,
)

data class Expense(
  val id: Long,
  val number: String,
  val idOutlet: Long,
  val idAccount: Long,                            // expense account
  val idCashAccount: Long?,                       // payment source
  val date: LocalDate,
  val amount: BigDecimal,
  val description: String,
  val attachmentUrl: String?,
  val createdByUserId: Long,
)

data class Income(                                // non-sales income
  val id: Long,
  val number: String,
  val idOutlet: Long,
  val idAccount: Long,
  val idCashAccount: Long?,
  val date: LocalDate,
  val amount: BigDecimal,
  val description: String,
  val attachmentUrl: String?,
)

data class Invoice(                               // accounts receivable invoice
  val id: Long,
  val number: String,
  val idCustomer: Long,
  val date: LocalDate,
  val dueDate: LocalDate,
  val items: List<InvoiceItem>,
  val subtotal: BigDecimal,
  val discount: BigDecimal,
  val tax: BigDecimal,
  val total: BigDecimal,
  val paid: BigDecimal,
  val outstanding: BigDecimal,
  val status: String,                             // DRAFT / OPEN / PARTIAL / PAID / OVERDUE / CANCELLED
  val notes: String?,
  val pdfUrl: String?,
)

data class InvoiceItem(
  val name: String,
  val qty: BigDecimal,
  val unitPrice: BigDecimal,
  val discount: BigDecimal,
  val tax: BigDecimal,
  val subtotal: BigDecimal,
)
```

## §8 Employee

```kotlin
data class Employee(
  val id: Long,                       // = User.id when login enabled
  val idUser: Long?,                  // null for non-login employees (e.g. cleaner)
  val merchantId: Long,
  val outletIds: List<Long>,
  val nik: String,
  val name: String,
  val phone: String?,
  val email: String?,
  val address: String?,
  val birthDate: LocalDate?,
  val gender: String?,
  val maritalStatus: String?,         // SINGLE / MARRIED / DIVORCED / WIDOWED
  val joinDate: LocalDate,
  val resignDate: LocalDate?,
  val position: String,
  val department: String?,
  val photo: String?,
  val ktpNumber: String?,
  val ktpPhoto: String?,
  val bankName: String?,
  val bankAccountName: String?,
  val bankAccountNumber: String?,
  val isActive: Boolean,
)

data class Attendance(
  val id: Long,
  val idEmployee: Long,
  val idOutlet: Long,
  val date: LocalDate,
  val checkInAt: Instant?,
  val checkInLat: Double?,
  val checkInLng: Double?,
  val checkInPhoto: String?,
  val checkOutAt: Instant?,
  val checkOutLat: Double?,
  val checkOutLng: Double?,
  val checkOutPhoto: String?,
  val totalHours: BigDecimal?,
  val isLate: Boolean,
  val isAbsent: Boolean,
  val notes: String?,
)

data class Schedule(
  val id: Long,
  val idEmployee: Long,
  val idOutlet: Long,
  val date: LocalDate,
  val shiftStart: String,             // "08:00"
  val shiftEnd: String,               // "16:00"
  val isOff: Boolean,
)

data class Salary(                    // employee salary structure
  val idEmployee: Long,
  val baseSalary: BigDecimal,
  val allowances: List<Allowance>,
  val deductions: List<Deduction>,
  val payCycle: String,               // MONTHLY / WEEKLY / DAILY
  val effectiveFrom: LocalDate,
)

data class Allowance(val name: String, val amount: BigDecimal, val isFixed: Boolean)
data class Deduction(val name: String, val amount: BigDecimal, val isFixed: Boolean)

data class Commission(
  val id: Long,
  val idEmployee: Long,
  val idTransaction: Long,
  val baseAmount: BigDecimal,
  val rate: BigDecimal,
  val amount: BigDecimal,
  val createdAt: Instant,
  val isPaid: Boolean,
)

data class Payroll(
  val id: Long,
  val number: String,
  val idEmployee: Long,
  val periodStart: LocalDate,
  val periodEnd: LocalDate,
  val baseSalary: BigDecimal,
  val totalAllowance: BigDecimal,
  val totalDeduction: BigDecimal,
  val totalCommission: BigDecimal,
  val totalAttendanceAdjust: BigDecimal,
  val grossSalary: BigDecimal,
  val tax: BigDecimal,
  val netSalary: BigDecimal,
  val status: String,                 // DRAFT / APPROVED / PAID
  val paidAt: Instant?,
  val paidVia: String?,               // BANK_AUTO / BANK_MANUAL / CASH
  val refNumber: String?,
  val slipPdfUrl: String?,
)

data class Announcement(
  val id: Long,
  val merchantId: Long,
  val title: String,
  val body: String,
  val target: String,                 // ALL / OUTLET / ROLE / EMPLOYEE
  val targetIds: List<Long>,
  val sendVia: List<String>,          // PUSH / WHATSAPP / SMS / EMAIL
  val sentAt: Instant,
  val createdByUserId: Long,
)
```

## §9 Marketing

```kotlin
data class Campaign(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val channel: String,                // SMS / WA / EMAIL / SMS_LBA
  val templateId: Long,
  val audienceQuery: AudienceQuery,
  val scheduledAt: Instant?,
  val status: String,                 // DRAFT / SCHEDULED / SENDING / SENT / CANCELLED
  val sentCount: Int,
  val deliveredCount: Int,
  val readCount: Int,
  val createdAt: Instant,
)

data class AudienceQuery(
  val customerGroupIds: List<Long>,
  val gender: String?,
  val ageMin: Int?,
  val ageMax: Int?,
  val totalSpentMin: BigDecimal?,
  val lastTransactionWithinDays: Int?,
  val pointBalanceMin: Int?,
  val customSegmentId: Long?,
)

data class MessageTemplate(
  val id: Long,
  val merchantId: Long,
  val name: String,
  val channel: String,
  val subject: String?,               // EMAIL only
  val body: String,                   // with {{variables}}
  val variables: List<String>,        // ["name","total","points"]
  val createdAt: Instant,
)
```

## §10 Online order

```kotlin
data class OnlineOrder(
  val id: Long,
  val source: String,                 // WEBSTORE / EMENU / GOFOOD / GRABFOOD / SHOPEEFOOD / GRABMART / TOKOPEDIA
  val sourceOrderId: String,
  val merchantId: Long,
  val outletId: Long,
  val customerName: String,
  val customerPhone: String?,
  val customerAddress: String?,
  val courier: String?,               // GoSend / GrabExpress / sendiri / pickup
  val deliveryFee: BigDecimal,
  val items: List<OnlineOrderItem>,
  val subtotal: BigDecimal,
  val discount: BigDecimal,
  val deliveryFeeBorne: BigDecimal,
  val total: BigDecimal,
  val paymentStatus: String,          // PAID / UNPAID / COD
  val orderStatus: String,            // NEW / ACCEPTED / PREPARING / READY / DISPATCHED / DELIVERED / CANCELLED
  val acceptedAt: Instant?,
  val dispatchedAt: Instant?,
  val deliveredAt: Instant?,
  val cancelledAt: Instant?,
  val rawPayload: String?,            // full json from marketplace
)

data class OnlineOrderItem(
  val name: String,
  val qty: BigDecimal,
  val unitPrice: BigDecimal,
  val notes: String?,
  val matchedProductId: Long?,        // resolved against catalogue
  val sku: String?,
)

data class MarketplaceMapping(
  val source: String,
  val sourceProductId: String,
  val matchedProductId: Long,
  val priceOverride: BigDecimal?,
  val isAvailable: Boolean,
)
```

## §11 Reservation

```kotlin
data class Reservation(
  val id: Long,
  val number: String,
  val idOutlet: Long,
  val idCustomer: Long?,
  val customerName: String,
  val customerPhone: String,
  val partySize: Int,
  val reservationAt: Instant,
  val durationMinutes: Int,
  val tableIds: List<Long>,
  val notes: String?,
  val depositAmount: BigDecimal?,
  val depositPaid: Boolean,
  val status: String,                 // BOOKED / CONFIRMED / SEATED / NO_SHOW / CANCELLED / FINISHED
  val createdAt: Instant,
  val createdByUserId: Long,
)

data class Table(
  val id: Long,
  val idOutlet: Long,
  val idRoom: Long?,
  val name: String,                   // "Meja 1"
  val capacity: Int,
  val xPos: Int?,                     // for floor plan (Prime+)
  val yPos: Int?,
  val width: Int?,
  val height: Int?,
  val shape: String?,                 // RECT / ROUND / SQUARE
  val isActive: Boolean,
)

data class Room(
  val id: Long,
  val idOutlet: Long,
  val name: String,                   // "Lantai 1", "VIP", "Outdoor"
  val sortOrder: Int,
  val isActive: Boolean,
)
```

## §12 Misc

```kotlin
data class AuditEvent(
  val id: Long,
  val merchantId: Long,
  val outletId: Long?,
  val userId: Long,
  val terminalId: String,
  val event: String,                  // VOID / REFUND / SETTLE / PRODUCT_UPDATE / PRICE_CHANGE / ...
  val entityType: String,
  val entityId: Long,
  val payload: String,                // JSON snapshot of before/after
  val createdAt: Instant,
  val ip: String?,
  val userAgent: String?,
)

data class Notification(
  val id: Long,
  val userId: Long,
  val title: String,
  val body: String,
  val category: String,               // ORDER / KDS / PROMO / SYSTEM / MARKETING
  val deepLink: String?,              // intent uri
  val readAt: Instant?,
  val createdAt: Instant,
)

data class FeatureFlag(
  val key: String,
  val isEnabled: Boolean,
  val merchantId: Long?,
  val outletId: Long?,
  val rolloutPercent: Int?,
  val expiresAt: Instant?,
)

data class Banner(
  val id: Long,
  val merchantId: Long,
  val title: String,
  val imageUrl: String,
  val linkUrl: String?,
  val sortOrder: Int,
  val isMain: Boolean,                // banner utama vs secondary
  val isActive: Boolean,
  val activeFrom: Instant,
  val activeUntil: Instant?,
)

data class Image(
  val id: Long,
  val entityType: String,             // PRODUCT / BANNER / EMPLOYEE / RECEIPT_LOGO / OPNAME / WASTE / KYC
  val entityId: Long?,
  val url: String,
  val width: Int,
  val height: Int,
  val sizeBytes: Long,
  val mimeType: String,               // image/jpeg / image/png
  val uploadedAt: Instant,
)
```

## §13 Image specs

| entity | aspect | max dim | max size | format |
|---|---|---|---|---|
| Product | 1:1 | 1024×1024 | 2 MB | JPEG/PNG |
| Banner (e-menu) | 16:9 | 1920×1080 | 2 MB | JPEG/PNG |
| Employee | 1:1 | 512×512 | 1 MB | JPEG |
| Receipt logo | 1:1 (square recommended) | 256×256 | 500 KB | PNG (monochrome best) |
| KTP photo | 16:10 | 1280×800 | 2 MB | JPEG |
| Selfie absen | 1:1 (front cam) | 720×720 | 1 MB | JPEG |
| Opname evidence | free | 1280×960 | 1 MB | JPEG |
| Waste evidence | free | 1280×960 | 1 MB | JPEG |
| Cash deposit slip | A4 portrait | 1240×1754 | 2 MB | JPEG/PDF |

## §14 Indexes & relationships diagram (high-level)

```
Merchant (1) ── (n) Outlet ── (n) User
  │             │              │
  │             │              └─ Role ── Privilege
  │             │
  │             └─ Shift ── CashTransaction
  │             │
  │             └─ Stock ── StockMovement
  │             │
  │             └─ Transaction ── TransactionItem ── (Variant + ExtraGroup)
  │                  │            └ Payment ── PaymentMethod
  │                  └ Promo
  │                  └ Customer ── LoyaltyHistory ── Deposit ── Coupon
  │
  ├─ Department ── Category ── Product ── Recipe ── RawMaterial
  │
  ├─ Supplier ── PurchaseOrder ── GoodsReceived
  │
  ├─ Employee ── Attendance, Schedule, Salary, Commission, Payroll
  │
  ├─ Campaign ── MessageTemplate
  │
  ├─ OnlineOrder ── MarketplaceMapping
  │
  ├─ Reservation ── Table ── Room
  │
  └─ Account ── JournalEntry ── JournalLine
```

## §15 Open questions for live re-validation

| Q | Where to verify |
|---|---|
| Exact column names — is it `id_product` or `productId` or `product_id`? | Inspect API response in network HAR |
| Are timestamps `Instant` (ISO-8601) or epoch ms? | Same |
| Does pagination use `?page=&per_page=` or `?cursor=&limit=`? | Hit any list endpoint with pagination |
| Are nested arrays embedded or fetched separately (e.g. `Transaction.items` vs `GET /trx/:id/items`)? | Compare list vs detail responses |
| Is `clientId` (offline UUID) returned by the server? | POST a transaction with `clientId`, check response |
| What's the exact error shape on 4xx? | Send malformed payload, observe |
