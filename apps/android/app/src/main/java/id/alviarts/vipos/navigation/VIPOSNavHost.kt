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
import id.alviarts.vipos.feature.pos.ui.dashboard.OwnerDashboardScreen
import id.alviarts.vipos.feature.pos.ui.history.TransactionHistoryScreen
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
            // TODO: Implement TransactionDetailScreen
            // For now, just pop back
            navController.popBackStack()
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
            // TODO: Implement OnlineOrderDetailScreen
            // For now, just pop back
            navController.popBackStack()
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
    }
}
