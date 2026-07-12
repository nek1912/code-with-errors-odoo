import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle, UserPlus, ArrowLeftRight, RotateCcw } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AssetSelector } from "@/components/allocation/AssetSelector";
import { TransferForm } from "@/components/allocation/TransferForm";
import { AllocationHistory } from "@/components/allocation/AllocationHistory";
import {
  getAllocationStatus,
  getAssetDetail,
  createAllocation,
  getEmployees,
  getErrorMessage,
  returnAsset,
} from "@/services/api";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "@/stores/authStore";
import type { Asset, AllocationHistoryItem } from "@/lib/types";

// ── Direct Allocation Form Schema ──────────────────────────────

const allocateSchema = z.object({
  user_id: z.string().min(1, "Select a user"),
  expected_return_date: z.string().optional(),
  condition_notes: z.string().optional(),
});

type AllocateFormValues = z.infer<typeof allocateSchema>;

// ── Employee Selector (for direct allocation) ──────────────────

function UserSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-selector"],
    queryFn: getEmployees,
  });

  const selected = employees.find((e) => e.id === value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none pr-8"
    >
      <option value="">Select employee...</option>
      {employees
        .filter((e) => e.is_active)
        .map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name} — {e.role}
          </option>
        ))}
    </select>
  );
}

// ── Main Screen ────────────────────────────────────────────────

