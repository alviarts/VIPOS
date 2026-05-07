package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosRepository
import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the variant / modifier sheet (P3-07 second slice).
 *
 * Responsibilities:
 *  - Trigger an authenticated `GET /api/v1/products/:id/variants`
 *    when the kasir taps a catalogue card. The OkHttp
 *    [id.alviarts.vipos.core.network.AuthInterceptor] decorates
 *    the request — same as
 *    [id.alviarts.vipos.feature.pos.ui.PosCatalogueViewModel].
 *  - Maintain the [PosVariantUiState] lifecycle. The state stays
 *    live for the duration of the sheet; dismissing the sheet
 *    is owned by the calling screen, which simply stops
 *    collecting [uiState].
 *
 * Errors from the variant fetch land in
 * [VariantLoadStatus.Failed] with a human-readable Indonesian
 * message; the ViewModel does NOT distinguish 401 here. The
 * 401 path is owned by the [id.alviarts.vipos.core.network.RefreshTokenAuthenticator] that
 * shipped in P3-03e — a 401 from the variants endpoint will
 * trigger a transparent token rotation and a single retry; only
 * if that retry also 401s does the failure surface here, and
 * even then `SessionInvalidationInterceptor` clears
 * [id.alviarts.vipos.feature.auth.domain.TokenStorage] so the
 * `SessionGate` routes back to login on the next composition.
 *
 * Selection state (which option is active in each group) is
 * intentionally NOT modelled yet — that lands in the third slice
 * once the cart-line wiring is in scope. This ViewModel owns
 * fetch + parse + grouped-display only.
 */
@HiltViewModel
class PosVariantViewModel @Inject constructor(
    private val repository: PosRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PosVariantUiState())
    val uiState: StateFlow<PosVariantUiState> = _uiState.asStateFlow()

    private var inFlightJob: Job? = null

    /**
     * Open the sheet for [productId] and kick off the fetch.
     *
     * Calling this while a fetch is already in flight for the
     * SAME `productId` is a no-op — protects against rapid taps
     * on the catalogue card from firing parallel requests.
     * Calling it for a DIFFERENT `productId` cancels the
     * outstanding fetch (so a stale response can never overwrite
     * a fresh one) and clears the previous groups so the sheet
     * doesn't briefly flash the wrong product's options.
     */
    fun loadFor(productId: Long) {
        val current = _uiState.value
        if (current.loadStatus is VariantLoadStatus.Loading && current.productId == productId) {
            return
        }
        // Cancel any in-flight request for a different product. The
        // ViewModel doesn't enforce single-product-per-instance —
        // letting `loadFor` re-target keeps the call site simpler
        // for sheets that re-bind across catalogue taps.
        inFlightJob?.cancel()
        _uiState.update {
            val isPivot = it.productId != productId
            it.copy(
                productId = productId,
                groups = if (isPivot) emptyList() else it.groups,
                // Pivot: clear selections so the mid-pivot state doesn't
                // reference the previous product's option ids. Same-product
                // re-fetch (retry) keeps the selection map so the kasir's
                // picks survive a transient network blip.
                selectedOptionIdsByGroup = if (isPivot) emptyMap() else it.selectedOptionIdsByGroup,
                loadStatus = VariantLoadStatus.Loading,
            )
        }

        inFlightJob = viewModelScope.launch {
            val result = repository.loadVariants(productId)
            _uiState.update { state ->
                // Discard the result if the kasir pivoted to a different
                // product mid-flight. The cancel() above handles most
                // cases, but `runCatching { … }` inside the repository
                // will still complete the result if the cancel landed
                // after the suspend boundary returned — defensive guard
                // here keeps stale results from ever surfacing.
                if (state.productId != productId) return@update state
                result.fold(
                    onSuccess = { groups ->
                        state.copy(
                            loadStatus = VariantLoadStatus.Loaded,
                            groups = groups,
                            // Auto-pick the default option in each group on first
                            // Loaded — see [autoDefaultSelections]. Pivot-to-different
                            // product cleared the previous selections in the
                            // synchronous Loading transition above, so we never carry
                            // stale picks across products.
                            selectedOptionIdsByGroup = autoDefaultSelections(groups),
                        )
                    },
                    onFailure = { throwable ->
                        state.copy(
                            loadStatus = VariantLoadStatus.Failed(
                                message = throwable.localizedMessage
                                    ?: throwable.message
                                    ?: DEFAULT_ERROR_MESSAGE,
                            ),
                        )
                    },
                )
            }
        }
    }

    /**
     * Pick [optionId] inside [groupName]. Replaces any previous
     * selection in the same group; selections in other groups
     * are untouched.
     *
     * Silently no-ops if [groupName] doesn't match any loaded
     * group, or if [optionId] doesn't belong to that group's
     * options. The Compose layer wires this directly to the
     * radio-row tap, so a defensive no-op (rather than a throw)
     * keeps a future race between a tap and a re-fetch from
     * crashing the sheet.
     */
    fun selectOption(groupName: String, optionId: Long) {
        _uiState.update { state ->
            val group = state.groups.firstOrNull { it.name == groupName } ?: return@update state
            if (group.options.none { it.id == optionId }) return@update state
            state.copy(
                selectedOptionIdsByGroup = state.selectedOptionIdsByGroup + (groupName to optionId),
            )
        }
    }

    /**
     * Re-fetch variants for the currently-targeted product. No-op
     * if no product has been loaded yet. Use this for the retry
     * button on the sheet's error banner.
     */
    fun retry() {
        val productId = _uiState.value.productId ?: return
        loadFor(productId)
    }

    private companion object {
        private const val DEFAULT_ERROR_MESSAGE: String =
            "Tidak bisa memuat varian produk. Coba lagi."

        /**
         * Auto-pick one option per group on first Loaded:
         *  1. The option flagged `isDefault=true` if any (matches
         *     the backend's `is_default` semantics — there should
         *     only ever be one default per group, but the backend
         *     doesn't enforce that, so the FIRST default-flagged
         *     row wins as a deterministic tie-break).
         *  2. Otherwise the first option in display order
         *     (already sorted by [PosRepository] before reaching
         *     here).
         *
         * Groups with zero options are skipped (defensive — the
         * repository drops malformed group rows so this shouldn't
         * happen in practice).
         */
        private fun autoDefaultSelections(
            groups: List<ProductVariantGroup>,
        ): Map<String, Long> = buildMap {
            for (group in groups) {
                val pick = group.options.firstOrNull { it.isDefault }
                    ?: group.options.firstOrNull()
                    ?: continue
                put(group.name, pick.id)
            }
        }
    }
}
