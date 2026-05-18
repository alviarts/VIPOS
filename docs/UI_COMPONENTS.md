# VIPOS UI Component Library

## Overview

Comprehensive UI component library for VIPOS Android app built with Jetpack Compose and Material 3.

## Components

### 1. MenuButton Components

#### PrimaryMenuButton

Primary action button with icon and text.

```kotlin
PrimaryMenuButton(
    text = "Buka Kasir",
    icon = MenuIcons.PointOfSale,
    onClick = { /* action */ },
    enabled = true,
)
```

#### SecondaryMenuButton

Secondary action button (outlined) with icon and text.

```kotlin
SecondaryMenuButton(
    text = "Riwayat Transaksi",
    icon = MenuIcons.TransactionHistory,
    onClick = { /* action */ },
)
```

#### IconMenuButton

Icon-only button for toolbars.

```kotlin
IconMenuButton(
    icon = MenuIcons.Search,
    contentDescription = "Search",
    onClick = { /* action */ },
)
```

### 2. MenuSection Components

#### MenuSection

Card-based grouping with optional header.

```kotlin
MenuSection(title = "Transaksi") {
    PrimaryMenuButton(...)
    MenuDivider()
    SecondaryMenuButton(...)
}
```

#### SectionHeader

Standalone section header.

```kotlin
SectionHeader(title = "Manajemen")
```

### 3. SearchBar

Search input with clear button.

```kotlin
SearchBar(
    query = searchQuery,
    onQueryChange = { query -> /* update */ },
    placeholder = "Cari produk...",
    onSearch = { /* search action */ },
)
```

### 4. FilterChips

#### Single-select

```kotlin
FilterChips(
    filters = listOf("Hari Ini", "Minggu Ini", "Bulan Ini"),
    selectedFilter = "Hari Ini",
    onFilterSelected = { filter -> /* update */ },
)
```

#### Multi-select

```kotlin
MultiSelectFilterChips(
    filters = listOf("Aktif", "Pending", "Selesai"),
    selectedFilters = setOf("Aktif", "Pending"),
    onFilterToggled = { filter -> /* toggle */ },
)
```

### 5. ConfirmationDialog

#### Generic

```kotlin
ConfirmationDialog(
    title = "Hapus Data?",
    message = "Tindakan ini tidak dapat dibatalkan.",
    onConfirm = { /* delete */ },
    onDismiss = { /* cancel */ },
    isDestructive = true,
)
```

#### Pre-configured

```kotlin
DeleteConfirmationDialog(
    itemName = "Transaksi #123",
    onConfirm = { /* delete */ },
    onDismiss = { /* cancel */ },
)

LogoutConfirmationDialog(
    onConfirm = { /* logout */ },
    onDismiss = { /* cancel */ },
)

DiscardChangesDialog(
    onConfirm = { /* discard */ },
    onDismiss = { /* cancel */ },
)
```

### 6. EmptyState

#### Generic

```kotlin
EmptyState(
    title = "Belum ada transaksi",
    description = "Transaksi akan muncul di sini setelah checkout.",
    icon = MenuIcons.Receipt,
    actionText = "Buka Kasir",
    onActionClick = { /* action */ },
)
```

#### Empty Search

```kotlin
EmptySearchState(
    query = "produk xyz",
    onClearSearch = { /* clear */ },
)
```

### 7. LoadingState

#### Full-screen

```kotlin
LoadingState(
    message = "Memuat data...",
)
```

#### Inline

```kotlin
InlineLoadingIndicator()
```

### 8. ErrorState

#### Generic

```kotlin
ErrorState(
    message = "Gagal memuat data. Coba lagi.",
    onRetry = { /* retry */ },
)
```

#### Network Error

```kotlin
NetworkErrorState(
    onRetry = { /* retry */ },
)
```

## MenuIcons

Pre-defined icons for consistency:

```kotlin
MenuIcons.PointOfSale
MenuIcons.TransactionHistory
MenuIcons.OnlineOrders
MenuIcons.Dashboard
MenuIcons.Appointments
MenuIcons.StockMovement
MenuIcons.StockOpname
MenuIcons.SalesReport
MenuIcons.Employees
MenuIcons.Logout
MenuIcons.Settings
MenuIcons.Search
MenuIcons.Filter
MenuIcons.Add
MenuIcons.Edit
MenuIcons.Delete
MenuIcons.Save
MenuIcons.Cancel
MenuIcons.Refresh
MenuIcons.Sync
// ... 30+ more icons
```

