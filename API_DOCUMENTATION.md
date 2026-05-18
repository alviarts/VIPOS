# VIPOS API Documentation

**Version**: 1.0  
**Base URL**: `http://103.74.5.44:3001`  
**Last Updated**: 2026-05-10

---

## Authentication

All endpoints (except `/api/health` and `/api/auth/login`) require JWT authentication.

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Administrator",
    "role": "admin",
    "tenant_id": 1
  }
}
```

**Token Expiry**: 15 minutes  
**Rate Limit**: 5 attempts per 15 minutes

---

## Products

### List Products
```http
GET /api/v1/products?page=1&per_page=100&active_only=true
```

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `per_page` (number): Items per page (default: 100)
- `active_only` (boolean): Filter active products (default: true)
- `is_tampil_di_menu` (boolean): Show in menu
- `category_id` (number): Filter by category
- `search` (string): Search by name/SKU

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "sku": "PRD001",
      "name": "Kopi Americano",
      "price": 25000,
      "stock": 100,
      "category_id": 1,
      "category_name": "Beverages",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 100,
    "total": 150,
    "total_pages": 2
  }
}
```

### Get Product Variants
```http
GET /api/v1/products/{id}/variants
```

**Response**:
```json
[
  {
    "id": 1,
    "product_id": 1,
    "group_name": "Size",
    "option_name": "Large",
    "price_modifier": 5000,
    "is_default": false
  }
]
```

---

## Transactions

### Create Transaction
```http
POST /api/v1/transactions
Content-Type: application/json

{
  "items": [
    {
      "product_id": 1,
      "price": 25000,
      "quantity": 2
    }
  ],
  "payment_amount": 50000,
  "payment_method": "CASH",
  "notes": null
}
```

**Response**:
```json
{
  "id": 9001,
  "invoice_number": "INV-2026-05-10-0001",
  "total_amount": 50000,
  "payment_amount": 50000,
  "change_amount": 0,
  "payment_method": "CASH",
  "status": "completed",
  "created_at": "2026-05-10T10:00:00Z"
}
```

### List Transactions
```http
GET /api/v1/transactions?from_date=2026-05-01&to_date=2026-05-10
```

**Query Parameters**:
- `from_date` (string): Start date (YYYY-MM-DD)
- `to_date` (string): End date (YYYY-MM-DD)
- `payment_method` (string): Filter by payment method
- `status` (string): Filter by status

---

## Appointments (P4-02)

### List Appointments
```http
GET /api/appointment?status=PENDING&from_date=2026-05-01
```

**Query Parameters**:
- `status` (string): PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
- `from_date` (string): Start date
- `to_date` (string): End date
- `customer_id` (number): Filter by customer

**Response**:
```json
[
  {
    "id": 1,
    "ref_no": "APT-2026-05-10-0001",
    "customer_name": "John Doe",
    "customer_phone": "081234567890",
    "start_at": "2026-05-10T14:00:00Z",
    "end_at": "2026-05-10T15:00:00Z",
    "status": "PENDING",
    "total": 150000,
    "services": [
      {
        "service_name": "Haircut",
        "price": 150000,
        "duration_minutes": 60
      }
    ]
  }
]
```

### Create Appointment
```http
POST /api/appointment
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_phone": "081234567890",
  "start_at": "2026-05-10T14:00:00Z",
  "duration_minutes": 60,
  "services": [
    {
      "service_name": "Haircut",
      "price": 150000,
      "duration_minutes": 60
    }
  ],
  "notes": "First time customer"
}
```

### Appointment Actions
```http
POST /api/appointment/{id}/confirm
POST /api/appointment/{id}/checkin
POST /api/appointment/{id}/complete
POST /api/appointment/{id}/cancel
POST /api/appointment/{id}/no-show
POST /api/appointment/{id}/reschedule
```

---

## Inventory (P4-03)

### List Stock Movements
```http
GET /api/inventory/movements?from_date=2026-05-01&type=in
```

**Query Parameters**:
- `from_date` (string): Start date
- `to_date` (string): End date
- `type` (string): in, out, adjustment
- `product_id` (number): Filter by product

