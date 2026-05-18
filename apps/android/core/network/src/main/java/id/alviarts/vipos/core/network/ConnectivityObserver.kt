package id.alviarts.vipos.core.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Reactive observer for device network connectivity state.
 *
 * Exposes a [Flow<Boolean>] that emits `true` when the device
 * has an active network with internet capability, and `false`
 * when it doesn't.
 *
 * Usage from a Composable:
 * ```
 * val isOnline by connectivityObserver
 *     .observe()
 *     .collectAsStateWithLifecycle(initialValue = true)
 * ```
 *
 * The interface is intentionally thin so unit tests can
 * substitute a fake (e.g. `MutableStateFlow(true)`) without
 * pulling in Android framework classes.
 */
interface ConnectivityObserver {
    /** Observe connectivity changes as a [Flow]. */
    fun observe(): Flow<Boolean>
}

/**
 * Production [ConnectivityObserver] backed by the system
 * [ConnectivityManager].
 *
 * This class is intentionally Hilt-free — the `:app` module's
 * `AppModule` provides it as a singleton via `@Provides` using
 * the application `Context`. Feature modules consume the
 * [ConnectivityObserver] interface through Hilt injection.
 *
 * @param context application context (not activity) to avoid
 *   leaking the activity's window/view hierarchy.
 */
class AndroidConnectivityObserver(context: Context) : ConnectivityObserver {

    private val connectivityManager: ConnectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    /**
     * Snapshot the current connectivity state synchronously.
     * Useful for one-shot checks (e.g. gating a button tap)
     * without subscribing to the flow.
     */
    fun isOnlineNow(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /**
     * Observe connectivity changes as a [Flow<Boolean>].
     *
     * Emits the current state immediately on collection, then
     * emits on every subsequent change. The flow never completes
     * on its own — it stays active as long as the collector is
     * alive. Cancelling the collector unregisters the system
     * callback automatically via [awaitClose].
     *
     * The flow is conflated + distinctUntilChanged so downstream
     * collectors only see actual state transitions, not redundant
     * callbacks from the system.
     */
    override fun observe(): Flow<Boolean> = callbackFlow {
        // Emit current state immediately.
        trySend(isOnlineNow())

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }

            override fun onLost(network: Network) {
                trySend(false)
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities,
            ) {
                val hasInternet = networkCapabilities
                    .hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                trySend(hasInternet)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)

        awaitClose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }.conflate().distinctUntilChanged()
}