export default function AllocationTransferScreen() {
  const { user } = useAuthStore();
  const canAllocate = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER" || user?.role === "DEPARTMENT_HEAD";

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const queryClient = useQueryClient();

  // Fetch allocation status when asset is selected
  const { data: allocStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["allocation-status", selectedAsset?.id],
    queryFn: () => getAllocationStatus(selectedAsset!.id),
    enabled: !!selectedAsset,
  });

  // Fetch allocation history from asset detail
  const { data: assetDetail } = useQuery({
    queryKey: ["asset-detail", selectedAsset?.id],
    queryFn: () => getAssetDetail(selectedAsset!.id),
    enabled: !!selectedAsset,
  });

  // ── Direct Allocation ────────────────────────────────────────

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AllocateFormValues>({
    resolver: zodResolver(allocateSchema),
    defaultValues: { user_id: "", expected_return_date: "", condition_notes: "" },
  });

  const allocateMutation = useMutation({
    mutationFn: createAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-status"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Asset allocated successfully", variant: "success" });
      reset();
    },
    onError: (error: unknown) => {
      toast({
        title: "Allocation failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const onAllocate = (values: AllocateFormValues) => {
    if (!selectedAsset) return;
    allocateMutation.mutate({
      asset_id: selectedAsset.id,
      user_id: values.user_id,
      expected_return_date: values.expected_return_date || undefined,
      condition_notes: values.condition_notes || undefined,
    });
  };

  // ── Transfer success handler ─────────────────────────────────
  const [activeAction, setActiveAction] = useState<"transfer" | "return">("transfer");
  const [returnNotes, setReturnNotes] = useState("");

  const handleTransferSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["allocation-status", selectedAsset?.id] });
    queryClient.invalidateQueries({ queryKey: ["asset-detail", selectedAsset?.id] });
  };

  const returnMutation = useMutation({
    mutationFn: () => returnAsset(allocStatus!.active_allocation_id!, returnNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-status"] });
      queryClient.invalidateQueries({ queryKey: ["asset-detail"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({ title: "Asset returned successfully", variant: "success" });
      setReturnNotes("");
      setSelectedAsset(null); // Clear selection to refresh
    },
    onError: (error: unknown) => {
      toast({
        title: "Return failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    returnMutation.mutate();
  };

  const allocationHistory = (assetDetail?.allocation_history ?? []) as AllocationHistoryItem[];
  const isAllocated = allocStatus?.is_allocated ?? false;
  const holder = allocStatus?.current_holder;

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none";
  const labelCls = "block text-sm font-medium text-neutral-300 mb-1.5";
  const errorCls = "mt-1 text-xs text-red-400";

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">Allocation & Transfer</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Assign assets to employees or initiate transfer requests
            </p>
          </div>

          {/* Asset Selector */}
          <div className="mb-6">
            <label className={labelCls}>Select Asset</label>
            <AssetSelector
              value={selectedAsset}
              onSelect={setSelectedAsset}
              placeholder="Search by tag, name, or serial number..."
            />
          </div>

          {/* Loading state */}
          {selectedAsset && statusLoading && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
              <p className="mt-3 text-sm text-neutral-500">Loading allocation status...</p>
            </div>
          )}

          {/* Conflict Warning Banner */}
          {allocStatus && isAllocated && holder && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Already Allocated to {holder.user_name}
                  {holder.department_name ? ` (${holder.department_name})` : ""}
                </p>
                <p className="mt-1 text-xs text-red-400/70">
                  Direct re-allocation is blocked. Submit a transfer request below to move this asset to a different employee.
                </p>
              </div>
            </div>
          )}

          {/* Available Banner */}
          {allocStatus && !isAllocated && allocStatus.current_status === "AVAILABLE" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/50 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Asset Available</p>
                <p className="mt-1 text-xs text-emerald-400/70">
                  This asset is available for direct allocation.
                </p>
              </div>
            </div>
          )}

          {/* Asset info card */}
          {allocStatus && (
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800">
                  <ArrowLeftRight className="h-5 w-5 text-neutral-400" />
                </div>
                <div>
                  <p className="font-mono text-sm font-medium text-blue-400">
                    {allocStatus.asset_tag}
                  </p>
                  <p className="text-xs text-neutral-500">{allocStatus.asset_name}</p>
                </div>
                <div className="ml-auto">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      isAllocated
                        ? "bg-blue-600/20 text-blue-400"
                        : "bg-emerald-600/20 text-emerald-400"
                    }`}
                  >
                    {allocStatus.current_status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Forms */}
          {allocStatus && canAllocate && (
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
              {isAllocated && holder ? (
                <div className="space-y-6">
                  {/* Action Selector Tabs */}
                  <div className="flex border-b border-neutral-800 pb-3">
                    <button
                      type="button"
                      onClick={() => setActiveAction("transfer")}
                      className={`mr-4 pb-2 text-sm font-medium border-b-2 transition-colors ${
                        activeAction === "transfer"
                          ? "border-blue-500 text-white"
                          : "border-transparent text-neutral-400 hover:text-white"
                      }`}
                    >
                      Transfer Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAction("return")}
                      className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                        activeAction === "return"
                          ? "border-blue-500 text-white"
                          : "border-transparent text-neutral-400 hover:text-white"
                      }`}
                    >
                      Return Asset
                    </button>
                  </div>

                  {activeAction === "transfer" ? (
                    <>
                      <div className="mb-4 flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4 text-neutral-400" />
                        <h2 className="text-sm font-medium text-white">Transfer Request</h2>
                      </div>
                      <TransferForm
                        asset={selectedAsset!}
                        currentHolderId={holder.user_id}
                        currentHolderName={holder.user_name}
                        onSuccess={handleTransferSuccess}
                      />
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-neutral-400" />
                        <h2 className="text-sm font-medium text-white">Return Asset</h2>
                      </div>
                      <form onSubmit={handleReturnSubmit} className="space-y-4">
                        <div>
                          <label className={labelCls}>Condition check-in notes</label>
                          <textarea
                            value={returnNotes}
                            onChange={(e) => setReturnNotes(e.target.value)}
                            rows={3}
                            className={`${inputCls} resize-none`}
                            placeholder="Describe condition upon return (e.g. Excellent, minor scratches, fully working)..."
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={returnMutation.isPending}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {returnMutation.isPending ? "Processing Return..." : "Confirm Return"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : allocStatus.current_status === "AVAILABLE" ? (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-neutral-400" />
                    <h2 className="text-sm font-medium text-white">Direct Allocation</h2>
                  </div>
                  <form onSubmit={handleSubmit(onAllocate)} className="space-y-4">
                    <div>
                      <label className={labelCls}>Allocate To *</label>
                      <UserSelector
                        value={watch("user_id")}
                        onChange={(id) => setValue("user_id", id, { shouldValidate: true })}
                      />
                      {errors.user_id && <p className={errorCls}>{errors.user_id.message}</p>}
                    </div>

                    <div>
                      <label className={labelCls}>Expected Return Date</label>
                      <input
                        type="date"
                        {...register("expected_return_date")}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Condition Notes</label>
                      <textarea
                        {...register("condition_notes")}
                        rows={2}
                        className={`${inputCls} resize-none`}
                        placeholder="Optional notes about asset condition..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={allocateMutation.isPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      {allocateMutation.isPending ? "Allocating..." : "Allocate Directly"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-lg border border-amber-950/50 bg-amber-950/20 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-400">Allocation Blocked</h3>
                    <p className="mt-1 text-xs text-amber-400/70">
                      This asset is currently in <strong>{allocStatus.current_status}</strong> status. Only assets with a status of <strong>AVAILABLE</strong> can be directly allocated.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Allocation History */}
          {selectedAsset && allocationHistory.length > 0 && (
            <AllocationHistory history={allocationHistory} />
          )}
        </div>
      </main>
    </div>
  );
}
