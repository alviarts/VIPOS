package id.alviarts.vipos.feature.auth.biometric

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * Biometric authentication helper (P3-03 AC #3).
 *
 * Wraps AndroidX BiometricPrompt for fingerprint/face unlock.
 * Falls back to device credential (PIN/pattern) if biometric
 * hardware is not available.
 *
 * Usage:
 * ```
 * if (BiometricHelper.isAvailable(context)) {
 *     BiometricHelper.authenticate(activity) { success ->
 *         if (success) { /* proceed */ }
 *     }
 * }
 * ```
 */
object BiometricHelper {

    /**
     * Check if biometric authentication is available on this device.
     */
    fun isAvailable(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        return when (manager.canAuthenticate(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Check if strong biometric (fingerprint/face) is enrolled.
     */
    fun hasStrongBiometric(context: Context): Boolean {
        val manager = BiometricManager.from(context)
        return manager.canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Show biometric prompt. Calls [onResult] with true on success,
     * false on failure/cancel.
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String = "Verifikasi Identitas",
        subtitle: String = "Gunakan sidik jari atau wajah untuk melanjutkan",
        onResult: (Boolean) -> Unit,
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onResult(true)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                onResult(false)
            }

            override fun onAuthenticationFailed() {
                // Don't call onResult here — the system shows "try again"
                // and the user can retry. Only terminal states (succeeded/error)
                // should resolve the callback.
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
            .build()

        prompt.authenticate(promptInfo)
    }
}
