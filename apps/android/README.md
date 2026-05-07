# apps/android — VIPOS Mobile (Phase 3)

VIPOS Android Kasir (Point-of-Sale) MVP.
See [`docs/v3/workflow/phase_3_android_kasir_mvp.md`](../../docs/v3/workflow/phase_3_android_kasir_mvp.md) for the full Phase-3 task list.

## Status

This module was bootstrapped in **PR P3-01a**. Currently:

- Gradle 8.7 (wrapper) + Android Gradle Plugin 8.5.2 + Kotlin 1.9.24
- Single `:app` module with a blank Compose `MainActivity` ("VIPOS" placeholder text).
- Min SDK 21 (Android 5.0), Target SDK 34 (Android 14).
- Built and verified with `./gradlew :app:assembleDebug` locally and in CI (`.github/workflows/android.yml`).

Subsequent sub-PRs in the P3-01 series will add:

| Sub-PR     | Status         | Adds                                                                                    |
| ---------- | -------------- | --------------------------------------------------------------------------------------- |
| P3-01a     | done (PR #184) | Gradle wrapper + minimal `:app` Compose blank screen + Android CI workflow              |
| P3-01b     | done (PR #186) | Hilt DI scaffold (`@HiltAndroidApp` + `@AndroidEntryPoint` + `AppModule`)               |
| P3-01e     | done (PR #187) | App icon (adaptive + PNG fallbacks) + splash screen + brand colors                      |
| P3-01c     | done (PR #188) | Modular split — `:core:common`, `:core:designsystem`, `:core:network`, `:core:database` |
| P3-01d     | done (PR #189) | Build flavors (`dev` / `staging` / `prod`) + per-flavor `BuildConfig` + CI matrix       |
| P3-01f     | blocked        | Crashlytics + Analytics (needs Firebase project / `google-services.json` from founder)  |
| P3-02      | done (PR #191) | Real Material 3 design system — full ColorScheme (light + dark), typography, shapes     |
| P3-05      | done (PR #193) | Network client — OkHttp + Retrofit + kotlinx-serialization wired through Hilt           |
| P3-03a     | done (PR #194) | Auth feature data layer — `AuthApi` + `TokenStorage` (DataStore) + `AuthRepository`     |
| P3-04      | done (PR #195) | Room database scaffold — `VIPOSDatabase` + `KeyValueCacheEntity` + DAO + Hilt providers |
| P3-03b     | done (PR #196) | LoginScreen Compose + `LoginViewModel` + replaces bootstrap surface in `MainActivity`   |
| P3-08      | done (PR #197) | Navigation graph — `VIPOSNavHost` + `:feature:home` placeholder + login → home wiring   |
| P3-03d     | done (PR #199) | Auto-login restoration — persist user snapshot in DataStore + `SessionGate` skips login |
| **P3-03c** | this PR        | 2FA challenge UI — `TwoFactorScreen` + `verify2fa` API + Login → TwoFactor → Home wire  |

### Database (`:core:database`)

After **P3-04** the database module ships a real Room scaffold:

- **`VIPOSDatabase`** — `@Database(entities = [KeyValueCacheEntity::class], version = 1, exportSchema = true)` — root of the persistence graph. Versioning rules documented in the class kdoc; bump version + add `Migration` for every schema change.
- **`entity/KeyValueCacheEntity`** — generic `(key TEXT PK, value TEXT, updated_at INTEGER)` row. Lives in this module to exercise the Room → KSP → Hilt wiring end-to-end. Real Phase 3 entities (products, transactions, …) drop into the same module in P3-06+.
- **`dao/KeyValueCacheDao`** — exposes both blocking-suspend (`get(key)`) and reactive (`observe(key)`) readers plus an atomic `@Upsert` writer.
- **`schemas/id.alviarts.vipos.core.database.VIPOSDatabase/1.json`** — auto-exported by KSP. **Do not edit by hand.** Subsequent schema changes export new files (`2.json`, …); the CI guard added in **P3-09** (see "Verify Room schema exports are committed" step in `.github/workflows/android.yml`) rejects PRs that regenerate the JSON without committing the result, catching both in-place edits and missing version-bumped files.
- **Hilt providers in `:app/AppModule`** — `provideVIPOSDatabase(@ApplicationContext)` and `provideKeyValueCacheDao(database)`. Builder defaults are deliberate: no `fallbackToDestructiveMigration()` (every change MUST ship an explicit migration), no `allowMainThreadQueries()` (suspend / Flow only).

| Token         | Pinned version |
| ------------- | -------------- |
| androidx.room | 2.6.1          |

### Auth feature (`:feature:auth`)

After **P3-03a + P3-03b** the auth module ships the full username/password login flow:

- **`data/AuthApi`** — Retrofit interface for `POST /api/v1/auth/login` + `POST /api/v1/auth/logout`.
- **`data/AuthDto`** — `LoginRequestDto`, `LoginResponseDto` (covers both happy-path + 2FA-challenge shapes via nullable fields), `AuthUserDto`, `LogoutRequestDto` — all `@Serializable` with snake_case `@SerialName`.
- **`domain/TokenStorage`** + **`data/DataStoreTokenStorage`** — DataStore Preferences-backed atomic store for `accessToken` / `refreshToken` / `accessExpiresAtEpochSec`. Survives process death + app upgrades; encrypted-at-rest by the OS userdata partition.
- **`domain/AuthRepository`** — `suspend fun login(username, password, rememberMe): LoginResult` with full error branching (`Success` / `Requires2FA` / `Failure`); persists tokens before returning.
- **`di/AuthModule`** — Hilt `@Module` that provides `AuthApi` from the application-scoped `Retrofit` (P3-05) and `TokenStorage` backed by the application context. Discovered automatically by `:app`'s Hilt KSP processor — no `:app/AppModule` registration required.
- **`ui/LoginUiState`** — single immutable state object (`username` / `password` / `rememberMe` / `authStatus` / `errorMessage`) + sealed `AuthStatus` (`Idle` / `Submitting` / `Authenticated` / `Requires2FA`).
- **`ui/LoginViewModel`** — `@HiltViewModel` that wraps `AuthRepository.login()`, exposes a single `StateFlow<LoginUiState>`, and handles all branch translation (HttpException → `errorMessage`, `Success` → `Authenticated`, etc.).
- **`ui/LoginScreen`** — full Material 3 Compose UI: VIPOS branding, username + password text fields with proper IME actions + password masking, "Ingat saya" checkbox, primary submit button with inline progress indicator, error banner using `errorContainer` color role.
- **`ui/AuthRoute`** — entry composable used by `MainActivity` (and the eventual nav graph in P3-08). Resolves the `LoginViewModel` through `hiltViewModel()` and switches between the form, the post-auth surface, and the 2FA placeholder based on `authStatus`.

The 2FA challenge UI (`POST /api/v1/auth/login/2fa`) and the navigation graph (login → home transition) land in **P3-03c** + **P3-08**.

| Token                          | Pinned version |
| ------------------------------ | -------------- |
| androidx.datastore-preferences | 1.1.1          |
| kotlinx-coroutines-android     | 1.8.1          |

### Network client (`:core:network`)

After **P3-05** the network module ships an honest OkHttp + Retrofit + kotlinx-serialization stack:

- **`NetworkClientFactory`** (Hilt-free) — `provideOkHttpClient(loggingEnabled)` and `provideRetrofit(baseUrl, okHttp, json)` factory methods plus a shared `Json` codec configured with `ignoreUnknownKeys = true` / `coerceInputValues = true` / `isLenient = true` (defends against backend nullability / additive drift).
- **`api/HealthApi`** + **`api/HealthResponse`** — smallest-possible Retrofit interface hitting `GET /api/v1/health`. Exists to prove the wiring compiles and instantiates end-to-end; **not** called on cold-start.
- **Hilt providers in `:app/AppModule`** — wires `Json` / `OkHttpClient` / `Retrofit` / `HealthApi` singletons keyed off `AppConfig.apiBaseUrl` (P3-01d). HTTP body logging is auto-enabled for dev + staging flavors and auto-disabled for prod.
- The networking primitives are exposed as `api` (not `implementation`) deps from `:core:network` so the Hilt processor in `:app` can resolve `@Provides` return types.

| Token        | Pinned version                                   |
| ------------ | ------------------------------------------------ |
| OkHttp       | 4.12.0                                           |
| Retrofit     | 2.11.0                                           |
| converter    | retrofit2:converter-kotlinx-serialization 2.11.0 |
| kotlinx-json | 1.6.3                                            |

### Design system (`:core:designsystem`)

After **P3-02** the design system module ships the full Material 3 trio:

- **Colors** (`theme/Color.kt`) — light + dark `ColorScheme` tokens derived from the brand teal `#04C99E` via the M3 HCT tonal palette generator. All M3 roles are wired (primary / secondary / tertiary / error / surface / surfaceVariant / outline / inverse / scrim).
- **Typography** (`theme/Type.kt`) — full 15-style M3 type scale (display / headline / title / body / label, each at Large / Medium / Small). Uses `FontFamily.Default` (Roboto on Android) so a future custom-font swap is a one-line change.
- **Shapes** (`theme/Shape.kt`) — canonical M3 corner-radius scale (`extraSmall=4dp`, `small=8dp`, `medium=12dp`, `large=16dp`, `extraLarge=28dp`).
- **`VIPOSTheme(darkTheme, dynamicColor, content)`** — picks `LightColors` / `DarkColors` based on `darkTheme` (defaulted to system). When `dynamicColor = true` AND running on Android 12+, the OS-derived Material You palette wins instead — opt-in only because canonical brand surfaces should remain on-brand.

### Build flavors

After P3-01d the `:app` module ships three product flavors along the
`environment` dimension:

| Flavor    | applicationId               | versionName suffix | API base URL           |
| --------- | --------------------------- | ------------------ | ---------------------- |
| `dev`     | `id.alviarts.vipos.dev`     | `-dev`             | `http://10.0.2.2:3001` |
| `staging` | `id.alviarts.vipos.staging` | `-staging`         | `http://103.74.5.44`   |
| `prod`    | `id.alviarts.vipos`         | _(none)_           | `https://vipos.id`     |

- The distinct `applicationId` values mean dev / staging / prod APKs
  can coexist on the same device without uninstall churn.
- `BuildConfig.ENVIRONMENT` and `BuildConfig.API_BASE_URL` are
  injected per flavor and surfaced through `AppConfig`
  (`:core:common`) into the bootstrap UI so the active flavor is
  visually obvious on a device.
- Build any flavor locally with the matching task:
  `./gradlew :app:assembleDevDebug` / `:app:assembleStagingDebug` /
  `:app:assembleProdDebug`. CI builds dev + staging on every push and
  uploads both APKs as artifacts.
- Release signing (and R8 / `isMinifyEnabled = true`) is intentionally
  deferred — `proguard-rules.pro` is wired into `release` builds so
  custom keep rules can land alongside the eventual signing config in
  a follow-up sub-PR.

### Module structure

After P3-01c the project graph is:

```
:app
├── :core:common         (shared value types — AppConfig)
├── :core:designsystem   (VIPOSTheme + Material 3 color scheme)
├── :core:network        (placeholder; OkHttp/Retrofit primitives in P3-05)
└── :core:database       (placeholder; Room primitives in P3-04)
```

- `:core:*` modules are AGP `library` modules (`com.android.library`).
  Each has its own `namespace` (e.g. `id.alviarts.vipos.core.common`)
  and the same Java 17 / Kotlin 1.9.24 / Compose 1.5.14 toolchain as
  `:app`.
- Hilt code-gen stays in `:app` only; `:core:*` modules can declare
  `@Inject` constructors / `@Provides` modules, but the
  annotation-processing classpath is set up exclusively at the
  application module today.
- New feature modules will follow the same pattern under `:feature:*`.

### Branding

- **Primary color**: VIPOS teal `#04C99E` (matches the Majoo brand).
  See `app/src/main/res/values/colors.xml` for the active subset
  (`vipos_teal`, `vipos_teal_dark`, `vipos_on_teal`, `splash_background`).
  P3-02 will expand this into the full Material 3 ColorScheme inside
  `:core:designsystem`.
- **Launcher icon**: white `V` mark on a teal background. The
  adaptive icon (API 26+) lives at `mipmap-anydpi-v26/ic_launcher.xml`
  and references the vector drawables under `drawable/ic_launcher_*.xml`.
  PNG fallbacks at every standard mipmap density (`mdpi` / `hdpi` /
  `xhdpi` / `xxhdpi` / `xxxhdpi`) cover API 21–25. The themed
  monochrome layer is also wired so Android 13+ honours the user's
  themed-icon preference.
- **Splash screen**: backed by `androidx.core:core-splashscreen`. The
  launcher activity uses `Theme.VIPOS.Splash` (parent
  `Theme.SplashScreen`); `MainActivity.onCreate` calls
  `installSplashScreen()` before `super.onCreate(...)` to swap to the
  post-splash `Theme.VIPOS`.

## Local dev setup

### Prerequisites

- **JDK 17** (Temurin recommended). Verify: `java -version`.
- **Android SDK** with `platforms;android-34` and `build-tools;34.0.0` installed.

### Install Android SDK from scratch

```bash
# Download command-line tools
mkdir -p "$HOME/android-sdk/cmdline-tools"
curl -sSL -o /tmp/cmdline-tools.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/cmdline-tools.zip -d "$HOME/android-sdk/cmdline-tools/"
mv "$HOME/android-sdk/cmdline-tools/cmdline-tools" "$HOME/android-sdk/cmdline-tools/latest"

# Wire it onto PATH
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# Accept licenses + install required packages
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Persist `ANDROID_HOME` + `PATH` in your shell rc (`~/.bashrc` / `~/.zshrc`) so future sessions don't have to repeat the export step.

### Tell Gradle where the SDK lives

Either rely on `$ANDROID_HOME` (recommended) **or** create `apps/android/local.properties`:

```properties
sdk.dir=/home/<user>/android-sdk
```

`local.properties` is gitignored — never commit it.

### Build

```bash
cd apps/android
./gradlew :app:assembleDebug
# APK output: apps/android/app/build/outputs/apk/debug/app-debug.apk
```

First run downloads ~500 MB of Gradle + AGP + Compose dependencies and takes ~1.5–2 min on a warm cache, ~5 min cold.

## CI

`.github/workflows/android.yml` runs on every push/PR that touches `apps/android/**` or the workflow itself. The job:

1. Sets up JDK 17 (Temurin).
2. Installs Android SDK via `android-actions/setup-android@v3`.
3. Caches `~/.gradle/{caches,wrapper}` keyed by `*.gradle*` + `libs.versions.toml`.
4. Runs `./gradlew :app:assembleDebug --no-daemon --stacktrace`.
5. Uploads the resulting `app-debug.apk` as a 7-day-retention artifact (`vipos-android-debug-apk`).

The path-filter keeps web/backend-only PRs from incurring the ~2 min Gradle cold-start.

## Stack (target — populated across the P3 sub-PRs)

- **Language**: Kotlin
- **UI**: Jetpack Compose + Material 3
- **DI**: Hilt
- **Local DB**: Room
- **Network**: Retrofit + OkHttp + Moshi (or Kotlinx Serialization)
- **Sync**: WorkManager + custom outbox
- **Adaptive layout**: WindowSizeClass API
- **Hardware**: Bluetooth Classic (ESC/POS), Camera2 + ML Kit (barcode), USB Host (scanner HID), CashDrawer via printer
- **Push**: Firebase Cloud Messaging
- **Crash**: Firebase Crashlytics
- **Analytics**: Firebase Analytics
- **Min SDK**: 21 (Android 5.0)
- **Target SDK**: 34 (Android 14)
