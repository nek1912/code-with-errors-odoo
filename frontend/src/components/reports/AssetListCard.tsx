import { cn } from "@/lib/utils";
import { BarChart3, Clock } from "lucide-react";

interface AssetListItem {
  asset_tag: string;
  name: string;
  booking_count?: number;
  days_idle?: number;
  reason?: string;
}

interface AssetListCardProps {
  title: string;
  items: AssetListItem[];
  variant: "most_used" | "idle" | "alerts";
}

export function AssetListCard({ title, items, variant }: AssetListCardProps) {
  const icon =
    variant === "most_used" ? (
      <BarChart3 className="h-5 w-5 text-blue-400" />
    ) : (
      <Clock className="h-5 w-5 text-yellow-400" />
    );

  const metricLabel = (item: AssetListItem) => {
    if (item.booking_count !== undefined) {
      return `${item.booking_count} booking${item.booking_count !== 1 ? "s" : ""}`;
    }
    if (item.days_idle !== undefined) {
      return `${item.days_idle} day${item.days_idle !== 1 ? "s" : ""} idle`;
    }
    if (item.reason) {
      return item.reason;
    }
    return "";
  };

  const metricColor = (item: AssetListItem) => {
    if (item.booking_count !== undefined) return "text-emerald-400";
    if (item.days_idle !== undefined) {
      if (item.days_idle > 90) return "text-red-400";
      if (item.days_idle > 60) return "text-yellow-400";
      return "text-neutral-400";
    }
    return "text-yellow-400";
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">
          No data available
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.asset_tag}
              className="flex items-center justify-between rounded-lg bg-neutral-800/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{item.name}</p>
                <p className="font-mono text-xs text-blue-400">
                  {item.asset_tag}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  metricColor(item)
                )}
              >
                {metricLabel(item)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
