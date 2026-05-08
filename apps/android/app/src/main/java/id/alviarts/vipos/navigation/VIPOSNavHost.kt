package id.alviarts.vipos.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import id.alviarts.vipos.feature.auth.ui.AuthRoute
import id.alviarts.vipos.feature.auth.ui.twofactor.TwoFactorRoute
import id.alviarts.vipos.feature.home.ui.HomeRoute
import id.alviarts.vipos.feature.pos.ui.PosCatalogueRoute
import id.alviarts.vipos.feature.pos.ui.appointment.AppointmentCreateScreen
import id.alviarts.vipos.feature.pos.ui.appointment.AppointmentDetailScreen
import id.alviarts.vipos.feature.pos.ui.appointment.AppointmentListScreen
import id.alviarts.vipos.feature.pos.ui.dashboard.OwnerDashboardScreen
import id.alviarts.vipos.feature.pos.ui.history.TransactionDetailScreen
import id.alviarts.vipos.feature.pos.ui.history.TransactionHistoryScreen
import id.alviarts.vipos.feature.pos.ui.inventory.StockMovementCreateScreen
import id.alviarts.vipos.feature.pos.ui.inventory.StockMovementListScreen
import id.alviarts.vipos.feature.pos.ui.stockopname.StockOpnameCreateScreen
import id.alviarts.vipos.feature.pos.ui.stockopname.StockOpnameDetailScreen
import id.alviarts.vipos.feature.pos.ui.stockopname.StockOpnameListScreen
import id.alviarts.vipos.feature.pos.ui.reports.SalesReportScreen
import id.alviarts.vipos.feature.pos.ui.employee.EmployeeListScreen
import id.alviarts.vipos.feature.pos.ui.onlineorder.OnlineOrderDetailScreen
import id.alviarts.vipos.feature.pos.ui.onlineorder.OnlineOrderQueueScreen

/**
 * Root nav graph (P3-08 + P3-03c).
 *
 *  - Cold-start lands on whatever [startRoute] the SessionGate
 *    selected (P3-03d): login when no session can be restored,
 *    home when a non-expired session is on disk.
 *  - On successful authentication, the login destination
 *    navigates to [VIPOSDestination.Home] with the user's
 *    `displayName` as a path argument, popping the login
 *    destination so back-press exits the app instead of
 *    flashing the login form.
 *  - When /login returns `requires_2fa`, the login destination
 *    navigates to [VIPOSDestination.TwoFactor] with the
 *    `login_token` as a path argument; the 2FA destination then
 *    navigates to home on successful verification with the
 *    same back-stack-clearing pattern (login + twofactor are
 *    both popped).
 *  - On logout, the home destination navigates back to login.
 */
