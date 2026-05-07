package id.alviarts.vipos.navigation

/**
 * Centralised registry of every screen the app can navigate to
 * (P3-08).
 *
 * Routes are grouped under a sealed interface so the nav graph
 * has a compile-time-checked list of destinations and so call
 * sites don't sprinkle string literals across the codebase.
 *
 * The 2.8.x line of navigation-compose introduces a type-safe
 * destinations API that replaces the string route + bundle
 * argument pattern; we'll migrate after it ships stable. For
 * the Phase 3 timeframe the string-route API is the recommended
 * stable surface.
 */
sealed interface VIPOSDestination {
    val route: String

    data object Login : VIPOSDestination {
        override val route: String = "login"
    }

    data object Home : VIPOSDestination {
        const val ARG_DISPLAY_NAME: String = "displayName"
        override val route: String = "home/{$ARG_DISPLAY_NAME}"

        /**
         * Builds a concrete navigable route with the given
         * `displayName` filled in, used by the login destination
         * after a successful authentication.
         */
        fun routeFor(displayName: String): String = "home/$displayName"
    }
}
