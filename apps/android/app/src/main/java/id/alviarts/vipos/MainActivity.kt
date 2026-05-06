package id.alviarts.vipos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import id.alviarts.vipos.core.common.AppConfig
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    /**
     * Field-injected via Hilt (P3-01b). Concrete provision lives in
     * [id.alviarts.vipos.di.AppModule]. The presence of this
     * `@Inject` site on top of `@AndroidEntryPoint` is what proves
     * the Hilt graph is wired end-to-end at runtime — `assembleDebug`
     * fails fast at code-gen time if anything is misconfigured.
     */
    @Inject lateinit var appConfig: AppConfig

    override fun onCreate(savedInstanceState: Bundle?) {
        // P3-01e: install the system splash window before
        // super.onCreate() so the Theme.VIPOS.Splash background is
        // shown for the duration of the JVM warm-up, then transparently
        // transitions to Theme.VIPOS once Compose mounts.
        installSplashScreen()

        super.onCreate(savedInstanceState)
        setContent {
            VIPOSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    BootstrapScreen(
                        appName = appConfig.appName,
                        versionName = appConfig.versionName,
                        environment = appConfig.environment,
                        apiBaseUrl = appConfig.apiBaseUrl,
                    )
                }
            }
        }
    }
}

@Composable
private fun BootstrapScreen(
    appName: String,
    versionName: String,
    environment: String,
    apiBaseUrl: String,
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = appName,
                style = MaterialTheme.typography.displayMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = "Phase 3 — Android Kasir MVP",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = "v$versionName • $environment",
                style = MaterialTheme.typography.labelMedium,
            )
            Text(
                text = apiBaseUrl,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun BootstrapScreenPreview() {
    VIPOSTheme {
        BootstrapScreen(
            appName = "VIPOS",
            versionName = "0.0.1-dev",
            environment = "dev",
            apiBaseUrl = "http://10.0.2.2:3001",
        )
    }
}
