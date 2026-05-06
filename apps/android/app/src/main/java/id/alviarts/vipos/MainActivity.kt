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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            VIPOSPlaceholderTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    BootstrapScreen()
                }
            }
        }
    }
}

@Composable
private fun BootstrapScreen() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "VIPOS",
                style = MaterialTheme.typography.displayMedium,
            )
            Text(
                text = "Phase 3 — Android Kasir MVP",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

// Minimal MaterialTheme wrapper. PR P3-02 will replace this with
// the real `core:designsystem` theme (teal #04C99E primary,
// typography, shapes per phase_3_android_kasir_mvp.md).
@Composable
private fun VIPOSPlaceholderTheme(content: @Composable () -> Unit) {
    MaterialTheme(content = content)
}

@Preview(showBackground = true)
@Composable
private fun BootstrapScreenPreview() {
    VIPOSPlaceholderTheme {
        BootstrapScreen()
    }
}
