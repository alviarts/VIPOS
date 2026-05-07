package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.domain.CartItem
import id.alviarts.vipos.feature.pos.domain.Product
import java.text.NumberFormat
import java.util.Locale

/**
 * Composable entry point for the POS catalogue screen (P3-06).
 *
 * Layout:
 *  - TopAppBar with back arrow + manual refresh action.
 *  - Catalogue list (LazyColumn) of [Product]s with
 *    add-to-cart buttons. While the first fetch is in flight
 *    the list area shows a centered progress indicator; on
 *    failure it shows an error card with a retry button.
 *  - Cart panel pinned at the bottom with running subtotal
 *    + per-line qty steppers + checkout placeholder.
 *
 * Stays single-pane on phone and tablet alike; the proper
 * responsive 2/3-column layout (catalogue + cart side-by-side
 * on tablet landscape) lands with the full P3-06+ spec in
 * `phase_3_android_kasir_mvp.md`. Today the priority is to
 * prove the authenticated `GET /api/v1/products` round-trip
 * end-to-end — the kasir UX polish is incremental from there.
 */
@Composable
fun PosCatalogueRoute(
    onBack: () -> Unit,
    catalogueViewModel: PosCatalogueViewModel = hiltViewModel(),
    variantViewModel: PosVariantViewModel = hiltViewModel(),
) {
    val state by catalogueViewModel.uiState.collectAsStateWithLifecycle()
    val variantState by variantViewModel.uiState.collectAsStateWithLifecycle()

    // Per-tap target product. Held at the route level (not inside
    // either ViewModel) because the sheet is a UI-mode concern that
    // the kasir can dismiss at any time — the catalogue VM doesn't
    // need to know about it, and the variant VM is intentionally
    // ignorant of which product entry point opened it. `null` means
    // no sheet is currently open.
    var pendingProduct by remember { mutableStateOf<Product?>(null) }

    PosCatalogueScreen(
        state = state,
        onBack = onBack,
        onRefresh = catalogueViewModel::refresh,
        onAddToCart = { product ->
            // P3-07 fifth slice: the "Tambah" button now opens the
            // variant sheet. Even products with zero variants flow
            // through the sheet — they just land in the
            // Loaded-empty body shape with the CTA enabled, so a
            // single confirm-tap adds them to the cart with zero
            // uplift. Skipping the sheet on known-no-variant
            // products is a P3-08+ optimization once the catalogue
            // payload includes a `has_variants` flag; until then,
            // one extra confirm-tap is the simplest semantics.
            pendingProduct = product
            variantViewModel.loadFor(product.id)
        },
        onIncrement = catalogueViewModel::increment,
        onDecrement = catalogueViewModel::decrement,
        onRemoveFromCart = catalogueViewModel::removeFromCart,
        onCheckout = {
            // P3-08 introduces the checkout payment picker. For
            // P3-06 we keep the action wired but leave the
            // implementation as a no-op so the visual hierarchy
            // (subtotal row + primary CTA) stays representative.
        },
    )

    val target = pendingProduct
    if (target != null) {
        PosVariantSheet(
            state = variantState,
            onSelectOption = variantViewModel::selectOption,
            onAddToCart = {
                // Snapshot the current selection on add so the cart
                // line carries deterministic (option-id-stable)
                // labels + uplift. A subsequent re-open of the
                // sheet for the same product would re-fetch and
                // could see a different default if the backend
                // changed mid-session — capturing here keeps the
                // running cart immune to that drift.
                catalogueViewModel.addToCart(
                    product = target,
                    unitPriceUpliftIdr = variantState.selectedPriceUpliftIdr,
                    selectedOptionLabels = variantState.selectedOptions.map { it.label },
                )
                pendingProduct = null
            },
            onRetry = variantViewModel::retry,
            onDismiss = { pendingProduct = null },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PosCatalogueScreen(
    state: PosCatalogueUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onAddToCart: (Product) -> Unit,
    onIncrement: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onDecrement: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onRemoveFromCart: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onCheckout: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kasir") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(
                        onClick = onRefresh,
                        enabled = state.loadStatus !is LoadStatus.Loading,
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Muat ulang")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            CatalogueList(
                state = state,
                onAddToCart = onAddToCart,
                onRetry = onRefresh,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            )
            HorizontalDivider()
            CartPanel(
                cart = state.cart,
                subtotalIdr = state.cartSubtotalIdr,
                itemCount = state.cartItemCount,
                onIncrement = onIncrement,
                onDecrement = onDecrement,
                onRemove = onRemoveFromCart,
                onCheckout = onCheckout,
            )
        }
    }
}

