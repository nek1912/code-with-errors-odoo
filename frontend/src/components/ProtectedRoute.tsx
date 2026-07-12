import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, only these roles can access the route. */
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role-based guarding
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role ?? "EMPLOYEE";
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
