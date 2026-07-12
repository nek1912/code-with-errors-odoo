import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowLeftRight, Wrench, MapPin, Tag, Calendar, DollarSign } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssetDetail, updateAssetStatus, getErrorMessage } from "@/services/api";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/authStore";
import type { AssetDetail } from "@/lib/types";

interface AssetDetailsSheetProps {
  assetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  "AVAILABLE",
  "ALLOCATED",
  "RESERVED",
  "UNDER_MAINTENANCE",
  "LOST",
  "RETIRED",
  "DISPOSED",
] as const;

const PRIORITY_BADGE: Record<string, "destructive" | "warning" | "default" | "secondary"> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "default",
  LOW: "secondary",
};

const MAINT_STATUS_BADGE: Record<string, "warning" | "success" | "destructive" | "default" | "secondary"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "secondary",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function AssetDetailsSheet({ assetId, open, onOpenChange }: AssetDetailsSheetProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ["asset", assetId],
    queryFn: () => getAssetDetail(assetId!),
    enabled: open && !!assetId,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => updateAssetStatus(assetId!, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Status updated", variant: "success" });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to update status", description: getErrorMessage(error), variant: "error" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className="relative z-50 h-full w-full max-w-xl overflow-y-auto border-l border-neutral-800 bg-neutral-950 shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Asset Details</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !asset ? (
          <DetailSkeleton />
        ) : (
          <div className="p-6 space-y-6">
            {/* Summary card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{asset.name}</h3>
                  <p className="mt-1 font-mono text-sm text-blue-400">{asset.asset_tag}</p>
                </div>
                <StatusBadge status={asset.current_status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <span>{asset.category_name ?? "Uncategorized"}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{asset.location ?? "No location"}</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(asset.acquisition_date)}</span>
                </div>
                {asset.acquisition_cost !== null && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span>${asset.acquisition_cost.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {asset.serial_number && (
                <p className="mt-3 text-xs text-neutral-500">SN: {asset.serial_number}</p>
              )}
              {asset.condition_notes && (
                <p className="mt-2 text-xs text-neutral-500">Notes: {asset.condition_notes}</p>
              )}
            </div>

            {/* Status update (Admin/Asset Manager only) */}
            {canEdit && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                <h4 className="text-sm font-medium text-white mb-3">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => statusMutation.mutate(s)}
                      disabled={s === asset.current_status || statusMutation.isPending}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        s === asset.current_status
                          ? "bg-blue-600/20 text-blue-400 border border-blue-600/30 cursor-default"
                          : "border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Allocation History */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowLeftRight className="h-4 w-4 text-neutral-400" />
                <h4 className="text-sm font-medium text-white">
                  Allocation History ({asset.allocation_history.length})
                </h4>
              </div>
              {asset.allocation_history.length === 0 ? (
                <p className="text-xs text-neutral-500">No allocation history</p>
              ) : (
                <div className="space-y-3">
                  {asset.allocation_history.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{a.user_name ?? "Unknown"}</span>
                        <Badge variant={a.status === "ACTIVE" ? "success" : "secondary"}>
                          {a.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDateTime(a.allocated_at)} → {formatDateTime(a.actual_return_date ?? a.expected_return_date)}
                      </p>
                      {a.department_name && (
                        <p className="mt-1 text-xs text-neutral-500">Dept: {a.department_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance History */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="h-4 w-4 text-neutral-400" />
                <h4 className="text-sm font-medium text-white">
                  Maintenance History ({asset.maintenance_history.length})
                </h4>
              </div>
              {asset.maintenance_history.length === 0 ? (
                <p className="text-xs text-neutral-500">No maintenance history</p>
              ) : (
                <div className="space-y-3">
                  {asset.maintenance_history.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">
                          {m.requested_by_name ?? "Unknown"}
                        </span>
                        <div className="flex gap-2">
                          <Badge variant={PRIORITY_BADGE[m.priority] ?? "secondary"}>
                            {m.priority}
                          </Badge>
                          <Badge variant={MAINT_STATUS_BADGE[m.status] ?? "secondary"}>
                            {m.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-neutral-400 line-clamp-2">
                        {m.issue_description}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDateTime(m.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
