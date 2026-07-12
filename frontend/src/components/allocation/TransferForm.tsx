import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Send, ArrowRight } from "lucide-react";
import { getEmployees, createTransfer, getErrorMessage } from "@/services/api";
import { toast } from "@/components/ui/toast";
import type { Asset, Employee } from "@/lib/types";

// ── Transfer Form Schema ───────────────────────────────────────

const transferSchema = z.object({
  to_user_id: z.string().min(1, "Select a recipient"),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

type TransferFormValues = z.infer<typeof transferSchema>;

// ── Employee Selector ──────────────────────────────────────────

function EmployeeSelector({
  value,
  onChange,
  excludeId,
}: {
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-selector"],
    queryFn: getEmployees,
    enabled: open,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = employees.filter(
    (e) =>
      e.is_active &&
      e.id !== excludeId &&
      (e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = employees.find((e) => e.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-left transition-colors hover:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50"
      >
        {selected ? (
          <span className="text-white">{selected.full_name}</span>
        ) : (
          <span className="text-neutral-500">Select employee...</span>
        )}
        <svg className="h-4 w-4 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/40">
          <div className="border-b border-neutral-800 p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-sm text-neutral-500">No employees found</div>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onChange(emp.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-800"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium text-white">
                    {emp.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white">{emp.full_name}</p>
                    <p className="text-xs text-neutral-500">
                      {emp.role} {emp.department_name ? `• ${emp.department_name}` : ""}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer Form ──────────────────────────────────────────────

interface TransferFormProps {
  asset: Asset;
  currentHolderId: string;
  currentHolderName: string;
  onSuccess: () => void;
}

export function TransferForm({
  asset,
  currentHolderId,
  currentHolderName,
  onSuccess,
}: TransferFormProps) {
  const queryClient = useQueryClient();

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { to_user_id: "", reason: "" },
  });

  const toUserId = watch("to_user_id");
  const reason = watch("reason");

  const mutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast({ title: "Transfer request submitted", variant: "success" });
      onSuccess();
    },
    onError: (error: unknown) => {
      toast({
        title: "Transfer failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const onSubmit = (values: TransferFormValues) => {
    mutation.mutate({
      asset_id: asset.id,
      from_user_id: currentHolderId,
      to_user_id: values.to_user_id,
      reason: values.reason,
    });
  };

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 appearance-none";
  const labelCls = "block text-sm font-medium text-neutral-300 mb-1.5";
  const errorCls = "mt-1 text-xs text-red-400";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* From / To row */}
      <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-3">
        {/* From */}
        <div>
          <label className={labelCls}>From</label>
          <input
            value={currentHolderName}
            readOnly
            className={`${inputCls} cursor-not-allowed opacity-60`}
          />
        </div>

        <div className="pb-2.5">
          <ArrowRight className="h-5 w-5 text-neutral-500" />
        </div>

        {/* To */}
        <div>
          <label className={labelCls}>To *</label>
          <EmployeeSelector
            value={toUserId}
            onChange={(id) => setValue("to_user_id", id, { shouldValidate: true })}
            excludeId={currentHolderId}
          />
          {errors.to_user_id && <p className={errorCls}>{errors.to_user_id.message}</p>}
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className={labelCls}>Reason *</label>
        <textarea
          value={reason}
          onChange={(e) => {
            setValue("reason", e.target.value, { shouldValidate: true });
          }}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Explain why this transfer is needed..."
        />
        {errors.reason && <p className={errorCls}>{errors.reason.message}</p>}
      </div>

      {/* Warning for shared asset */}
      {asset.is_shared && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300">
            This asset is shared. Transfers on shared assets require extra approval.
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending || !toUserId || !reason}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="h-4 w-4" />
        {mutation.isPending ? "Submitting..." : "Submit Transfer Request"}
      </button>
    </form>
  );
}
