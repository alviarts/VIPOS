package id.alviarts.vipos.navigation

import android.net.Uri

/**
 * Centralised registry of every screen the app can navigate to
 * (P3-08 + P3-03c).
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

    data object TwoFactor : VIPOSDestination {
        const val ARG_LOGIN_TOKEN: String = "loginToken"
        override val route: String = "twofactor/{$ARG_LOGIN_TOKEN}"

        /**
         * Builds a concrete navigable route with the given JWT
         * `loginToken` filled in. JWTs are base64url-encoded
         * and contain `.`s which are technically reserved in
         * path segments — URL-encode the value to be safe so a
         * future token format change doesn't break navigation.
         */
        fun routeFor(loginToken: String): String =
            "twofactor/${Uri.encode(loginToken)}"
    }

    data object Home : VIPOSDestination {
        const val ARG_DISPLAY_NAME: String = "displayName"
        override val route: String = "home/{$ARG_DISPLAY_NAME}"

        /**
         * Builds a concrete navigable route with the given
         * `displayName` filled in, used by the login destination
         * after a successful authentication.
         */
        fun routeFor(displayName: String): String =
            "home/${Uri.encode(displayName)}"
    }

    /**
     * P3-06: POS (kasir) catalogue + cart screen. Reached from
     * Home via the "Buka kasir" CTA. The catalogue itself is
     * fetched via an authenticated `GET /api/v1/products` so
     * cold-navigating here without a session would land on a
     * 401-driven session bounce (full handling in P3-03f);
     * SessionGate ensures we never reach this destination
     * without a restored session in the happy path.
     */
    data object Pos : VIPOSDestination {
        override val route: String = "pos"
    }

    /**
     * P4-05: Transaction history screen with filtering and
     * pagination. Shows list of past transactions with date
     * and status filters.
     */
    data object TransactionHistory : VIPOSDestination {
        override val route: String = "transaction_history"
    }

    /**
     * P4-05: Transaction detail screen. Shows full details
     * of a single transaction including items.
     */
    data object TransactionDetail : VIPOSDestination {
        const val ARG_TRANSACTION_ID: String = "transactionId"
        override val route: String = "transaction_detail/{$ARG_TRANSACTION_ID}"

        fun routeFor(transactionId: Long): String =
            "transaction_detail/$transactionId"
    }

    /**
     * P4-01: Online order queue screen. Shows pending and
     * active online orders with action buttons.
     */
    data object OnlineOrderQueue : VIPOSDestination {
        override val route: String = "online_order_queue"
    }

    /**
     * P4-01: Online order detail screen. Shows full details
     * of a single online order including items.
     */
    data object OnlineOrderDetail : VIPOSDestination {
        const val ARG_ORDER_ID: String = "orderId"
        override val route: String = "online_order_detail/{$ARG_ORDER_ID}"

        fun routeFor(orderId: Long): String =
            "online_order_detail/$orderId"
    }

    /**
     * P4-07: Owner dashboard screen. Shows today's KPIs,
     * revenue, transactions, and alerts.
     */
    data object OwnerDashboard : VIPOSDestination {
        override val route: String = "owner_dashboard"
    }

    /**
     * P4-02: Appointment list screen. Shows list of appointments
     * with status and date filters.
     */
    data object AppointmentList : VIPOSDestination {
        override val route: String = "appointment_list"
    }

    /**
     * P4-02: Appointment detail screen. Shows full details
     * of a single appointment with action buttons.
     */
    data object AppointmentDetail : VIPOSDestination {
        const val ARG_APPOINTMENT_ID: String = "appointmentId"
        override val route: String = "appointment_detail/{$ARG_APPOINTMENT_ID}"

        fun routeFor(appointmentId: Long): String =
            "appointment_detail/$appointmentId"
    }

    /**
     * P4-02: Appointment create screen. Form to create new
     * appointment with customer info and services.
     */
    data object AppointmentCreate : VIPOSDestination {
        override val route: String = "appointment_create"
    }

    /**
     * P4-03: Stock movement list screen. Shows inventory
     * movements with type and date filters.
     */
    data object StockMovementList : VIPOSDestination {
        override val route: String = "stock_movement_list"
    }

    /**
     * P4-03: Stock movement create screen. Form to create
     * new stock in/out movement.
     */
    data object StockMovementCreate : VIPOSDestination {
        override val route: String = "stock_movement_create"
    }

    /**
     * P4-04: Stock opname list screen. Shows list of stock
     * opname sessions with status filters.
     */
    data object StockOpnameList : VIPOSDestination {
        override val route: String = "stock_opname_list"
    }

    /**
     * P4-04: Stock opname detail screen. Shows full details
     * of a stock opname session with item counts.
     */
    data object StockOpnameDetail : VIPOSDestination {
        const val ARG_OPNAME_ID: String = "opnameId"
        override val route: String = "stock_opname_detail/{$ARG_OPNAME_ID}"

        fun routeFor(opnameId: Long): String =
            "stock_opname_detail/$opnameId"
    }

    /**
     * P4-04: Stock opname create screen. Form to create
     * new stock opname session.
     */
    data object StockOpnameCreate : VIPOSDestination {
        override val route: String = "stock_opname_create"
    }

    /**
     * P4-06: Sales report screen. Shows sales summary
     * with KPIs, trends, and breakdowns.
     */
    data object SalesReport : VIPOSDestination {
        override val route: String = "sales_report"
    }

    /**
     * P4-08: Employee list screen. Shows list of employees
     * with status and department filters.
     */
    data object EmployeeList : VIPOSDestination {
        override val route: String = "employee_list"
    }

    /**
     * P4-08: Employee detail screen. Shows full details
     * of a single employee with edit/delete actions.
     */
    data object EmployeeDetail : VIPOSDestination {
        const val ARG_EMPLOYEE_ID: String = "employeeId"
        override val route: String = "employee_detail/{$ARG_EMPLOYEE_ID}"

        fun routeFor(employeeId: Long): String =
            "employee_detail/$employeeId"
    }

    /**
     * P4-08: Employee create screen. Form to create
     * new employee.
     */
    data object EmployeeCreate : VIPOSDestination {
        override val route: String = "employee_create"
    }

    /**
     * P4-08: Employee edit screen. Form to edit
     * existing employee.
     */
    data object EmployeeEdit : VIPOSDestination {
        const val ARG_EMPLOYEE_ID: String = "employeeId"
        override val route: String = "employee_edit/{$ARG_EMPLOYEE_ID}"

        fun routeFor(employeeId: Long): String =
            "employee_edit/$employeeId"
    }

    /**
     * P4-09: Customer loyalty screen. Shows customer
     * points balance and loyalty summary.
     */
    data object LoyaltyCustomer : VIPOSDestination {
        const val ARG_CUSTOMER_ID: String = "customerId"
        override val route: String = "loyalty_customer/{$ARG_CUSTOMER_ID}"

        fun routeFor(customerId: Long): String =
            "loyalty_customer/$customerId"
    }

    /**
     * P4-09: Loyalty transaction history screen. Shows
     * list of loyalty transactions with filters.
     */
    data object LoyaltyTransactionList : VIPOSDestination {
        const val ARG_CUSTOMER_ID: String = "customerId"
        override val route: String = "loyalty_transactions/{$ARG_CUSTOMER_ID}"

        fun routeFor(customerId: Long): String =
            "loyalty_transactions/$customerId"
    }

    /**
     * P4-11: Outlet list screen. Shows list of outlets
     * with switch functionality.
     */
    data object OutletList : VIPOSDestination {
        override val route: String = "outlet_list"
    }
}
