import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { KanbanColumn } from "@/components/maintenance/KanbanColumn";
import { RaiseRequestModal } from "@/components/maintenance/RaiseRequestModal";
import { Button } from "@/components/ui/button";
import {
  getMaintenanceRequests,
  updateMaintenanceStatus,
  getErrorMessage,
} from "@/services/api";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/authStore";
import type { MaintenanceDetail } from "@/lib/types";

// ── State Machine (mirrors backend) ─────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["TECHNICIAN_ASSIGNED"],
  TECHNICIAN_ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  REJECTED: [],
  RESOLVED: [],
};

const COLUMNS = [
  {
    status: "PENDING",
    title: "Pending",
    color: "bg-yellow-500",
  },
  {
    status: "APPROVED",
    title: "Approved",
    color: "bg-blue-500",
  },
  {
    status: "TECHNICIAN_ASSIGNED",
    title: "Technician Assigned",
    color: "bg-purple-500",
  },
  {
    status: "IN_PROGRESS",
    title: "In Progress",
    color: "bg-orange-500",
  },
  {
    status: "RESOLVED",
    title: "Resolved",
    color: "bg-emerald-500",
  },
];

export default function MaintenanceBoard() {
  const { user } = useAuthStore();
  const isPrivileged =
    user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: requests = [],
    isLoading,
  } = useQuery({
    queryKey: ["maintenance"],
    queryFn: getMaintenanceRequests,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      requestId,
      newStatus,
    }: {
      requestId: string;
      newStatus: string;
    }) => updateMaintenanceStatus(requestId, { new_status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      toast({ title: "Status updated", variant: "success" });
    },
    onError: (error: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      toast({
        title: "Update failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const handleMove = (requestId: string, newStatus: string) => {
    statusMutation.mutate({ requestId, newStatus });
  };

  const get_next_statuses = (status: string): string[] => {
    return VALID_TRANSITIONS[status] || [];
  };

  // Group requests by status
  const grouped = useMemo(() => {
    const map: Record<string, MaintenanceDetail[]> = {
      PENDING: [],
      APPROVED: [],
      TECHNICIAN_ASSIGNED: [],
      IN_PROGRESS: [],
      RESOLVED: [],
      REJECTED: [],
    };
    for (const req of requests) {
      if (map[req.status]) {
        map[req.status].push(req);
      }
    }
    return map;
  }, [requests]);

  // Filter out REJECTED from visible columns (show as separate section if needed)
  const visibleColumns = COLUMNS;

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Maintenance Board
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Track and manage asset maintenance requests
            </p>
          </div>
          <Button onClick={() => setRaiseModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Raise Request
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              {visibleColumns.map((col) => (
                <KanbanColumn
                  key={col.status}
                  title={col.title}
                  status={col.status}
                  requests={grouped[col.status] || []}
                  count={(grouped[col.status] || []).length}
                  color={col.color}
                  onMove={isPrivileged ? handleMove : undefined}
                  get_next_statuses={get_next_statuses}
                  isPrivileged={isPrivileged}
                />
              ))}
            </div>
          )}

          {/* Rejected section */}
          {!isLoading && grouped.REJECTED.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <h3 className="text-sm font-semibold text-neutral-400">
                  Rejected
                </h3>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                  {grouped.REJECTED.length}
                </span>
              </div>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {grouped.REJECTED.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-red-900/30 bg-neutral-900/30 p-4 opacity-60"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {req.asset_tag || "N/A"}
                      </span>
                      <span className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                        Rejected
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">
                      {req.asset_name || "Unknown Asset"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-1">
                      {req.issue_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && requests.length === 0 && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800">
                  <Wrench className="h-7 w-7 text-neutral-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-400">
                  No maintenance requests yet
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Click &quot;Raise Request&quot; to report an issue with an
                  asset
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <RaiseRequestModal
        open={raiseModalOpen}
        onOpenChange={setRaiseModalOpen}
      />
    </div>
  );
}
