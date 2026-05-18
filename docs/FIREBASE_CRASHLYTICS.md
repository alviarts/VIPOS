# Firebase Crashlytics Setup Guide

## Overview

Firebase Crashlytics provides real-time crash reporting for VIPOS Android app. This helps detect and fix bugs in production quickly.

## Features Implemented

✅ **Crash Reporting**

- Automatic crash detection
- Stack traces with line numbers
- Device and OS information
- User journey breadcrumbs

✅ **Non-Fatal Error Logging**

- Log caught exceptions
- Custom error messages
- Warning levels

✅ **User Context**

- User ID tracking
- Custom key-value pairs
- Environment information

✅ **Breadcrumb Logging**

- Track user actions
- Debug user journey
- Understand crash context

---

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Project name: `vipos-production`
4. Enable Google Analytics (recommended)
5. Click "Create project"

### 2. Add Android App to Firebase

1. In Firebase Console, click "Add app" → Android
2. Package name: `id.alviarts.vipos`
3. App nickname: `VIPOS Production`
4. Click "Register app"

### 3. Add Additional Flavors

Repeat for dev and staging:

**Dev Flavor:**

- Package name: `id.alviarts.vipos.dev`
- App nickname: `VIPOS Dev`

**Staging Flavor:**

- Package name: `id.alviarts.vipos.staging`
- App nickname: `VIPOS Staging`

### 4. Download google-services.json

1. In Firebase Console, go to Project Settings
2. Download `google-services.json`
3. Place it in: `apps/android/app/google-services.json`

**IMPORTANT:** This file contains API keys. Add to `.gitignore`:

```gitignore
# Firebase
google-services.json
```

We've provided a template at `apps/android/app/google-services.json.template` for reference.

### 5. Enable Crashlytics

1. In Firebase Console, go to Crashlytics
2. Click "Enable Crashlytics"
3. Follow the setup wizard

### 6. Build and Test

```bash
cd apps/android

# Build dev variant
./gradlew assembleDevDebug

# Build production variant
./gradlew assembleProdRelease

# Install and run
./gradlew installDevDebug
```

### 7. Test Crash Reporting

Add a test crash button (remove in production):

```kotlin
Button(onClick = {
    throw RuntimeException("Test crash for Crashlytics")
}) {
    Text("Test Crash")
}
```

Or use the CrashlyticsManager:

```kotlin
crashlytics.logError(
    RuntimeException("Test error"),
    "Testing Crashlytics integration"
)
```

### 8. Verify in Firebase Console

1. Trigger a crash or error
2. Wait 5-10 minutes
3. Go to Firebase Console → Crashlytics
4. You should see the crash report

---

## Usage Examples

### Basic Error Logging

```kotlin
@Inject lateinit var crashlytics: CrashlyticsManager

try {
    // Risky operation
    syncDataToServer()
} catch (e: Exception) {
    crashlytics.logError(e, "Failed to sync data")
}
```

### Set User Context (After Login)

```kotlin
// In your login success handler
crashlytics.setUserId(user.id)
crashlytics.setCustomKey("tenant_id", user.tenantId)
crashlytics.setCustomKey("outlet_id", user.outletId)
crashlytics.setCustomKey("role", user.role)
crashlytics.setCustomKey("username", user.username)
```

### Clear User Context (On Logout)

```kotlin
// In your logout handler
crashlytics.clearUserContext()
```

### Add Breadcrumbs

```kotlin
// Track user actions
crashlytics.log("User opened checkout screen")
crashlytics.log("User added product: ${product.name}")
crashlytics.log("User selected payment method: ${paymentMethod}")
crashlytics.log("Transaction completed: ${transaction.id}")
```

### Log Warnings

```kotlin
if (stockLevel < minStock) {
    crashlytics.logWarning(
        "Low stock alert: ${product.name} (${stockLevel} remaining)"
    )
}
```

### Wrap Risky Operations

```kotlin
val result = crashlytics.runCatching("Sync inventory") {
    inventoryRepository.syncToServer()
}

if (result.isFailure) {
    // Handle error
    showErrorMessage("Sync failed")
}
```

### Extension Function

```kotlin
try {
    processPayment()
} catch (e: PaymentException) {
    e.logToCrashlytics(crashlytics, "Payment processing failed")
    showErrorDialog()
}
```

---

## Integration Points

### 1. Application Startup (MainActivity)

```kotlin
@Inject lateinit var crashlytics: CrashlyticsManager

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Initialize Crashlytics
    crashlytics.setCrashlyticsCollectionEnabled(true)
    crashlytics.setCustomKey("environment", BuildConfig.ENVIRONMENT)
    crashlytics.log("App started")
}
```

### 2. Login Flow

```kotlin
// LoginViewModel.kt
fun onLoginSuccess(user: User) {
    crashlytics.setUserId(user.id)
    crashlytics.setCustomKeys(mapOf(
        "tenant_id" to user.tenantId,
        "outlet_id" to user.outletId,
        "role" to user.role
    ))
    crashlytics.log("User logged in: ${user.username}")
}
```

