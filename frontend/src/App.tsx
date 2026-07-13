import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import DeliveriesPage from '@/pages/DeliveriesPage';
import InventoryPage from '@/pages/InventoryPage';
import KitchenDisplayPage from '@/pages/KitchenDisplayPage';
import LoginPage from '@/pages/LoginPage';
import ManagerDashboardPage from '@/pages/ManagerDashboardPage';
import MenuManagementPage from '@/pages/MenuManagementPage';
import POSTerminalPage from '@/pages/POSTerminalPage';
import SalesReportPage from '@/pages/SalesReportPage';
import ShiftManagementPage from '@/pages/ShiftManagementPage';
import StaffManagementPage from '@/pages/StaffManagementPage';
import TableOrderPage from '@/pages/TableOrderPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';
import VarianceReportPage from '@/pages/VarianceReportPage';
import { AuthProvider } from '@/store/auth.context';

const ADMIN_ROLES = ['owner', 'manager'] as const;
const POS_ROLES = ['owner', 'manager', 'waiter', 'barman'] as const;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/pos" replace />} />

          {/* POS terminal */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute roles={[...POS_ROLES]}>
                <POSTerminalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos/table/:sessionId"
            element={
              <ProtectedRoute roles={[...POS_ROLES]}>
                <TableOrderPage />
              </ProtectedRoute>
            }
          />

          {/* Kitchen */}
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute roles={['kitchen', 'owner', 'manager']}>
                <KitchenDisplayPage />
              </ProtectedRoute>
            }
          />

          {/* Manager */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <ManagerDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/variance"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <VarianceReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sales"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <SalesReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/deliveries"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <DeliveriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/menu"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <MenuManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute roles={['owner']}>
                <StaffManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/shifts"
            element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <ShiftManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </AuthProvider>
  );
}
