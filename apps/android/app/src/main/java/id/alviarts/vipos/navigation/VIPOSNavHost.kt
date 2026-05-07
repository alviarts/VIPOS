package id.alviarts.vipos.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import id.alviarts.vipos.feature.auth.ui.AuthRoute
import id.alviarts.vipos.feature.home.ui.HomeRoute

/**
 * Root nav graph (P3-08).
 *
 *  - Cold-start always lands on [VIPOSDestination.Login] — the
 *    auto-login restoration flow (rehydrating from a stored
 *    refresh token) is deliberately out of scope for this PR
 *    and lands as a separate sub-task.
 *  - On successful authentication, the login destination
 *    navigates to [VIPOSDestination.Home] with the user's
 *    `displayName` as a path argument, popping the login
 *    destination so back-press exits the app instead of
 *    flashing the login form.
 *  - On logout, the home destination navigates back to login
 *    with the inverse pop.
 *  - The 2FA challenge UI lands in P3-03c; for now the host
 *    just logs the `login_token` so engineers can see it
 *    surface in logcat during sideload.
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
                        // Drop the login destination from the
                        // back-stack so back-press from home
                        // exits the app instead of returning
                        // to a stale login form.
                        popUpTo(VIPOSDestination.Login.route) {
                            inclusive = true
                        }
                        launchSingleTop = true
                    }
                },
                onRequires2FA = onRequires2FA,
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
            )
        }
    }
}
