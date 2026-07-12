import { cn } from "@/lib/utils";
import type { MaintenanceDetail } from "@/lib/types";
import { MaintenanceCard } from "./MaintenanceCard";

interface KanbanColumnProps {
  title: string;
  status: string;
  requests: MaintenanceDetail[];
  count: number;
  color?: string;
  onMove?: (requestId: string, newStatus: string) => void;
  get_next_statuses: (status: string) => string[];
  isPrivileged?: boolean;
}

export function KanbanColumn({
  title,
  status: _status,
  requests,
  count,
  color = "bg-neutral-600",
  onMove,
  get_next_statuses,
  isPrivileged = false,
}: KanbanColumnProps) {
  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-neutral-800 bg-neutral-900/50">
      {/* Column Header */}
      <div className="flex items-center gap-2.5 border-b border-neutral-800 px-4 py-3">
        <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="ml-auto rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
          {count}
        </span>
      </div>

      {/* Cards Container */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {requests.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-neutral-800">
            <p className="text-xs text-neutral-600">No requests</p>
          </div>
        ) : (
          requests.map((req) => (
            <MaintenanceCard
              key={req.id}
              request={req}
              onMove={onMove}
              nextStatuses={get_next_statuses(req.status)}
              isPrivileged={isPrivileged}
            />
          ))
        )}
      </div>
    </div>
  );
}
