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
import ReportsPage from './pages/ReportsPage';
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
        <Route path="finance" element={<FinancePage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="sales-orders" element={<SalesOrdersPage />} />
        <Route path="delivery-orders" element={<DeliveryOrdersPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="receipts" element={<ReceiptsPage />} />
        <Route path="aging-report" element={<AgingReportPage />} />
        <Route path="commissions" element={<CommissionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/change-password" element={<ChangePasswordPage />} />
        <Route path="settings/2fa" element={<Setup2FAPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
