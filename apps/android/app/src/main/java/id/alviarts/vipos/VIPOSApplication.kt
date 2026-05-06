package id.alviarts.vipos

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application entry point for Hilt's dependency-injection graph
 * (P3-01b). The `@HiltAndroidApp` annotation triggers Hilt's
 * code generation and creates the application-level
 * `SingletonComponent` that downstream `@AndroidEntryPoint`
 * activities, fragments, and services attach to.
 *
 * Registered via `android:name=".VIPOSApplication"` in
 * `AndroidManifest.xml`.
 */
@HiltAndroidApp
class VIPOSApplication : Application()
