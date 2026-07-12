import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Settings2,
  Box,
  ArrowLeftRight,
  CalendarClock,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { getUnreadNotificationCount } from "@/services/api";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/dashboard/org-setup", icon: Settings2, label: "Org Setup" },
  { to: "/dashboard/assets", icon: Box, label: "Assets" },
  { to: "/dashboard/allocation", icon: ArrowLeftRight, label: "Allocation" },
  { to: "/dashboard/booking", icon: CalendarClock, label: "Booking" },
  { to: "/dashboard/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/dashboard/audit", icon: ClipboardCheck, label: "Audit" },
  { to: "/dashboard/reports", icon: BarChart3, label: "Reports" },
  { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();

  const { data: unreadData } = useQuery({
    queryKey: ["unread-count"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-neutral-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Box className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">
          AssetFlow
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/dashboard"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {to === "/dashboard/notifications" && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-neutral-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-white">
            {user?.full_name?.charAt(0) ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {user?.role ?? "EMPLOYEE"}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