### 3. Logout Flow

```kotlin
// SessionViewModel.kt
fun logout() {
    crashlytics.log("User logged out")
    crashlytics.clearUserContext()
    // ... rest of logout logic
}
```

### 4. Network Errors

```kotlin
// PosApi.kt or Repository
override suspend fun getProducts(): Result<List<Product>> {
    return try {
        val response = api.getProducts()
        Result.success(response)
    } catch (e: Exception) {
        crashlytics.logError(e, "Failed to fetch products")
        Result.failure(e)
    }
}
```

### 5. Database Errors

```kotlin
// ProductDao.kt or Repository
try {
    productDao.insert(product)
} catch (e: SQLiteException) {
    crashlytics.logError(e, "Database insert failed: ${product.id}")
    throw e
}
```

### 6. Payment Processing

```kotlin
// CheckoutViewModel.kt
fun processPayment(amount: Double, method: PaymentMethod) {
    crashlytics.log("Processing payment: $amount via $method")

    try {
        val result = paymentRepository.process(amount, method)
        crashlytics.log("Payment successful: ${result.transactionId}")
    } catch (e: PaymentException) {
        crashlytics.logError(e, "Payment failed: $amount via $method")
        _uiState.value = UiState.Error(e.message)
    }
}
```

---

## Best Practices

### ✅ DO

- ✅ Log all caught exceptions
- ✅ Set user context after login
- ✅ Clear user context on logout
- ✅ Add breadcrumbs for important actions
- ✅ Include relevant context (product ID, transaction ID, etc.)
- ✅ Use descriptive error messages
- ✅ Test crash reporting in staging first

### ❌ DON'T

- ❌ Log sensitive data (passwords, credit cards, PINs)
- ❌ Log PII without user consent (full names, addresses, phone numbers)
- ❌ Spam logs with too many breadcrumbs
- ❌ Ignore non-fatal errors
- ❌ Forget to clear user context on logout

---

## Monitoring & Alerts

### Firebase Console

1. **Crashlytics Dashboard**
   - View crash-free users %
   - Top crashes by occurrence
   - Affected users count

2. **Issue Details**
   - Stack trace
   - Device information
   - OS version
   - App version
   - Custom keys
   - Breadcrumbs

3. **Velocity Alerts**
   - Set up email alerts for:
     - New crashes
     - Crash spike (> X% increase)
     - Regressed issues

### Setup Alerts

1. Go to Firebase Console → Crashlytics
2. Click "Alerts" tab
3. Configure:
   - **New issue alert**: Notify on first occurrence
   - **Velocity alert**: Notify if crash rate > 1%
   - **Regressed issue alert**: Notify if fixed issue reappears

---

## Troubleshooting

### Crashes Not Appearing in Console

**Wait 5-10 minutes** - Crashlytics has a delay

**Check internet connection** - Reports upload when online

**Verify google-services.json** - Must match package name

**Check Crashlytics is enabled:**

```kotlin
crashlytics.setCrashlyticsCollectionEnabled(true)
```

**Force send reports:**

```kotlin
crashlytics.sendUnsentReports()
```

### Build Errors

**Missing google-services.json:**

```
Error: File google-services.json is missing
```

Solution: Download from Firebase Console

**Package name mismatch:**

```
Error: No matching client found for package name
```

Solution: Add all flavors to Firebase project

### ProGuard Issues

If crashes show obfuscated stack traces, ensure ProGuard mapping files are uploaded:

```bash
./gradlew assembleProdRelease
# Mapping file: app/build/outputs/mapping/prodRelease/mapping.txt
```

Firebase Gradle plugin auto-uploads mapping files.

---

## Performance Impact

Crashlytics has **minimal performance impact**:

- **App size:** +200KB
- **Memory:** +2-5MB
- **CPU:** Negligible
- **Network:** Reports sent in background, batched

---

## Privacy & Compliance

### GDPR Compliance

- ✅ User can opt-out:

  ```kotlin
  crashlytics.setCrashlyticsCollectionEnabled(false)
  ```

- ✅ Delete user data:
  ```kotlin
  crashlytics.deleteUnsentReports()
  crashlytics.clearUserContext()
  ```

### Data Collected

- Crash stack traces
- Device model & OS version
- App version
- Custom keys (you control this)
- User ID (you set this)
- Breadcrumbs (you log this)

**NOT collected:**

- User's personal data (unless you log it)
- Screen content
- User input

---

## Next Steps

1. ✅ Setup Firebase project
2. ✅ Download google-services.json
3. ✅ Build and test
4. ✅ Integrate in ViewModels and Repositories
5. ✅ Setup alerts in Firebase Console
6. ✅ Monitor crash-free users %
7. ✅ Fix top crashes

---

## Support

- **Firebase Docs:** https://firebase.google.com/docs/crashlytics
- **Android Guide:** https://firebase.google.com/docs/crashlytics/get-started?platform=android
- **Best Practices:** https://firebase.google.com/docs/crashlytics/best-practices

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production ✅
