import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  ArrowLeftRight,
  CalendarCheck,
  CalendarClock,
  ArrowRightLeft,
  RotateCcw,
  Plus,
  Wrench,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiData {
  value: number;
  label: string;
  trend?: string;
}

interface AlertData {
  count: number;
  message: string;
}

interface QuickActionsData {
  can_register_asset: boolean;
  can_book_resource: boolean;
  can_raise_request: boolean;
}

interface ActivityItemData {
  id: string;
  entity_name: string;
  action_type: string;
  entity_type: string;
  user_name: string | null;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface DashboardOverview {
  kpis: KpiData[];
  alert: AlertData | null;
  quick_actions: QuickActionsData;
  recent_activity: ActivityItemData[];
}

const kpiIcons = [Box, ArrowLeftRight, CalendarCheck, CalendarClock, ArrowRightLeft, RotateCcw];
const kpiVariants: Array<"default" | "accent" | "warning"> = [
  "default", "accent", "default", "accent", "default", "warning",
];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 bg-neutral-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-neutral-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl bg-neutral-800 lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl bg-neutral-800" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const res = await api.get("/dashboard/overview");
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <div className="flex min-h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 p-8">
        {isLoading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-neutral-500">
              Failed to load dashboard data. Please try again.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-white">Today's Overview</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Welcome back, {user?.full_name ?? "User"}
              </p>
            </div>

            {/* Alert Banner */}
            {data.alert && (
              <AlertBanner
                count={data.alert.count}
                message={data.alert.message}
              />
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.kpis.map((kpi, i) => (
                <KpiCard
                  key={kpi.label}
                  title={kpi.label}
                  value={kpi.value}
                  icon={kpiIcons[i]}
                  trend={kpi.trend}
                  variant={kpiVariants[i]}
                />
              ))}
            </div>

            {/* Quick Actions + Activity Feed */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Quick Actions */}
              <Card className="border-neutral-800 bg-neutral-900 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-white">
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.quick_actions.can_register_asset && (
                    <Button
                      className="w-full justify-start gap-2"
                      variant="default"
                      onClick={() => navigate("/dashboard/assets")}
                    >
                      <Plus className="h-4 w-4" />
                      Register Asset
                    </Button>
                  )}
                  {data.quick_actions.can_book_resource && (
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => navigate("/dashboard/booking")}
                    >
                      <CalendarClock className="h-4 w-4" />
                      Book Resource
                    </Button>
                  )}
                  {data.quick_actions.can_raise_request && (
                    <Button
                      className="w-full justify-start gap-2"
                      variant="outline"
                      onClick={() => navigate("/dashboard/maintenance")}
                    >
                      <Wrench className="h-4 w-4" />
                      Raise Request
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <div className="lg:col-span-2">
                <ActivityFeed items={data.recent_activity} />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