@Composable
private fun CatalogueList(
    state: PosCatalogueUiState,
    onAddToCart: (Product) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val showSpinner = state.loadStatus is LoadStatus.Loading && state.products.isEmpty()
    val failure = state.loadStatus as? LoadStatus.Failed

    Box(modifier = modifier) {
        when {
            showSpinner -> {
                CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp),
                )
            }
            failure != null && state.products.isEmpty() -> {
                ErrorBanner(
                    message = failure.message,
                    onRetry = onRetry,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp),
                )
            }
            state.products.isEmpty() -> {
                Text(
                    text = "Tidak ada produk yang aktif.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp),
                )
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        top = 12.dp,
                        bottom = 12.dp,
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(
                        items = state.products,
                        key = { product -> product.id },
                    ) { product ->
                        ProductRow(
                            product = product,
                            onAddToCart = { onAddToCart(product) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(
    product: Product,
    onAddToCart: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = formatIdr(product.priceIdr),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (product.categoryName != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = product.categoryName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            Button(onClick = onAddToCart) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                )
                Spacer(Modifier.width(4.dp))
                Text("Tambah")
            }
        }
    }
}

@Composable
private fun ErrorBanner(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Gagal memuat katalog",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onRetry) {
                Text("Coba lagi")
            }
        }
    }
}

@Composable
private fun CartPanel(
    cart: List<CartItem>,
    subtotalIdr: Long,
    itemCount: Int,
    onIncrement: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onDecrement: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onRemove: (productId: Long, unitPriceUpliftIdr: Long) -> Unit,
    onCheckout: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 4.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Keranjang",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "$itemCount item",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (cart.isEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Belum ada produk di keranjang.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Spacer(Modifier.height(8.dp))
                cart.forEach { item ->
                    // Cart-line callbacks key on (productId,
                    // unitPriceUpliftIdr) so two lines for the same
                    // product with different modifier picks address
                    // independently — see PosCatalogueViewModel.
                    CartLine(
                        item = item,
                        onIncrement = { onIncrement(item.productId, item.unitPriceUpliftIdr) },
                        onDecrement = { onDecrement(item.productId, item.unitPriceUpliftIdr) },
                        onRemove = { onRemove(item.productId, item.unitPriceUpliftIdr) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Subtotal",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatIdr(subtotalIdr),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onCheckout,
                enabled = cart.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Lanjut ke pembayaran (P3-08)")
            }
        }
    }
}

@Composable
private fun CartLine(
    item: CartItem,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.name,
                style = MaterialTheme.typography.bodyLarge,
            )
            if (item.selectedOptionLabels.isNotEmpty()) {
                // Comma-joined modifier picks under the product
                // name — e.g. "Large, Less Sugar". Lets the kasir
                // verify configuration at a glance without
                // re-opening the sheet.
                Text(
                    text = item.selectedOptionLabels.joinToString(separator = ", "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = formatIdr(item.lineTotalIdr),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onDecrement) {
            // U+2212 MINUS SIGN — visually paired with the
            // `Icons.Default.Add` glyph above without dragging in
            // the much larger `material-icons-extended` artifact
            // for a single icon (`Remove` lives in extended, not
            // core).
            Text(
                text = "\u2212",
                style = MaterialTheme.typography.titleMedium,
            )
        }
        Text(
            text = item.quantity.toString(),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        IconButton(onClick = onIncrement) {
            Icon(Icons.Default.Add, contentDescription = "Tambah")
        }
        Spacer(Modifier.width(4.dp))
        OutlinedButton(onClick = onRemove) {
            Text("Hapus")
        }
    }
}

private fun formatIdr(amount: Long): String {
    // Indonesia uses `Rp` with thousands separators and no decimal
    // scale (whole-rupiah pricing). NumberFormat.getCurrencyInstance
    // for `id-ID` returns `Rp 123.456,00` — the trailing zero
    // decimals are noise on the kasir UI, so build a custom format
    // with grouping but no fraction digits.
    val formatter = NumberFormat.getNumberInstance(Locale("id", "ID")).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }
    return "Rp " + formatter.format(amount)
}

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun PosCatalogueScreenPreview() {
    VIPOSTheme {
        PosCatalogueScreen(
            state = PosCatalogueUiState(
                loadStatus = LoadStatus.Loaded,
                products = listOf(
                    Product(id = 1, name = "Es Kopi Susu", priceIdr = 22000, categoryName = "Minuman", sku = "MN-001"),
                    Product(id = 2, name = "Croissant Coklat", priceIdr = 18000, categoryName = "Kue", sku = "KU-001"),
                ),
                cart = listOf(
                    // Plain no-variant line (P3-06 shape).
                    CartItem(productId = 2, name = "Croissant Coklat", unitPriceIdr = 18000, quantity = 1),
                    // Variant-configured line (P3-07 fifth slice) — uplift
                    // and option labels rendered as a subtitle.
                    CartItem(
                        productId = 1,
                        name = "Es Kopi Susu",
                        unitPriceIdr = 22000,
                        quantity = 2,
                        unitPriceUpliftIdr = 4000,
                        selectedOptionLabels = listOf("Large", "Less Sugar"),
                    ),
                ),
            ),
            onBack = {},
            onRefresh = {},
            onAddToCart = {},
            onIncrement = { _, _ -> },
            onDecrement = { _, _ -> },
            onRemoveFromCart = { _, _ -> },
            onCheckout = {},
        )
    }
}
