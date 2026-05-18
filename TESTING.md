# VIPOS Testing Status & Plan

**Last Updated**: May 9, 2026  
**Commit**: 2c6212b

## Test Results Summary

### ✅ Automated Tests Status
All existing unit tests passing: **462/462 tasks successful**

| Module | Status | Notes |
|--------|--------|-------|
| core:common | ✅ PASS | String, number, validator tests |
| core:network | ✅ PASS | Auth interceptor, session tests |
| core:designsystem | ✅ PASS | Date/time formatting tests |
| core:database | ✅ NO-SOURCE | No unit tests (expected) |
| feature:auth | ✅ PASS | Auth repository tests |
| feature:home | ✅ NO-SOURCE | No unit tests yet |
| feature:pos | ✅ PASS | Existing POS tests |
| app | ✅ PASS | All variants (dev, staging, prod) |

### ⚠️ Known Limitations

1. **No Unit Tests for New Features**
   - AppointmentViewModel: Not tested
   - InventoryViewModel: Not tested
   - Reason: API signatures still evolving

2. **No Integration Tests**
   - Backend endpoints not tested from Android
   - UI flows not tested end-to-end
   - Reason: Requires running backend + emulator

3. **No UI Tests**
   - Compose UI not tested
   - Navigation flows not tested
   - Reason: Espresso/Compose testing not set up

## Manual Testing Plan

### P4-02: Appointment System

#### Prerequisites
- Backend running on VPS (103.74.5.44:3001)
- Valid auth token
- Test data in database

#### Test Scenarios

**1. List Appointments**
```
Endpoint: GET /api/v1/appointments?limit=20
Expected: List of appointments with pagination
Test:
- [ ] Empty state shows "Belum ada janji temu"
- [ ] Appointments display with correct info
- [ ] Status badges show correct colors
- [ ] Infinite scroll loads more data
```

**2. Filter Appointments**
```
Test:
- [ ] Filter by status (PENDING, CONFIRMED, etc.)
- [ ] Filter updates list correctly
- [ ] "Hapus Filter" clears all filters
- [ ] Total count updates correctly
```

**3. View Appointment Detail**
```
Endpoint: GET /api/v1/appointments/{id}
Test:
- [ ] Customer info displays correctly
- [ ] Services list shows all items
- [ ] Payment info shows total & deposit
- [ ] Status badge matches appointment status
```

**4. Create Appointment**
```
Endpoint: POST /api/v1/appointments
Test Data:
{
  "customer_name": "Test Customer",
  "customer_phone": "08123456789",
  "start_at": "2026-05-10T10:00:00.000Z",
  "services": [{
    "service_name": "Haircut",
    "qty": 1,
    "price": 50000
  }]
}

Test:
- [ ] Form validation works
- [ ] Success creates appointment
- [ ] Navigates to detail screen
- [ ] List refreshes with new appointment
```

**5. State Transitions**
```
Test:
- [ ] PENDING → Confirm → CONFIRMED
- [ ] CONFIRMED → Start → IN_PROGRESS
- [ ] IN_PROGRESS → Complete → COMPLETED
- [ ] Any → Cancel → CANCELLED
- [ ] Any → No Show → NO_SHOW
```

**6. Error Handling**
```
Test:
- [ ] Network error shows error message
- [ ] Invalid data shows validation error
- [ ] Retry button works
- [ ] Error clears after successful retry
```

### P4-03: Inventory Stock Movements

#### Test Scenarios

**1. List Stock Movements**
```
Endpoint: GET /api/inventory/movements?limit=100
Test:
- [ ] Empty state shows correctly
- [ ] Movements display with product info
- [ ] Type badges (Masuk/Keluar/Opname) correct
- [ ] Stock before/after shows correctly
```

**2. Filter by Type**
```
Test:
- [ ] Filter stok_in shows only incoming
- [ ] Filter stok_out shows only outgoing
- [ ] Filter opname shows only opname
- [ ] "Semua" shows all types
```

