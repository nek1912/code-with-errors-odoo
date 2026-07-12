import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { getActivityLogs } from "@/services/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

const ENTITY_TYPES = [
  { label: "All", value: undefined },
  { label: "Asset", value: "Asset" },
  { label: "Allocation", value: "Allocation" },
  { label: "Transfer", value: "Transfer" },
  { label: "Booking", value: "Booking" },
  { label: "Maintenance", value: "MaintenanceRequest" },
  { label: "Audit", value: "AuditCycle" },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-emerald-400",
  UPDATE: "text-blue-400",
  DELETE: "text-red-400",
  APPROVE: "text-emerald-400",
  REJECT: "text-red-400",
  CLOSE: "text-yellow-400",
  RETURN: "text-blue-400",
  STATUS_CHANGE: "text-blue-400",
};

export default function ActivityLogsTable() {
  const [entityFilter, setEntityFilter] = useState<string | undefined>(
    undefined
  );
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs", entityFilter, page],
    queryFn: () =>
      getActivityLogs({ entity_type: entityFilter, page, limit }),
  });

  const logs = data?.items || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="space-y-4">
      {/* Entity Type Filter */}
      <div className="flex gap-1 rounded-lg bg-neutral-900 p-1">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et.label}
            onClick={() => {
              setEntityFilter(et.value);
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              entityFilter === et.value
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 py-12 text-center">
          <p className="text-sm text-neutral-500">No activity logs found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-neutral-400">Action</TableHead>
                <TableHead className="text-neutral-400">Entity</TableHead>
                <TableHead className="text-neutral-400">User</TableHead>
                <TableHead className="text-neutral-400">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="border-neutral-800">
                  <TableCell>
                    <span
                      className={`text-sm font-medium ${
                        ACTION_COLORS[log.action_type] || "text-neutral-300"
                      }`}
                    >
                      {log.action_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {log.entity_type}
                    </span>
                    {log.entity_id && (
                      <span className="ml-2 font-mono text-xs text-neutral-500">
                        {log.entity_id.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {log.user_name || "System"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-neutral-500">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
