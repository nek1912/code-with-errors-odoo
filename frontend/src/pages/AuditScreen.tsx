import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  Lock,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AuditCycleHeader } from "@/components/audit/AuditCycleHeader";
import { AuditChecklistTable } from "@/components/audit/AuditChecklistTable";
import { DiscrepancyBanner } from "@/components/audit/DiscrepancyBanner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getAuditCycleDetail,
  closeAuditCycle,
  getErrorMessage,
} from "@/services/api";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/authStore";
import type { AuditCycleCloseResult } from "@/lib/types";

export default function AuditScreen() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isPrivileged =
    user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeResult, setCloseResult] = useState<AuditCycleCloseResult | null>(
    null
  );
  const queryClient = useQueryClient();

  const {
    data: cycle,
    isLoading,
  } = useQuery({
    queryKey: ["audit", auditId],
    queryFn: () => getAuditCycleDetail(auditId!),
    enabled: !!auditId,
  });

  const closeMutation = useMutation({
    mutationFn: () => closeAuditCycle(auditId!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["audit-cycles"] });
      setCloseResult(result);
      setCloseDialogOpen(false);
      toast({ title: "Audit cycle closed", variant: "success" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to close audit cycle",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const discrepancyItems = useMemo(() => {
    if (!cycle) return [];
    return cycle.items.filter(
      (item) =>
        item.physical_status === "MISSING" ||
        item.physical_status === "DAMAGED"
    );
  }, [cycle]);

  const missingCount = useMemo(
    () =>
      cycle
        ? cycle.items.filter((i) => i.physical_status === "MISSING").length
        : 0,
    [cycle]
  );

  const damagedCount = useMemo(
    () =>
      cycle
        ? cycle.items.filter((i) => i.physical_status === "DAMAGED").length
        : 0,
    [cycle]
  );

  const isClosed = cycle?.status === "CLOSED";

  const exportCSV = () => {
    if (!cycle) return;
    const rows = [
      ["Asset Tag", "Asset Name", "Location", "Status", "Notes", "Auditor"],
      ...discrepancyItems.map((item) => [
        item.asset_tag || "",
        item.asset_name || "",
        item.asset_location || "",
        item.physical_status,
        item.notes || "",
        item.auditor_name || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${cycle.name.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Back + Title */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Asset Audit
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Verify physical asset status and generate discrepancy reports
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            </div>
          ) : !cycle ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800">
                  <ClipboardCheck className="h-7 w-7 text-neutral-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-400">
                  Audit cycle not found
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate(-1)}
                >
                  Go Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cycle Header */}
              <AuditCycleHeader cycle={cycle} />

              {/* Discrepancy Banner */}
              <DiscrepancyBanner
                missingCount={missingCount}
                damagedCount={damagedCount}
              />

              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">
                  {cycle.items.length} total asset
                  {cycle.items.length !== 1 ? "s" : ""} to verify
                </p>
                <div className="flex gap-3">
                  {discrepancyItems.length > 0 && (
                    <Button variant="outline" onClick={exportCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      Export Report
                    </Button>
                  )}
                  {isPrivileged && !isClosed && (
                    <Button
                      variant="destructive"
                      onClick={() => setCloseDialogOpen(true)}
                      disabled={closeMutation.isPending}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      {closeMutation.isPending
                        ? "Closing..."
                        : "Close Audit Cycle"}
                    </Button>
                  )}
                  {isClosed && (
                    <Button variant="outline" disabled>
                      <Lock className="mr-2 h-4 w-4" />
                      Cycle Closed
                    </Button>
                  )}
                </div>
              </div>

              {/* Audit Checklist Table */}
              <AuditChecklistTable
                items={cycle.items}
                auditId={cycle.id}
                isClosed={isClosed}
              />

              {/* Close Result Summary */}
              {closeResult && (
                <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/50 p-6">
                  <h3 className="mb-3 text-sm font-semibold text-emerald-400">
                    Audit Cycle Closed Successfully
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-neutral-500">Total Items</p>
                      <p className="text-lg font-semibold text-white">
                        {closeResult.total_items}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Verified</p>
                      <p className="text-lg font-semibold text-emerald-400">
                        {closeResult.verified_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Marked Lost</p>
                      <p className="text-lg font-semibold text-red-400">
                        {closeResult.assets_marked_lost}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Allocations Terminated</p>
                      <p className="text-lg font-semibold text-yellow-400">
                        {closeResult.allocations_terminated}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Close Confirmation Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent onClose={() => setCloseDialogOpen(false)}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/10">
                <Lock className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <DialogTitle>Close Audit Cycle</DialogTitle>
                <DialogDescription>
                  This action is irreversible
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                Closing this audit cycle will:
              </p>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  Mark all &quot;Missing&quot; assets as LOST in the system
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                  Terminate any active allocations for missing assets
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500" />
                  Lock all items from further edits
                </li>
              </ul>
              {missingCount > 0 && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
                  {missingCount} asset{missingCount !== 1 ? "s" : ""} will be
                  marked as LOST
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? "Closing..." : "Close Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