@Composable
fun VIPOSNavHost(
    startRoute: String = VIPOSDestination.Login.route,
    navController: NavHostController = rememberNavController(),
    onRequires2FA: (loginToken: String) -> Unit = {},
) {
    NavHost(
        navController = navController,
        startDestination = startRoute,
    ) {
        composable(VIPOSDestination.Login.route) {
            AuthRoute(
                onAuthenticated = { displayName ->
                    navController.navigate(
                        VIPOSDestination.Home.routeFor(displayName),
                    ) {
                        popUpTo(VIPOSDestination.Login.route) {
                            inclusive = true
                        }
                        launchSingleTop = true
                    }
                },
                onRequires2FA = { loginToken ->
                    // P3-03c: hop to the dedicated 2FA challenge
                    // screen; surface the token to the host
                    // callback first for logcat / analytics.
                    onRequires2FA(loginToken)
                    navController.navigate(
                        VIPOSDestination.TwoFactor.routeFor(loginToken),
                    ) {
                        // Keep login on the back-stack so the user
                        // can tap "Batal" inside the 2FA screen
                        // and land back on the prefilled form.
                        launchSingleTop = true
                    }
                },
            )
        }
        composable(
            route = VIPOSDestination.TwoFactor.route,
            arguments = listOf(
                navArgument(VIPOSDestination.TwoFactor.ARG_LOGIN_TOKEN) {
                    type = NavType.StringType
                },
            ),
        ) {
            TwoFactorRoute(
                onAuthenticated = { displayName ->
                    navController.navigate(
                        VIPOSDestination.Home.routeFor(displayName),
                    ) {
                        // Pop both the 2FA challenge and the
                        // login form — back-press from home
                        // should exit the app, not bounce
                        // through the auth surfaces.
                        popUpTo(VIPOSDestination.Login.route) {
                            inclusive = true
                        }
                        launchSingleTop = true
                    }
                },
                onCancel = {
                    navController.popBackStack(
                        route = VIPOSDestination.Login.route,
                        inclusive = false,
                    )
                },
            )
        }
        composable(
            route = VIPOSDestination.Home.route,
            arguments = listOf(
                navArgument(VIPOSDestination.Home.ARG_DISPLAY_NAME) {
                    type = NavType.StringType
                },
            ),
        ) { backStackEntry ->
            val displayName: String = backStackEntry.arguments
                ?.getString(VIPOSDestination.Home.ARG_DISPLAY_NAME)
                .orEmpty()
            HomeRoute(
                displayName = displayName,
                onLogout = {
                    navController.navigate(VIPOSDestination.Login.route) {
                        popUpTo(VIPOSDestination.Home.route) {
                            inclusive = true
                        }
                        launchSingleTop = true
                    }
                },
                onOpenPos = {
                    navController.navigate(VIPOSDestination.Pos.route) {
                        // Multiple taps on "Buka kasir" should NOT
                        // pile new POS destinations onto the back
                        // stack — single-top + restoreState makes
                        // a re-entry feel native.
                        launchSingleTop = true
                    }
                },
                onOpenTransactionHistory = {
                    navController.navigate(VIPOSDestination.TransactionHistory.route) {
                        launchSingleTop = true
                    }
                },
                onOpenOnlineOrderQueue = {
                    navController.navigate(VIPOSDestination.OnlineOrderQueue.route) {
                        launchSingleTop = true
                    }
                },
                onOpenOwnerDashboard = {
                    navController.navigate(VIPOSDestination.OwnerDashboard.route) {
                        launchSingleTop = true
                    }
                },
                onOpenAppointmentList = {
                    navController.navigate(VIPOSDestination.AppointmentList.route) {
                        launchSingleTop = true
                    }
                },
                onOpenStockMovementList = {
                    navController.navigate(VIPOSDestination.StockMovementList.route) {
                        launchSingleTop = true
                    }
                },
                onOpenStockOpnameList = {
                    navController.navigate(VIPOSDestination.StockOpnameList.route) {
                        launchSingleTop = true
                    }
                },
                onOpenSalesReport = {
                    navController.navigate(VIPOSDestination.SalesReport.route) {
                        launchSingleTop = true
                    }
                },
                onOpenEmployeeList = {
                    navController.navigate(VIPOSDestination.EmployeeList.route) {
                        launchSingleTop = true
                    }
                },
            )
        }
        composable(VIPOSDestination.Pos.route) {
            PosCatalogueRoute(
                onBack = { navController.popBackStack() },
            )
        }

        // P4-05: Transaction history
        composable(VIPOSDestination.TransactionHistory.route) {
            TransactionHistoryScreen(
                onNavigateBack = { navController.popBackStack() },
                onTransactionClick = { transactionId ->
                    navController.navigate(
                        VIPOSDestination.TransactionDetail.routeFor(transactionId),
                    )
                },
            )
        }

        // P4-05: Transaction detail
        composable(
            route = VIPOSDestination.TransactionDetail.route,
            arguments = listOf(
                navArgument(VIPOSDestination.TransactionDetail.ARG_TRANSACTION_ID) {
                    type = NavType.LongType
                },
            ),
        ) {
            TransactionDetailScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // P4-01: Online order queue
        composable(VIPOSDestination.OnlineOrderQueue.route) {
            OnlineOrderQueueScreen(
                onNavigateBack = { navController.popBackStack() },
                onOrderClick = { orderId ->
                    navController.navigate(
                        VIPOSDestination.OnlineOrderDetail.routeFor(orderId),
                    )
                },
            )
        }

        // P4-01: Online order detail
        composable(
            route = VIPOSDestination.OnlineOrderDetail.route,
            arguments = listOf(
                navArgument(VIPOSDestination.OnlineOrderDetail.ARG_ORDER_ID) {
                    type = NavType.LongType
                },
            ),
        ) {
            OnlineOrderDetailScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // P4-07: Owner dashboard
        composable(VIPOSDestination.OwnerDashboard.route) {
            OwnerDashboardScreen(
                onNavigateBack = { navController.popBackStack() },
                onLowStockClick = {
                    // TODO: Navigate to inventory/stock screen
                },
                onPendingApprovalsClick = {
                    // TODO: Navigate to approvals screen
                },
            )
        }

        // P4-02: Appointment list
        composable(VIPOSDestination.AppointmentList.route) {
            AppointmentListScreen(
                onNavigateBack = { navController.popBackStack() },
                onAppointmentClick = { appointmentId ->
                    navController.navigate(
                        VIPOSDestination.AppointmentDetail.routeFor(appointmentId),
                    )
                },
                onCreateClick = {
                    navController.navigate(VIPOSDestination.AppointmentCreate.route)
                },
            )
        }

        // P4-02: Appointment detail
        composable(
            route = VIPOSDestination.AppointmentDetail.route,
            arguments = listOf(
                navArgument(VIPOSDestination.AppointmentDetail.ARG_APPOINTMENT_ID) {
                    type = NavType.LongType
                },
            ),
        ) { backStackEntry ->
            val appointmentId = backStackEntry.arguments
                ?.getLong(VIPOSDestination.AppointmentDetail.ARG_APPOINTMENT_ID)
                ?: 0L
            AppointmentDetailScreen(
                appointmentId = appointmentId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // P4-02: Appointment create
        composable(VIPOSDestination.AppointmentCreate.route) {
            AppointmentCreateScreen(
                onNavigateBack = { navController.popBackStack() },
                onSuccess = { appointmentId ->
                    // Navigate to detail screen after successful creation
                    navController.navigate(
                        VIPOSDestination.AppointmentDetail.routeFor(appointmentId),
                    ) {
                        // Pop create screen so back button goes to list
                        popUpTo(VIPOSDestination.AppointmentList.route)
                    }
                },
            )
        }

        // P4-03: Stock movement list
        composable(VIPOSDestination.StockMovementList.route) {
            StockMovementListScreen(
                onNavigateBack = { navController.popBackStack() },
                onCreateClick = {
                    navController.navigate(VIPOSDestination.StockMovementCreate.route)
                },
            )
        }

        // P4-03: Stock movement create
        composable(VIPOSDestination.StockMovementCreate.route) {
            StockMovementCreateScreen(
                onNavigateBack = { navController.popBackStack() },
                onSuccess = {
                    // Navigate back to list after successful creation
                    navController.popBackStack()
                },
            )
        }

        // P4-04: Stock opname list
        composable(VIPOSDestination.StockOpnameList.route) {
            StockOpnameListScreen(
                onNavigateBack = { navController.popBackStack() },
                onCreateClick = {
                    navController.navigate(VIPOSDestination.StockOpnameCreate.route)
                },
                onOpnameClick = { opnameId ->
                    navController.navigate(VIPOSDestination.StockOpnameDetail.routeFor(opnameId))
                },
            )
        }

        // P4-04: Stock opname detail
        composable(
            route = VIPOSDestination.StockOpnameDetail.route,
            arguments = listOf(
                navArgument(VIPOSDestination.StockOpnameDetail.ARG_OPNAME_ID) {
                    type = NavType.LongType
                },
            ),
        ) { backStackEntry ->
            val opnameId = backStackEntry.arguments
                ?.getLong(VIPOSDestination.StockOpnameDetail.ARG_OPNAME_ID) ?: 0L
            StockOpnameDetailScreen(
                opnameId = opnameId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // P4-04: Stock opname create
        composable(VIPOSDestination.StockOpnameCreate.route) {
            StockOpnameCreateScreen(
                onNavigateBack = { navController.popBackStack() },
                onOpnameCreated = { opnameId ->
                    // Navigate to detail after successful creation
                    navController.navigate(VIPOSDestination.StockOpnameDetail.routeFor(opnameId)) {
                        // Pop create screen from back stack
                        popUpTo(VIPOSDestination.StockOpnameList.route)
                    }
                },
            )
        }

        // P4-06: Sales report
        composable(VIPOSDestination.SalesReport.route) {
            SalesReportScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // P4-08: Employee list
        composable(VIPOSDestination.EmployeeList.route) {
            EmployeeListScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }
    }
}
