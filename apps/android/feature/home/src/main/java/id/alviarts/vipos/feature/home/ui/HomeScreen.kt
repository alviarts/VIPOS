package id.alviarts.vipos.feature.home.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.alviarts.vipos.core.designsystem.component.MenuDivider
import id.alviarts.vipos.core.designsystem.component.MenuIcons
import id.alviarts.vipos.core.designsystem.component.MenuSection
import id.alviarts.vipos.core.designsystem.component.PrimaryMenuButton
import id.alviarts.vipos.core.designsystem.component.SecondaryMenuButton
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme

/**
 * Composable entry point for the home destination.
 * 
 * Enhanced with:
 * - Material Icons for all buttons
 * - Visual grouping with Cards
 * - Section headers for organization
 * - Scrollable layout for small screens
 */
@Composable
fun HomeRoute(
    displayName: String,
    onLogout: () -> Unit,
    onOpenPos: () -> Unit,
    onOpenTransactionHistory: () -> Unit = {},
    onOpenOnlineOrderQueue: () -> Unit = {},
    onOpenOwnerDashboard: () -> Unit = {},
    onOpenAppointmentList: () -> Unit = {},
    onOpenStockMovementList: () -> Unit = {},
    onOpenStockOpnameList: () -> Unit = {},
    onOpenSalesReport: () -> Unit = {},
    onOpenEmployeeList: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.didLogout) {
        if (uiState.didLogout) {
            viewModel.consumeLogoutEvent()
            onLogout()
        }
    }

    HomeScreen(
        displayName = displayName,
        isLoggingOut = uiState.isLoggingOut,
        onLogoutClick = viewModel::logout,
        onOpenPosClick = onOpenPos,
        onOpenTransactionHistoryClick = onOpenTransactionHistory,
        onOpenOnlineOrderQueueClick = onOpenOnlineOrderQueue,
        onOpenOwnerDashboardClick = onOpenOwnerDashboard,
        onOpenAppointmentListClick = onOpenAppointmentList,
        onOpenStockMovementListClick = onOpenStockMovementList,
        onOpenStockOpnameListClick = onOpenStockOpnameList,
        onOpenSalesReportClick = onOpenSalesReport,
        onOpenEmployeeListClick = onOpenEmployeeList,
    )
}

@Composable
internal fun HomeScreen(
    displayName: String,
    isLoggingOut: Boolean,
    onLogoutClick: () -> Unit,
    onOpenPosClick: () -> Unit,
    onOpenTransactionHistoryClick: () -> Unit = {},
    onOpenOnlineOrderQueueClick: () -> Unit = {},
    onOpenOwnerDashboardClick: () -> Unit = {},
    onOpenAppointmentListClick: () -> Unit = {},
    onOpenStockMovementListClick: () -> Unit = {},
    onOpenStockOpnameListClick: () -> Unit = {},
    onOpenSalesReportClick: () -> Unit = {},
    onOpenEmployeeListClick: () -> Unit = {},
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Welcome Header
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 24.dp),
            ) {
                Text(
                    text = stringResource(id.alviarts.vipos.R.string.home_welcome),
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(id.alviarts.vipos.R.string.home_choose_menu),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            
            Spacer(Modifier.height(24.dp))
            
            // Main Action Section
            MenuSection(title = "Transaksi") {
                PrimaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_open_cashier),
                    icon = MenuIcons.PointOfSale,
                    onClick = onOpenPosClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_transaction_history),
                    icon = MenuIcons.TransactionHistory,
                    onClick = onOpenTransactionHistoryClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_online_orders),
                    icon = MenuIcons.OnlineOrders,
                    onClick = onOpenOnlineOrderQueueClick,
                    enabled = !isLoggingOut,
                )
            }
            
            Spacer(Modifier.height(16.dp))
            
            // Management Section
            MenuSection(title = "Manajemen") {
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_appointments),
                    icon = MenuIcons.Appointments,
                    onClick = onOpenAppointmentListClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_stock_movement),
                    icon = MenuIcons.StockMovement,
                    onClick = onOpenStockMovementListClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_stock_opname),
                    icon = MenuIcons.StockOpname,
                    onClick = onOpenStockOpnameListClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_employees),
                    icon = MenuIcons.Employees,
                    onClick = onOpenEmployeeListClick,
                    enabled = !isLoggingOut,
                )
            }
            
            Spacer(Modifier.height(16.dp))
            
            // Reports Section
            MenuSection(title = "Laporan") {
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_sales_report),
                    icon = MenuIcons.SalesReport,
                    onClick = onOpenSalesReportClick,
                    enabled = !isLoggingOut,
                )
                
                MenuDivider()
                
                SecondaryMenuButton(
                    text = stringResource(id.alviarts.vipos.R.string.home_owner_dashboard),
                    icon = MenuIcons.Dashboard,
                    onClick = onOpenOwnerDashboardClick,
                    enabled = !isLoggingOut,
                )
            }
            
            Spacer(Modifier.height(24.dp))
            
            // Logout Button
            Column(
                modifier = Modifier.padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                SecondaryMenuButton(
                    text = if (isLoggingOut) {
                        stringResource(id.alviarts.vipos.R.string.home_logging_out)
                    } else {
                        stringResource(id.alviarts.vipos.R.string.home_logout)
                    },
                    icon = MenuIcons.Logout,
                    onClick = onLogoutClick,
                    enabled = !isLoggingOut,
                )
                
                if (isLoggingOut) {
                    Spacer(Modifier.height(8.dp))
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.height(20.dp),
                    )
                }
            }
            
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun HomeScreenPreview() {
    VIPOSTheme {
        HomeScreen(
            displayName = "Kasir Satu",
            isLoggingOut = false,
            onLogoutClick = {},
            onOpenPosClick = {},
        )
    }
}
