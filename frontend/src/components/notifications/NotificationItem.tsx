import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { NotificationItem as NotificationItemType } from "@/lib/types";

interface NotificationItemProps {
  notification: NotificationItemType;
  onMarkRead: (id: string) => void;
}

const DOT_COLORS: Record<string, string> = {
  BOOKING_CONFIRMED: "bg-blue-400",
  BOOKING_CANCELLED: "bg-yellow-400",
  ASSET_ALLOCATED: "bg-blue-400",
  ASSET_RETURNED: "bg-blue-400",
  MAINTENANCE_REQUESTED: "bg-yellow-400",
  MAINTENANCE_APPROVED: "bg-emerald-400",
  MAINTENANCE_REJECTED: "bg-red-400",
  MAINTENANCE_RESOLVED: "bg-emerald-400",
  AUDIT_ASSIGNED: "bg-yellow-400",
  GENERAL: "bg-neutral-400",
};

export function NotificationItem({
  notification,
  onMarkRead,
}: NotificationItemProps) {
  const dotColor = DOT_COLORS[notification.type] || "bg-neutral-400";

  const relativeTime = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={() => !notification.is_read && onMarkRead(notification.id)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors",
        notification.is_read
          ? "bg-transparent hover:bg-neutral-800/30"
          : "bg-neutral-800/50 hover:bg-neutral-800"
      )}
    >
      <span
        className={cn(
          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
          dotColor
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            notification.is_read
              ? "font-normal text-neutral-300"
              : "font-semibold text-white"
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {notification.message}
        </p>
      </div>
      <span className="shrink-0 text-xs text-neutral-500">{relativeTime}</span>
    </button>
  );
}
