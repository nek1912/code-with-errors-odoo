import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeftRight,
  CalendarClock,
  Box,
  Wrench,
  ClipboardCheck,
  UserPlus,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  entity_name: string;
  action_type: string;
  entity_type: string;
  user_name: string | null;
  timestamp: string;
}

const actionConfig: Record<
  string,
  { color: string; bg: string }
> = {
  CREATED: { color: "text-emerald-400", bg: "bg-emerald-950/50" },
  ALLOCATED: { color: "text-blue-400", bg: "bg-blue-950/50" },
  RETURNED: { color: "text-amber-400", bg: "bg-amber-950/50" },
  BOOKED: { color: "text-violet-400", bg: "bg-violet-950/50" },
  CANCELLED: { color: "text-red-400", bg: "bg-red-950/50" },
  TRANSFERRED: { color: "text-cyan-400", bg: "bg-cyan-950/50" },
  MAINTENANCE_REQUESTED: { color: "text-orange-400", bg: "bg-orange-950/50" },
  AUDIT_COMPLETED: { color: "text-teal-400", bg: "bg-teal-950/50" },
};

const entityIcons: Record<string, typeof Box> = {
  asset: Box,
  allocation: ArrowLeftRight,
  booking: CalendarClock,
  maintenance: Wrench,
  audit: ClipboardCheck,
  user: UserPlus,
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-6 pb-6 text-center text-sm text-neutral-500">
            No recent activity to display.
          </div>
        ) : (
          <ScrollArea className="h-[380px]">
            <div className="divide-y divide-neutral-800/60">
              {items.map((item) => {
                const config = actionConfig[item.action_type] ?? {
                  color: "text-neutral-400",
                  bg: "bg-neutral-800/50",
                };
                const Icon =
                  entityIcons[item.entity_type.toLowerCase()] ?? Box;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-neutral-800/30"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        config.bg
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">
                        <span className="font-medium">{item.entity_name}</span>
                        <span className="mx-1.5 text-neutral-600">&mdash;</span>
                        <span className={config.color}>
                          {item.action_type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </p>
                      {item.user_name && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          by {item.user_name}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
