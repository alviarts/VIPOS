# Firebase Crashlytics - Quick Start

## Setup (One-time)

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Create project: `vipos-production`

2. **Add Android Apps**
   - Add 3 apps with package names:
     - `id.alviarts.vipos` (production)
     - `id.alviarts.vipos.dev` (development)
     - `id.alviarts.vipos.staging` (staging)

3. **Download google-services.json**
   - Download from Firebase Console
   - Place in: `apps/android/app/google-services.json`
   - **DO NOT commit to git!** (already in .gitignore)

4. **Build & Test**

   ```bash
   cd apps/android
   ./gradlew assembleDevDebug
   ./gradlew installDevDebug
   ```

5. **Verify in Firebase Console**
   - Wait 5-10 minutes after first crash
   - Check Firebase Console → Crashlytics

## Usage

### In ViewModels/Repositories

```kotlin
@Inject lateinit var crashlytics: CrashlyticsManager

try {
    // Risky operation
    val result = repository.syncData()
} catch (e: Exception) {
    crashlytics.logError(e, "Sync failed")
}
```

### Set User Context (After Login)

```kotlin
crashlytics.setUserId(user.id)
crashlytics.setCustomKey("tenant_id", user.tenantId)
crashlytics.setCustomKey("role", user.role)
```

### Clear Context (On Logout)

```kotlin
crashlytics.clearUserContext()
```

### Add Breadcrumbs

```kotlin
crashlytics.log("User clicked checkout")
crashlytics.log("Payment method selected: QRIS")
```

## Files Created

- `core/crashlytics/` - Crashlytics module
- `CrashlyticsManager.kt` - Main API
- `CrashlyticsModule.kt` - Hilt DI
- `docs/FIREBASE_CRASHLYTICS.md` - Full documentation
- `google-services.json.template` - Template file

## Next Steps

1. ✅ Setup Firebase project
2. ✅ Download google-services.json
3. ✅ Build and test
4. ⏳ Integrate in all ViewModels
5. ⏳ Setup alerts in Firebase Console

See `docs/FIREBASE_CRASHLYTICS.md` for complete guide.
