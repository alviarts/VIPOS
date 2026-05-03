import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Setup2FAPage from './pages/Setup2FAPage';
import DashboardPage from './pages/DashboardPage';
import CashierPage from './pages/CashierPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import DepartmentsPage from './pages/DepartmentsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CustomerGroupsPage from './pages/CustomerGroupsPage';
import InventoryPage from './pages/InventoryPage';
import StockOpnamePage from './pages/StockOpnamePage';
import FinancePage from './pages/FinancePage';
import TransactionsPage from './pages/TransactionsPage';
import LegacyReportsPage from './pages/ReportsPage';
import ReportsHub from './pages/reports/ReportsHub';
import SalesReportsPage from './pages/reports/SalesReportsPage';
import CashShiftReportsPage from './pages/reports/CashShiftReportsPage';
import AdjustmentReportsPage from './pages/reports/AdjustmentReportsPage';
import TaxCustomerReportsPage from './pages/reports/TaxCustomerReportsPage';
import InventoryReportsPage from './pages/reports/InventoryReportsPage';
import EmployeeReportsPage from './pages/reports/EmployeeReportsPage';
import MarketingReportsPage from './pages/reports/MarketingReportsPage';
import ScheduledReportsPage from './pages/reports/ScheduledReportsPage';
import SettingsPage from './pages/SettingsPage';
import QuotationsPage from './pages/QuotationsPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import DeliveryOrdersPage from './pages/DeliveryOrdersPage';
import InvoicesPage from './pages/InvoicesPage';
import ReceiptsPage from './pages/ReceiptsPage';
import AgingReportPage from './pages/AgingReportPage';
import CommissionsPage from './pages/CommissionsPage';
import PromosPage from './pages/penjualan/PromosPage';
import CouponsPage from './pages/penjualan/CouponsPage';
import LoyaltyPage from './pages/penjualan/LoyaltyPage';
import MarketingPage from './pages/penjualan/MarketingPage';
import EmployeesPage from './pages/karyawan/EmployeesPage';
import PayrollPage from './pages/karyawan/PayrollPage';
import PermissionsPage from './pages/karyawan/PermissionsPage';
import AttendancePage from './pages/karyawan/AttendancePage';
import SchedulePage from './pages/karyawan/SchedulePage';
import ApprovalWorkflowPage from './pages/karyawan/ApprovalWorkflowPage';
import ChartOfAccountsPage from './pages/keuangan/ChartOfAccountsPage';
import JournalPage from './pages/keuangan/JournalPage';
import CashBookPage from './pages/keuangan/CashBookPage';
import IncomePage from './pages/keuangan/IncomePage';
import ExpensesPage from './pages/keuangan/ExpensesPage';
import VendorsPage from './pages/keuangan/VendorsPage';
import FixedAssetsPage from './pages/keuangan/FixedAssetsPage';
import FinancialReportsPage from './pages/keuangan/FinancialReportsPage';
import AccountProfilePage from './pages/pengaturan/AccountProfilePage';
import OutletsPage from './pages/pengaturan/OutletsPage';
import FloorPlanPage from './pages/pengaturan/FloorPlanPage';
import NotificationsPage from './pages/pengaturan/NotificationsPage';
import SubscriptionPage from './pages/pengaturan/SubscriptionPage';
import PaymentSettingsPage from './pages/pengaturan/PaymentSettingsPage';
import PrintSettingsPage from './pages/pengaturan/PrintSettingsPage';
import CashierSettingsPage from './pages/pengaturan/CashierSettingsPage';
import TerminalsPage from './pages/pengaturan/TerminalsPage';
import SupportAccessPage from './pages/pengaturan/SupportAccessPage';
import ImportExportPage from './pages/pengaturan/ImportExportPage';
import LainnyaHub from './pages/lainnya/LainnyaHub';
import HelpPage from './pages/lainnya/HelpPage';
import ServicesPage from './pages/lainnya/ServicesPage';
import InspirasiPage from './pages/lainnya/InspirasiPage';
import CapitalPage from './pages/lainnya/CapitalPage';
import SuppliesPage from './pages/lainnya/SuppliesPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
  );
}
