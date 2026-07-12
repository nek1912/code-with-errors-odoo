import { Calendar, Users, MapPin, Shield } from "lucide-react";
import type { AuditCycleDetail } from "@/lib/types";

interface AuditCycleHeaderProps {
  cycle: AuditCycleDetail;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
}

export function AuditCycleHeader({ cycle }: AuditCycleHeaderProps) {
  const isClosed = cycle.status === "CLOSED";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          {/* Name */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/10">
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{cycle.name}</h2>
              {cycle.scope_name && (
                <p className="text-xs text-neutral-500">
                  Scope: {cycle.scope_name} ({cycle.scope_type})
                </p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateRange(cycle.start_date, cycle.end_date)}
            </span>
            {cycle.auditor_names.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {cycle.auditor_names.join(", ")}
              </span>
            )}
            {cycle.scope_name && cycle.scope_type !== "ALL" && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {cycle.scope_name}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            isClosed
              ? "bg-neutral-800 text-neutral-400"
              : "bg-emerald-600/20 text-emerald-400"
          }`}
        >
          {isClosed ? "Closed" : "Open"}
        </span>
      </div>
    </div>
  );
}
