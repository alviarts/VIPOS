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

| Sub-PR | Adds                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| P3-01b | Hilt DI + real Material 3 theme (teal #04C99E primary, typography)                      |
| P3-01c | Modular split — `:core:designsystem`, `:core:network`, `:core:database`, `:core:common` |
| P3-01d | Build flavors (`dev` / `staging` / `prod`) + ProGuard rules + signing                   |
| P3-01e | App icon, splash screen, dev-setup polish                                               |
| P3-01f | Crashlytics + Analytics (needs Firebase project / `google-services.json` from founder)  |

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
