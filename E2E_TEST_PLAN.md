# VIPOS End-to-End Test Plan
**Date**: May 9, 2026  
**Build**: app-staging-debug.apk (13.4 MB)  
**Device**: 7XUGPNJZ8LDYQCCA  
**API**: http://103.74.5.44:3001  
**Credentials**: admin / admin123

---

## Test Environment Setup ✅

- [x] APK built successfully (staging flavor)
- [x] APK installed on device
- [x] App launched successfully
- [x] Backend API online (http://103.74.5.44:3001)

---

## Test Scenarios

### 1. Login & Authentication

**Test Case 1.1: Successful Login**
- [ ] Open app (should show login screen)
- [ ] Enter username: `admin`
- [ ] Enter password: `admin123`
- [ ] Tap "Login" button
- [ ] **Expected**: Navigate to Home screen
- [ ] **Expected**: Token saved (session persists on app restart)

**Test Case 1.2: Invalid Credentials**
- [ ] Enter username: `admin`
- [ ] Enter password: `wrong`
- [ ] Tap "Login" button
- [ ] **Expected**: Error message displayed
- [ ] **Expected**: Stay on login screen

**Test Case 1.3: Empty Fields**
- [ ] Leave username empty
- [ ] Leave password empty
- [ ] Tap "Login" button
- [ ] **Expected**: Validation error shown

**Test Case 1.4: Session Persistence**
- [ ] Login successfully
- [ ] Close app (swipe away from recents)
- [ ] Reopen app
- [ ] **Expected**: Skip login, go directly to Home

**Test Case 1.5: Logout**
- [ ] From Home screen, find logout button
- [ ] Tap logout
- [ ] **Expected**: Return to login screen
- [ ] **Expected**: Session cleared

---

### 2. Home Screen Navigation

**Test Case 2.1: Home Screen Elements**
- [ ] Verify "Reservasi" button visible
- [ ] Verify "Stok Masuk/Keluar" button visible
- [ ] Verify "Stok Opname" button visible
- [ ] Verify "Laporan Penjualan" button visible
- [ ] Verify "Karyawan" button visible

**Test Case 2.2: Navigation to Features**
- [ ] Tap "Reservasi" → Should navigate to Appointment List
- [ ] Back to Home
- [ ] Tap "Stok Masuk/Keluar" → Should navigate to Inventory Movements
- [ ] Back to Home
- [ ] Tap "Stok Opname" → Should navigate to Stock Opname List
- [ ] Back to Home
- [ ] Tap "Laporan Penjualan" → Should navigate to Sales Report
- [ ] Back to Home
- [ ] Tap "Karyawan" → Should navigate to Employee List
- [ ] Back to Home

---

### 3. Appointment System (Reservasi)

**Test Case 3.1: View Appointment List**
- [ ] Navigate to Reservasi
- [ ] **Expected**: List of appointments displayed
- [ ] **Expected**: Each item shows: customer name, date/time, service, status
- [ ] **Expected**: Status colors: PENDING (yellow), CONFIRMED (blue), IN_PROGRESS (green), COMPLETED (gray)

**Test Case 3.2: Filter by Status**
- [ ] Tap filter dropdown
- [ ] Select "PENDING"
- [ ] **Expected**: Only pending appointments shown
- [ ] Select "CONFIRMED"
- [ ] **Expected**: Only confirmed appointments shown
- [ ] Select "All"
- [ ] **Expected**: All appointments shown

**Test Case 3.3: View Appointment Detail**
- [ ] Tap on any appointment
- [ ] **Expected**: Detail screen shows:
  - Customer name, phone
  - Service name
  - Date & time
  - Status
  - Notes
  - Action buttons (based on status)

**Test Case 3.4: Confirm Appointment (PENDING → CONFIRMED)**
- [ ] Find a PENDING appointment
- [ ] Tap on it
- [ ] Tap "Confirm" button
- [ ] **Expected**: Status changes to CONFIRMED
- [ ] **Expected**: "Confirm" button disappears
- [ ] **Expected**: "Check In" and "Cancel" buttons appear

**Test Case 3.5: Check In (CONFIRMED → IN_PROGRESS)**
- [ ] Find a CONFIRMED appointment
- [ ] Tap on it
- [ ] Tap "Check In" button
- [ ] **Expected**: Status changes to IN_PROGRESS
- [ ] **Expected**: "Check In" button disappears
- [ ] **Expected**: "Complete" button appears

**Test Case 3.6: Complete Appointment (IN_PROGRESS → COMPLETED)**
- [ ] Find an IN_PROGRESS appointment
- [ ] Tap on it
- [ ] Tap "Complete" button
- [ ] **Expected**: Status changes to COMPLETED
- [ ] **Expected**: All action buttons disappear

**Test Case 3.7: Cancel Appointment**
- [ ] Find a PENDING or CONFIRMED appointment
- [ ] Tap on it
- [ ] Tap "Cancel" button
- [ ] **Expected**: Status changes to CANCELLED
- [ ] **Expected**: All action buttons disappear

**Test Case 3.8: Mark No-Show**
- [ ] Find a CONFIRMED appointment
- [ ] Tap on it
- [ ] Tap "No Show" button
- [ ] **Expected**: Status changes to NO_SHOW
- [ ] **Expected**: All action buttons disappear

**Test Case 3.9: Reschedule Appointment**
- [ ] Find a PENDING or CONFIRMED appointment
- [ ] Tap on it
- [ ] Tap "Reschedule" button
- [ ] **Expected**: Date/time picker appears
- [ ] Select new date/time
- [ ] Confirm
- [ ] **Expected**: Appointment updated with new date/time

**Test Case 3.10: Create New Appointment**
- [ ] From Appointment List, tap FAB (+) button
- [ ] Fill in:
  - Customer name: "Test Customer"
  - Phone: "081234567890"
  - Service: "Haircut"
  - Date: Tomorrow
  - Time: 10:00 AM
  - Notes: "Test appointment"
- [ ] Tap "Save"
- [ ] **Expected**: Navigate back to list
- [ ] **Expected**: New appointment appears in list with PENDING status

---

### 4. Inventory Movements (Stok Masuk/Keluar)

**Test Case 4.1: View Movement List**
- [ ] Navigate to Stok Masuk/Keluar
- [ ] **Expected**: List of stock movements displayed
- [ ] **Expected**: Each item shows: product name, type (IN/OUT), quantity, date

**Test Case 4.2: Filter by Type**
- [ ] Tap filter dropdown
- [ ] Select "Stock In"
- [ ] **Expected**: Only IN movements shown
- [ ] Select "Stock Out"
- [ ] **Expected**: Only OUT movements shown
- [ ] Select "All"
- [ ] **Expected**: All movements shown

**Test Case 4.3: Filter by Date Range**
- [ ] Tap "From Date" picker
- [ ] Select date (e.g., 1 week ago)
- [ ] Tap "To Date" picker
- [ ] Select date (e.g., today)
- [ ] **Expected**: Only movements within date range shown

**Test Case 4.4: Create Stock In**
- [ ] Tap FAB (+) button
- [ ] Select Type: "Stock In"
- [ ] Select Product: Any product
- [ ] Enter Quantity: 10
- [ ] Enter Unit Cost: 50000
- [ ] Enter Notes: "Test stock in"
- [ ] Tap "Save"
- [ ] **Expected**: Navigate back to list
- [ ] **Expected**: New movement appears in list

**Test Case 4.5: Create Stock Out**
- [ ] Tap FAB (+) button
- [ ] Select Type: "Stock Out"
- [ ] Select Product: Any product
- [ ] Enter Quantity: 5
- [ ] Enter Notes: "Test stock out"
- [ ] Tap "Save"
- [ ] **Expected**: Navigate back to list
- [ ] **Expected**: New movement appears in list

---

### 5. Stock Opname (Physical Inventory Count)

**Test Case 5.1: View Opname List**
- [ ] Navigate to Stok Opname
- [ ] **Expected**: List of stock opname sessions displayed
- [ ] **Expected**: Each item shows: date, status (DRAFT/FINAL), item count

**Test Case 5.2: Filter by Status**
- [ ] Tap filter dropdown
- [ ] Select "Draft"
- [ ] **Expected**: Only draft opnames shown
- [ ] Select "Final"
- [ ] **Expected**: Only finalized opnames shown
- [ ] Select "All"
- [ ] **Expected**: All opnames shown

**Test Case 5.3: View Opname Detail**
- [ ] Tap on any opname
- [ ] **Expected**: Detail screen shows:
  - Date
  - Status
  - List of products with:
    - Product name
    - System stock
    - Physical count (editable if DRAFT)
    - Variance (difference)

**Test Case 5.4: Create New Opname (All Products)**
- [ ] From Opname List, tap FAB (+) button
- [ ] Select Date: Today
- [ ] Select "All Products"
- [ ] Tap "Create"
- [ ] **Expected**: Navigate to detail screen
- [ ] **Expected**: All products listed with system stock
- [ ] **Expected**: Physical count = 0 for all

**Test Case 5.5: Update Physical Counts**
- [ ] In opname detail (DRAFT status)
- [ ] For each product, enter physical count
- [ ] **Expected**: Variance calculated automatically (physical - system)
- [ ] **Expected**: Positive variance = green, negative = red

**Test Case 5.6: Finalize Opname**
- [ ] In opname detail (DRAFT status)
- [ ] Tap "Finalize" button
- [ ] **Expected**: Confirmation dialog appears
- [ ] Confirm
- [ ] **Expected**: Status changes to FINAL
- [ ] **Expected**: Stock adjustments applied to inventory
- [ ] **Expected**: Physical count fields become read-only

**Test Case 5.7: Delete Draft Opname**
- [ ] Find a DRAFT opname
- [ ] Tap on it
- [ ] Tap "Delete" button
- [ ] **Expected**: Confirmation dialog appears
- [ ] Confirm
- [ ] **Expected**: Navigate back to list
- [ ] **Expected**: Opname removed from list

**Test Case 5.8: Cannot Edit Finalized Opname**
- [ ] Find a FINAL opname
- [ ] Tap on it
- [ ] **Expected**: Physical count fields are read-only
- [ ] **Expected**: No "Finalize" or "Delete" buttons
- [ ] **Expected**: Only "Back" button available

---

### 6. Sales Report (Laporan Penjualan)

**Test Case 6.1: View Sales Report**
- [ ] Navigate to Laporan Penjualan
- [ ] **Expected**: Report screen shows:
  - Total Sales (IDR)
  - Total Transactions
  - Average Transaction Value (IDR)
  - Daily trend chart
  - Top 5 products table
  - Payment method breakdown

**Test Case 6.2: Filter by Date Range**
- [ ] Tap "From Date" picker
- [ ] Select date (e.g., 1 month ago)
- [ ] Tap "To Date" picker
- [ ] Select date (e.g., today)
- [ ] Tap "Apply" button
- [ ] **Expected**: Report updates with filtered data
- [ ] **Expected**: KPIs recalculated
- [ ] **Expected**: Chart and tables updated

**Test Case 6.3: Verify KPIs**
- [ ] Check Total Sales value
- [ ] Check Total Transactions count
- [ ] Check Average Transaction Value
- [ ] **Expected**: Average = Total Sales / Total Transactions

**Test Case 6.4: Verify Daily Trend**
- [ ] Check daily trend chart
- [ ] **Expected**: Each day shows sales amount
- [ ] **Expected**: Chart is scrollable if many days

**Test Case 6.5: Verify Top Products**
- [ ] Check top 5 products table
- [ ] **Expected**: Products sorted by quantity sold (descending)
- [ ] **Expected**: Each row shows: product name, quantity, revenue

**Test Case 6.6: Verify Payment Breakdown**
- [ ] Check payment method breakdown
- [ ] **Expected**: Shows: Cash, QRIS, Debit, Credit, E-Wallet
- [ ] **Expected**: Each shows: count and total amount
- [ ] **Expected**: Sum of all methods = Total Sales

---

### 7. Employee Management (Karyawan)

**Test Case 7.1: View Employee List**
- [ ] Navigate to Karyawan
- [ ] **Expected**: List of employees displayed
- [ ] **Expected**: Each item shows: name, position, phone, status

**Test Case 7.2: Filter by Status**
- [ ] Tap filter dropdown
- [ ] Select "Active"
- [ ] **Expected**: Only active employees shown
- [ ] Select "Inactive"
- [ ] **Expected**: Only inactive employees shown
- [ ] Select "Terminated"
- [ ] **Expected**: Only terminated employees shown
- [ ] Select "All"
- [ ] **Expected**: All employees shown

**Test Case 7.3: Filter by Department**
- [ ] Tap department filter dropdown
- [ ] Select "Sales"
- [ ] **Expected**: Only sales employees shown
- [ ] Select "Kitchen"
- [ ] **Expected**: Only kitchen employees shown
- [ ] Select "All"
- [ ] **Expected**: All employees shown

**Test Case 7.4: Search Employee**
- [ ] Enter name in search field: "John"
- [ ] **Expected**: Only employees with "John" in name shown
- [ ] Clear search
- [ ] Enter phone: "0812"
- [ ] **Expected**: Only employees with "0812" in phone shown

---

### 8. Error Handling & Edge Cases

**Test Case 8.1: Network Error**
- [ ] Turn off WiFi/mobile data
- [ ] Try to login
- [ ] **Expected**: Error message "Network error" or similar
- [ ] Turn on network
- [ ] Retry
- [ ] **Expected**: Login succeeds

**Test Case 8.2: API Timeout**
- [ ] (Simulate by stopping backend temporarily)
- [ ] Try to load any list
- [ ] **Expected**: Loading indicator shown
- [ ] **Expected**: Timeout error after ~30 seconds

**Test Case 8.3: Empty Lists**
- [ ] Navigate to a feature with no data
- [ ] **Expected**: Empty state message shown
- [ ] **Expected**: No crash

**Test Case 8.4: Back Navigation**
- [ ] Navigate deep into app (e.g., Home → Appointment → Detail)
- [ ] Press back button multiple times
- [ ] **Expected**: Navigate back through screens correctly
- [ ] **Expected**: Eventually return to Home

**Test Case 8.5: App Backgrounding**
- [ ] Login and navigate to any screen
- [ ] Press home button (background app)
- [ ] Wait 5 minutes
- [ ] Reopen app
- [ ] **Expected**: App resumes where you left off
- [ ] **Expected**: Session still valid (or re-login if token expired)

---

## Test Results

### Summary
- **Total Test Cases**: 0 / 80
- **Passed**: 0
- **Failed**: 0
- **Blocked**: 0
- **Not Tested**: 80

### Issues Found
(To be filled during testing)

| ID | Severity | Feature | Description | Steps to Reproduce |
|----|----------|---------|-------------|-------------------|
| - | - | - | - | - |

### Critical Bugs
(To be filled if any critical bugs found)

---

## Next Steps

1. **Manual Testing**: Go through all test cases above
2. **Document Issues**: Fill in "Issues Found" table
3. **Fix Critical Bugs**: Address any blocking issues
4. **Retest**: Verify fixes
5. **Update automation.md**: Document session results

---

## Notes

- **API Base URL**: http://103.74.5.44:3001
- **Token Expiry**: 15 minutes
- **Rate Limit**: 5 login attempts per 15 min
- **APK Location**: `apps/android/app/build/outputs/apk/staging/debug/app-staging-debug.apk`
- **Device**: 7XUGPNJZ8LDYQCCA (real device, not emulator)
