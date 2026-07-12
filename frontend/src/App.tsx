import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthInit } from "@/hooks/useAuthInit";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ToastContainer } from "@/components/ui/toast";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import OrganizationSetup from "@/pages/OrganizationSetup";
import AssetDirectory from "@/pages/AssetDirectory";
import AllocationTransferScreen from "@/pages/AllocationTransferScreen";
import ResourceBookingScreen from "@/pages/ResourceBookingScreen";
import MaintenanceBoard from "@/pages/MaintenanceBoard";
import AuditListPage from "@/pages/AuditListPage";
import AuditScreen from "@/pages/AuditScreen";
import ReportsScreen from "@/pages/ReportsScreen";
import NotificationsScreen from "@/pages/NotificationsScreen";
import ActivityLogsTable from "@/pages/ActivityLogsTable";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes in memory
      refetchOnWindowFocus: false, // Stop refetching whenever user clicks browser window
      retry: 1,
    },
  },
});

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/org-setup"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <OrganizationSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/assets"
        element={
          <ProtectedRoute>
            <AssetDirectory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/allocation"
        element={
          <ProtectedRoute>
            <AllocationTransferScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/booking"
        element={
          <ProtectedRoute>
            <ResourceBookingScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/maintenance"
        element={
          <ProtectedRoute>
            <MaintenanceBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/audit"
        element={
          <ProtectedRoute>
            <AuditListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/audit/:auditId"
        element={
          <ProtectedRoute>
            <AuditScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/reports"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"]}>
            <ReportsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/notifications"
        element={
          <ProtectedRoute>
            <NotificationsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/activity-logs"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "ASSET_MANAGER"]}>
            <ActivityLogsTable />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  useAuthInit();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthRoutes />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
