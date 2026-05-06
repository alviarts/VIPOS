import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Lazy-load the rest of the app behind ProtectedRoute. Auth pages above
// stay eager so login/signup/forgot/reset paths never wait on a code-split
// chunk. Everything below renders inside <Suspense fallback> so the user
// sees a spinner while the chunk fetches.
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const Setup2FAPage = lazy(() => import('./pages/Setup2FAPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CashierPage = lazy(() => import('./pages/CashierPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'));
const CustomerGroupsPage = lazy(() => import('./pages/CustomerGroupsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const StockOpnamePage = lazy(() => import('./pages/StockOpnamePage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const LegacyReportsPage = lazy(() => import('./pages/ReportsPage'));
const ReportsHub = lazy(() => import('./pages/reports/ReportsHub'));
const SalesReportsPage = lazy(() => import('./pages/reports/SalesReportsPage'));
const CashShiftReportsPage = lazy(() => import('./pages/reports/CashShiftReportsPage'));
const AdjustmentReportsPage = lazy(() => import('./pages/reports/AdjustmentReportsPage'));
const TaxCustomerReportsPage = lazy(() => import('./pages/reports/TaxCustomerReportsPage'));
const InventoryReportsPage = lazy(() => import('./pages/reports/InventoryReportsPage'));
const EmployeeReportsPage = lazy(() => import('./pages/reports/EmployeeReportsPage'));
const MarketingReportsPage = lazy(() => import('./pages/reports/MarketingReportsPage'));
const ScheduledReportsPage = lazy(() => import('./pages/reports/ScheduledReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const SalesOrdersPage = lazy(() => import('./pages/SalesOrdersPage'));
const DeliveryOrdersPage = lazy(() => import('./pages/DeliveryOrdersPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const ReceiptsPage = lazy(() => import('./pages/ReceiptsPage'));
const AgingReportPage = lazy(() => import('./pages/AgingReportPage'));
const CommissionsPage = lazy(() => import('./pages/CommissionsPage'));
const PromosPage = lazy(() => import('./pages/penjualan/PromosPage'));
const CouponsPage = lazy(() => import('./pages/penjualan/CouponsPage'));
const LoyaltyPage = lazy(() => import('./pages/penjualan/LoyaltyPage'));
const AppointmentListPage = lazy(() => import('./pages/appointment/AppointmentListPage'));
const CalendarPage = lazy(() => import('./pages/appointment/CalendarPage'));
const OrdersPage = lazy(() => import('./pages/order_online/OrdersPage'));
const MarketplacePage = lazy(() => import('./pages/order_online/MarketplacePage'));
const MajooOrderPage = lazy(() => import('./pages/order_online/MajooOrderPage'));
const ConsumerAppPage = lazy(() => import('./pages/order_online/ConsumerAppPage'));
const MarketingPage = lazy(() => import('./pages/penjualan/MarketingPage'));
const EmployeesPage = lazy(() => import('./pages/karyawan/EmployeesPage'));
const PayrollPage = lazy(() => import('./pages/karyawan/PayrollPage'));
const PermissionsPage = lazy(() => import('./pages/karyawan/PermissionsPage'));
const AttendancePage = lazy(() => import('./pages/karyawan/AttendancePage'));
const SchedulePage = lazy(() => import('./pages/karyawan/SchedulePage'));
const ApprovalWorkflowPage = lazy(() => import('./pages/karyawan/ApprovalWorkflowPage'));
const ChartOfAccountsPage = lazy(() => import('./pages/keuangan/ChartOfAccountsPage'));
const JournalPage = lazy(() => import('./pages/keuangan/JournalPage'));
const CashBookPage = lazy(() => import('./pages/keuangan/CashBookPage'));
const IncomePage = lazy(() => import('./pages/keuangan/IncomePage'));
const ExpensesPage = lazy(() => import('./pages/keuangan/ExpensesPage'));
const VendorsPage = lazy(() => import('./pages/keuangan/VendorsPage'));
const FixedAssetsPage = lazy(() => import('./pages/keuangan/FixedAssetsPage'));
const FinancialReportsPage = lazy(() => import('./pages/keuangan/FinancialReportsPage'));
const AccountProfilePage = lazy(() => import('./pages/pengaturan/AccountProfilePage'));
const OutletsPage = lazy(() => import('./pages/pengaturan/OutletsPage'));
const FloorPlanPage = lazy(() => import('./pages/pengaturan/FloorPlanPage'));
const NotificationsPage = lazy(() => import('./pages/pengaturan/NotificationsPage'));
const SubscriptionPage = lazy(() => import('./pages/pengaturan/SubscriptionPage'));
const PaymentSettingsPage = lazy(() => import('./pages/pengaturan/PaymentSettingsPage'));
const PrintSettingsPage = lazy(() => import('./pages/pengaturan/PrintSettingsPage'));
const CashierSettingsPage = lazy(() => import('./pages/pengaturan/CashierSettingsPage'));
const TerminalsPage = lazy(() => import('./pages/pengaturan/TerminalsPage'));
const SupportAccessPage = lazy(() => import('./pages/pengaturan/SupportAccessPage'));
const ImportExportPage = lazy(() => import('./pages/pengaturan/ImportExportPage'));
const LainnyaHub = lazy(() => import('./pages/lainnya/LainnyaHub'));
const HelpPage = lazy(() => import('./pages/lainnya/HelpPage'));
const ServicesPage = lazy(() => import('./pages/lainnya/ServicesPage'));
const InspirasiPage = lazy(() => import('./pages/lainnya/InspirasiPage'));
const CapitalPage = lazy(() => import('./pages/lainnya/CapitalPage'));
const SuppliesPage = lazy(() => import('./pages/lainnya/SuppliesPage'));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Spinner />;
  }
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cashier" element={<CashierPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="customer-groups" element={<CustomerGroupsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/opname" element={<StockOpnamePage />} />
          <Route path="inventory/opname/:id" element={<StockOpnamePage />} />
          <Route path="promos" element={<PromosPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="finance" element={<CashBookPage />} />
          <Route path="finance/legacy" element={<FinancePage />} />
          <Route path="finance/accounts" element={<ChartOfAccountsPage />} />
          <Route path="finance/journal" element={<JournalPage />} />
          <Route path="finance/income" element={<IncomePage />} />
          <Route path="finance/expense" element={<ExpensesPage />} />
          <Route path="finance/vendors" element={<VendorsPage />} />
          <Route path="finance/fixed-assets" element={<FixedAssetsPage />} />
          <Route path="finance/reports" element={<FinancialReportsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="sales-orders" element={<SalesOrdersPage />} />
          <Route path="delivery-orders" element={<DeliveryOrdersPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="aging-report" element={<AgingReportPage />} />
          <Route path="commissions" element={<CommissionsPage />} />
          <Route path="appointment" element={<AppointmentListPage />} />
          <Route path="appointment-calendar" element={<CalendarPage />} />
          <Route path="order-online/orders" element={<OrdersPage />} />
          <Route path="order-online/marketplace" element={<MarketplacePage />} />
          <Route path="order-online/majoo-order" element={<MajooOrderPage />} />
          <Route path="order-online/consumer-app" element={<ConsumerAppPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="approval-workflow" element={<ApprovalWorkflowPage />} />
          <Route path="reports" element={<ReportsHub />} />
          <Route path="reports/legacy" element={<LegacyReportsPage />} />
          <Route path="reports/sales" element={<SalesReportsPage />} />
          <Route path="reports/cash-shift" element={<CashShiftReportsPage />} />
          <Route path="reports/adjustments" element={<AdjustmentReportsPage />} />
          <Route path="reports/tax-customer" element={<TaxCustomerReportsPage />} />
          <Route path="reports/inventory" element={<InventoryReportsPage />} />
          <Route path="reports/employee" element={<EmployeeReportsPage />} />
          <Route path="reports/marketing" element={<MarketingReportsPage />} />
          <Route path="reports/scheduled" element={<ScheduledReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/change-password" element={<ChangePasswordPage />} />
          <Route path="settings/2fa" element={<Setup2FAPage />} />
          <Route path="setup-2fa" element={<Setup2FAPage />} />
          {/* P1-16 Pengaturan / Settings. */}
          <Route path="settings/profile" element={<AccountProfilePage />} />
          <Route path="settings/outlets" element={<OutletsPage />} />
          <Route path="settings/outlets/:id/floor-plan" element={<FloorPlanPage />} />
          <Route path="settings/notifications" element={<NotificationsPage />} />
          <Route path="settings/subscription" element={<SubscriptionPage />} />
          <Route path="settings/payments" element={<PaymentSettingsPage />} />
          <Route path="settings/print" element={<PrintSettingsPage />} />
          <Route path="settings/cashier" element={<CashierSettingsPage />} />
          <Route path="settings/terminals" element={<TerminalsPage />} />
          <Route path="settings/support-access" element={<SupportAccessPage />} />
          <Route path="settings/import-export" element={<ImportExportPage />} />
          {/* P1-18 LAINNYA group: Bantuan, LAYANAN, INSPIRASI, Capital, SUPPLIES. */}
          <Route path="lainnya" element={<LainnyaHub />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="inspirasi" element={<InspirasiPage />} />
          <Route path="capital" element={<CapitalPage />} />
          <Route path="supplies" element={<SuppliesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
