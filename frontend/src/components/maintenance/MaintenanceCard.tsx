import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  User,
  Clock,
} from "lucide-react";
import type { MaintenanceDetail } from "@/lib/types";

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: {
    label: "Low",
    className: "bg-neutral-700 text-neutral-300 border-neutral-600",
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-blue-900/50 text-blue-400 border-blue-800",
  },
  HIGH: {
    label: "High",
    className: "bg-orange-900/50 text-orange-400 border-orange-800",
  },
  CRITICAL: {
    label: "Critical",
    className: "bg-red-900/50 text-red-400 border-red-800",
  },
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

interface MaintenanceCardProps {
  request: MaintenanceDetail;
  onMove?: (requestId: string, newStatus: string) => void;
  nextStatuses?: string[];
  isPrivileged?: boolean;
}

export function MaintenanceCard({
  request,
  onMove,
  nextStatuses = [],
  isPrivileged = false,
}: MaintenanceCardProps) {
  const priority = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.MEDIUM;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-800 p-4 transition-colors hover:border-neutral-700">
      {/* Header: Asset Tag + Priority */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-blue-400">
          {request.asset_tag || "N/A"}
        </span>
        <Badge
          variant="outline"
          className={cn("text-[10px] font-medium", priority.className)}
        >
          {priority.label}
        </Badge>
      </div>

      {/* Asset Name */}
      <p className="mb-1.5 text-sm font-medium text-white">
        {request.asset_name || "Unknown Asset"}
      </p>

      {/* Issue Description (truncated) */}
      <p className="mb-3 text-xs text-neutral-400 line-clamp-2">
        {request.issue_description}
      </p>

      {/* Footer: Requester + Time */}
      <div className="mb-3 flex items-center gap-3 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {request.requested_by_name || "User"}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(request.created_at)}
        </span>
      </div>

      {/* Assigned Technician */}
      {request.assigned_technician_name && (
        <div className="mb-3 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-400">
          Technician:{" "}
          <span className="text-neutral-300">
            {request.assigned_technician_name}
          </span>
        </div>
      )}

      {/* Resolution Notes */}
      {request.resolution_notes && (
        <div className="mb-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 px-2.5 py-1.5 text-[11px] text-emerald-400/80">
          {request.resolution_notes}
        </div>
      )}

      {/* Move Actions (fallback dropdown for DnD) */}
      {isPrivileged && nextStatuses.length > 0 && onMove && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-700/50">
          {nextStatuses.map((status) => (
            <button
              key={status}
              onClick={() => onMove(request.id, status)}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-700/50 px-2 py-1 text-[10px] font-medium text-neutral-300 transition-colors hover:bg-blue-600/20 hover:text-blue-400"
            >
              {formatStatusLabel(status)}
              <ChevronRight className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