## Usage Examples

### List Screen with Search & Filter

```kotlin
@Composable
fun TransactionListScreen(
    viewModel: TransactionViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column {
        SearchBar(
            query = uiState.searchQuery,
            onQueryChange = viewModel::updateSearchQuery,
            placeholder = "Cari invoice...",
        )

        FilterChips(
            filters = listOf("Hari Ini", "Minggu Ini", "Bulan Ini"),
            selectedFilter = uiState.selectedFilter,
            onFilterSelected = viewModel::selectFilter,
        )

        when {
            uiState.isLoading -> LoadingState()
            uiState.error != null -> ErrorState(
                message = uiState.error,
                onRetry = viewModel::retry,
            )
            uiState.transactions.isEmpty() -> EmptyState(
                title = "Belum ada transaksi",
                description = "Transaksi akan muncul di sini.",
            )
            else -> TransactionList(uiState.transactions)
        }
    }
}
```

### Form Screen with Confirmation

```kotlin
@Composable
fun ProductEditScreen(
    viewModel: ProductEditViewModel = hiltViewModel()
) {
    var showDiscardDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Produk") },
                navigationIcon = {
                    IconMenuButton(
                        icon = MenuIcons.ArrowBack,
                        contentDescription = "Back",
                        onClick = {
                            if (viewModel.hasUnsavedChanges()) {
                                showDiscardDialog = true
                            } else {
                                // navigate back
                            }
                        },
                    )
                },
            )
        },
    ) { padding ->
        // Form content

        if (showDiscardDialog) {
            DiscardChangesDialog(
                onConfirm = { /* navigate back */ },
                onDismiss = { showDiscardDialog = false },
            )
        }
    }
}
```

### Menu Screen with Sections

```kotlin
@Composable
fun HomeScreen() {
    Column(
        modifier = Modifier.verticalScroll(rememberScrollState())
    ) {
        MenuSection(title = "Transaksi") {
            PrimaryMenuButton(
                text = "Buka Kasir",
                icon = MenuIcons.PointOfSale,
                onClick = { /* open POS */ },
            )
            MenuDivider()
            SecondaryMenuButton(
                text = "Riwayat",
                icon = MenuIcons.TransactionHistory,
                onClick = { /* open history */ },
            )
        }

        Spacer(Modifier.height(16.dp))

        MenuSection(title = "Laporan") {
            SecondaryMenuButton(
                text = "Laporan Penjualan",
                icon = MenuIcons.SalesReport,
                onClick = { /* open report */ },
            )
        }
    }
}
```

## Design Principles

1. **Consistency** - All components follow Material 3 design
2. **Reusability** - Components are generic and configurable
3. **Accessibility** - Proper content descriptions and touch targets
4. **Responsiveness** - Adapts to different screen sizes
5. **Performance** - Optimized for smooth animations

## Best Practices

1. **Use MenuIcons** - Don't create custom icons, use predefined ones
2. **Group related actions** - Use MenuSection for visual hierarchy
3. **Show loading states** - Always show LoadingState during async operations
4. **Handle empty states** - Use EmptyState when lists are empty
5. **Confirm destructive actions** - Use ConfirmationDialog for delete/void
6. **Provide search** - Use SearchBar for lists with many items
7. **Add filters** - Use FilterChips for quick filtering

## Migration Guide

### Before (Hardcoded)

```kotlin
Button(onClick = { /* action */ }) {
    Text("Buka Kasir")
}
```

### After (With Components)

```kotlin
PrimaryMenuButton(
    text = stringResource(R.string.home_open_cashier),
    icon = MenuIcons.PointOfSale,
    onClick = { /* action */ },
)
```

## Testing

All components support preview:

```kotlin
@Preview
@Composable
fun MenuButtonPreview() {
    VIPOSTheme {
        PrimaryMenuButton(
            text = "Buka Kasir",
            icon = MenuIcons.PointOfSale,
            onClick = {},
        )
    }
}
```

## Performance

- Components are stateless and composable
- Icons are vector-based (no bitmap overhead)
- Lazy loading for lists
- Efficient recomposition

## Accessibility

- All icons have content descriptions
- Touch targets meet minimum size (48dp)
- Color contrast meets WCAG AA
- Screen reader support

---

**Version:** 1.0.0  
**Last Updated:** May 18, 2026  
**Status:** Production Ready ✅
