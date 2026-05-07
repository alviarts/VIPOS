package id.alviarts.vipos

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import id.alviarts.vipos.core.common.AppConfig
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.navigation.SessionGate
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
        Log.i(TAG_BOOT, "cold start in env=${appConfig.environment}")
        setContent {
            VIPOSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    // P3-03d: the SessionGate decides the nav
                    // graph's startDestination — when a session
                    // can be restored from DataStore we boot
                    // straight into home and skip the login form;
                    // otherwise we fall through to the standard
                    // login → home flow.
                    SessionGate(
                        onRequires2FA = { token ->
                            Log.i(
                                TAG_AUTH,
                                "2FA challenge issued (login_token=${token.take(8)}…)",
                            )
                        },
                    )
                }
            }
        }
    }

    private companion object {
        const val TAG_AUTH = "VIPOS.Auth"
        const val TAG_BOOT = "VIPOS.Boot"
    }
}