**3. Create Stock In**
```
Endpoint: POST /api/inventory/movements
Test Data:
{
  "product_id": 1,
  "tipe": "stok_in",
  "qty": 10,
  "tanggal": "2026-05-09",
  "unit_cost": 5000,
  "keterangan": "Pembelian dari supplier"
}

Test:
- [ ] Form validation works
- [ ] Success creates movement
- [ ] Navigates back to list
- [ ] List shows new movement
- [ ] Stock updated in database
```

**4. Create Stock Out**
```
Test Data:
{
  "product_id": 1,
  "tipe": "stok_out",
  "qty": 5,
  "tanggal": "2026-05-09",
  "keterangan": "Produk rusak"
}

Test:
- [ ] Form validation works
- [ ] Success creates movement
- [ ] Stock decreases correctly
- [ ] Cannot go negative (backend validation)
```

**5. Error Handling**
```
Test:
- [ ] Invalid product ID shows error
- [ ] Qty <= 0 shows validation error
- [ ] Network error handled gracefully
- [ ] Insufficient stock shows error (stok_out)
```

## Backend API Testing

### Authentication
```bash
# Login
curl -X POST http://103.74.5.44:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Expected: { "accessToken": "...", "user": {...} }
```

### Appointments
```bash
# List
curl http://103.74.5.44:3001/api/v1/appointments?limit=5 \
  -H "Authorization: Bearer <token>"

# Create
curl -X POST http://103.74.5.44:3001/api/v1/appointments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test",
    "start_at": "2026-05-10T10:00:00.000Z",
    "services": [{"service_name":"Test","qty":1,"price":50000}]
  }'

# Confirm
curl -X POST http://103.74.5.44:3001/api/v1/appointments/1/confirm \
  -H "Authorization: Bearer <token>"
```

### Inventory
```bash
# List movements
curl http://103.74.5.44:3001/api/inventory/movements?limit=10 \
  -H "Authorization: Bearer <token>"

# Create movement
curl -X POST http://103.74.5.44:3001/api/inventory/movements \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "tipe": "stok_in",
    "qty": 10,
    "tanggal": "2026-05-09",
    "unit_cost": 5000
  }'
```

## Test Data Setup

### Required Test Data
1. **Products**: At least 5 products in database
2. **Customers**: At least 3 customers
3. **Staff**: At least 2 staff members
4. **Appointments**: Mix of statuses (PENDING, CONFIRMED, etc.)
5. **Stock Movements**: Historical movements for testing

### Database Queries
```sql
-- Check products
SELECT id, name, sku, stock FROM products LIMIT 5;

-- Check appointments
SELECT id, ref_no, customer_name, status FROM appointments LIMIT 10;

-- Check stock movements
SELECT id, product_id, tipe, qty, tanggal FROM inventory_movements LIMIT 10;
```

## Known Issues

### Critical
- None identified yet (pending manual testing)

### Medium
- AppointmentCreateScreen: Date/time picker is simplified (uses default tomorrow 10:00)
- StockMovementCreateScreen: Product selection by ID only (no dropdown)

### Low
- Deprecation warnings for Icons.Default.ArrowBack (use AutoMirrored version)
- Deprecation warning for Divider (use HorizontalDivider)

## Next Steps

1. **Manual Testing** (High Priority)
   - Test all appointment flows with real backend
   - Test all inventory flows with real backend
   - Document any bugs found

2. **Unit Tests** (Medium Priority)
   - Complete AppointmentViewModelTest
   - Create InventoryViewModelTest
   - Add edge case tests

3. **Integration Tests** (Low Priority)
   - Set up MockWebServer tests
   - Test DTO serialization/deserialization
   - Test error handling

4. **UI Tests** (Future)
   - Set up Compose testing
   - Test navigation flows
   - Test user interactions

## Test Coverage Goals

- **Unit Tests**: 80% coverage for ViewModels
- **Integration Tests**: All API endpoints tested
- **UI Tests**: Critical user flows tested
- **Manual Tests**: All features tested before release

## Testing Checklist Before Release

- [ ] All automated tests passing
- [ ] Manual testing completed for all features
- [ ] No critical bugs
- [ ] Performance acceptable (< 2s response time)
- [ ] Error handling tested
- [ ] Edge cases covered
- [ ] Backend integration verified
- [ ] APK tested on real device
- [ ] Network error scenarios tested
- [ ] Offline behavior tested (if applicable)
