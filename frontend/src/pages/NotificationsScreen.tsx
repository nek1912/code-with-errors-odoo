import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/api";
import { CheckCheck, Bell } from "lucide-react";
import { useState } from "react";

const FILTER_TABS = [
  { label: "All", value: undefined },
  { label: "Alerts", value: "MAINTENANCE_REQUESTED" },
  { label: "Approvals", value: "MAINTENANCE_APPROVED" },
  { label: "Bookings", value: "BOOKING_CONFIRMED" },
] as const;

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(
    undefined
  );

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", activeFilter],
    queryFn: () => getNotifications({ filter_type: activeFilter, limit: 50 }),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications", activeFilter]);
      queryClient.setQueryData(
        ["notifications", activeFilter],
        (old: Awaited<ReturnType<typeof getNotifications>>) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id ? { ...item, is_read: true } : item
            ),
            unread_count: Math.max(0, old.unread_count - 1),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["notifications", activeFilter],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const notifications = data?.items || [];
  const unreadCount = data?.unread_count || 0;

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />
      <div className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-neutral-900 p-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveFilter(tab.value)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeFilter === tab.value
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 py-16">
              <Bell className="mb-3 h-10 w-10 text-neutral-600" />
              <h3 className="text-lg font-semibold text-white">
                No notifications
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