**Response**:
```json
[
  {
    "id": 1,
    "product_id": 1,
    "product_name": "Kopi Arabica",
    "type": "in",
    "quantity": 100,
    "unit_cost": 50000,
    "notes": "Restock from supplier",
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### Create Stock Movement
```http
POST /api/inventory/movements
Content-Type: application/json

{
  "product_id": 1,
  "type": "in",
  "quantity": 100,
  "unit_cost": 50000,
  "notes": "Restock from supplier"
}
```

### Get Inventory Summary
```http
GET /api/inventory/summary
```

**Response**:
```json
[
  {
    "product_id": 1,
    "product_name": "Kopi Arabica",
    "current_stock": 250,
    "min_stock": 50,
    "avg_cost": 48000,
    "total_value": 12000000
  }
]
```

---

## Stock Opname (P4-04)

### List Stock Opname
```http
GET /api/stock-opname?status=draft
```

**Query Parameters**:
- `status` (string): draft, final

**Response**:
```json
[
  {
    "id": 1,
    "ref_no": "SO-2026-05-10-0001",
    "opname_date": "2026-05-10",
    "status": "draft",
    "total_items": 50,
    "total_variance": -5,
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### Create Stock Opname
```http
POST /api/stock-opname
Content-Type: application/json

{
  "opname_date": "2026-05-10",
  "notes": "Monthly stock check",
  "product_ids": [1, 2, 3]
}
```

### Update Stock Opname Item
```http
PUT /api/stock-opname/{id}/items/{item_id}
Content-Type: application/json

{
  "physical_count": 95
}
```

### Finalize Stock Opname
```http
POST /api/stock-opname/{id}/finalize
```

---

## Reports (P4-06)

### Sales Summary
```http
GET /api/v1/reports/sales-summary?from_date=2026-05-01&to_date=2026-05-10
```

**Response**:
```json
{
  "total_revenue": 15000000,
  "total_transactions": 150,
  "avg_transaction": 100000,
  "total_items_sold": 300,
  "growth_percentage": 15.5
}
```

### Sales by Product
```http
GET /api/v1/reports/sales-by-product?from_date=2026-05-01&to_date=2026-05-10&limit=10
```

**Response**:
```json
[
  {
    "product_id": 1,
    "product_name": "Kopi Americano",
    "quantity_sold": 150,
    "revenue": 3750000,
    "percentage": 25.0
  }
]
```

### Sales by Payment Method
```http
GET /api/v1/reports/sales-by-payment?from_date=2026-05-01&to_date=2026-05-10
```

**Response**:
```json
[
  {
    "payment_method": "CASH",
    "transaction_count": 80,
    "total_amount": 8000000,
    "percentage": 53.3
  },
  {
    "payment_method": "QRIS",
    "transaction_count": 50,
    "total_amount": 5000000,
    "percentage": 33.3
  }
]
```

---

## Employees (P4-08)

### List Employees
```http
GET /api/employee?status=active&search=john
```

**Query Parameters**:
- `status` (string): active, inactive, terminated
- `department_id` (number): Filter by department
- `search` (string): Search by name/phone/position

**Response**:
```json
[
  {
    "id": 1,
    "employee_no": "EMP001",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "081234567890",
    "position": "Cashier",
    "department_id": 1,
    "department_name": "Sales",
    "status": "active",
    "hire_date": "2024-01-01"
  }
]
```

### Create Employee
```http
POST /api/employee
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "081234567890",
  "position": "Cashier",
  "department_id": 1,
  "status": "active",
  "hire_date": "2024-01-01",
  "address": "Jakarta",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "081234567891"
}
```

### Update Employee
```http
PUT /api/employee/{id}
Content-Type: application/json

{
  "position": "Senior Cashier",
  "status": "active"
}
```

### Delete Employee
```http
DELETE /api/employee/{id}
```

---

## Customer Loyalty (P4-09)

### Get Customer Loyalty
```http
GET /api/loyalty/customer/{customerId}
```

**Response**:
```json
{
  "customer_id": 1,
  "customer_name": "John Doe",
  "customer_phone": "081234567890",
  "points_balance": 1500,
  "total_earned": 2000,
  "total_redeemed": 500,
  "total_adjusted": 0,
  "member_since": "2024-01-01"
}
```

### List Loyalty Transactions
```http
GET /api/loyalty/transactions?customer_id=1&type=earn
```

**Query Parameters**:
- `customer_id` (number): Filter by customer
- `type` (string): earn, redeem, adjust, expire
- `from_date` (string): Start date
- `to_date` (string): End date

**Response**:
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "type": "earn",
    "points": 100,
    "balance_after": 1500,
    "transaction_id": 9001,
    "rule_name": "Purchase Points",
    "notes": "Earned from transaction",
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### Adjust Loyalty Points
```http
POST /api/loyalty/adjust
Content-Type: application/json

{
  "customer_id": 1,
  "points": 100,
  "notes": "Bonus points for birthday"
}
```

### Redeem Loyalty Points
```http
POST /api/loyalty/redeem
Content-Type: application/json

{
  "customer_id": 1,
  "points": 500,
  "transaction_id": 9001
}
```

---

## Multi-outlet (P4-11)

### List Outlets
```http
GET /api/outlet?is_active=true
```

**Query Parameters**:
- `is_active` (boolean): Filter active outlets

**Response**:
```json
[
  {
    "id": 1,
    "code": "OUT001",
    "name": "Main Store",
    "type": "retail",
    "address": "Jakarta",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "phone": "021-12345678",
    "email": "main@example.com",
    "timezone": "Asia/Jakarta",
    "currency": "IDR",
    "is_main": true,
    "is_active": true
  }
]
```

### Create Outlet
```http
POST /api/outlet
Content-Type: application/json

{
  "code": "OUT002",
  "name": "Branch Store",
  "type": "retail",
  "address": "Bandung",
  "city": "Bandung",
  "province": "Jawa Barat",
  "phone": "022-12345678",
  "timezone": "Asia/Jakarta",
  "currency": "IDR",
  "is_active": true
}
```

### Update Outlet
```http
PUT /api/outlet/{id}
Content-Type: application/json

{
  "name": "Branch Store - Updated",
  "is_active": true
}
```

### Delete Outlet
```http
DELETE /api/outlet/{id}
```

### Switch Outlet
```http
POST /api/outlet/switch
Content-Type: application/json

{
  "outlet_id": 2
}
```

**Response**:
```json
{
  "message": "Outlet berhasil diganti",
  "outlet_id": 2,
  "outlet_name": "Branch Store"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Token tidak valid atau sudah kadaluarsa"
}
```

### 404 Not Found
```json
{
  "error": "Resource tidak ditemukan"
}
```

### 500 Internal Server Error
```json
{
  "error": "Terjadi kesalahan pada server"
}
```

---

## Rate Limits

- **Login**: 5 attempts per 15 minutes per IP
- **API Calls**: 100 requests per minute per user
- **Bulk Operations**: 10 requests per minute

---

## Pagination

All list endpoints support pagination:

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `per_page` (number): Items per page (default: 20, max: 100)

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## Filtering & Sorting

Most list endpoints support:

**Filtering**:
- `status`: Filter by status
- `from_date`: Start date (YYYY-MM-DD)
- `to_date`: End date (YYYY-MM-DD)
- `search`: Search query

**Sorting**:
- `sort_by`: Field to sort by
- `sort_order`: asc or desc

---

## Webhooks (Future)

Coming soon:
- Transaction completed
- Appointment confirmed
- Stock low alert
- Payment received

---

## SDK & Libraries

### JavaScript/TypeScript
```bash
npm install @vipos/sdk
```

### Kotlin/Android
```kotlin
implementation("id.alviarts.vipos:sdk:1.0.0")
```

---

## Support

- **Documentation**: https://docs.vipos.id
- **API Status**: https://status.vipos.id
- **Support Email**: support@vipos.id
- **GitHub**: https://github.com/alviarts/VIPOS

---

**Last Updated**: 2026-05-10  
**API Version**: 1.0  
**Backend Version**: 1.0.0
