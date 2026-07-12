import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateAuditItem } from "@/services/api";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/services/api";
import type { AuditItem } from "@/lib/types";

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dotColor: string }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-neutral-700 text-neutral-300 border-neutral-600",
    dotColor: "bg-neutral-500",
  },
  VERIFIED: {
    label: "Verified",
    className: "bg-emerald-900/50 text-emerald-400 border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  MISSING: {
    label: "Missing",
    className: "bg-red-900/50 text-red-400 border-red-800",
    dotColor: "bg-red-500",
  },
  DAMAGED: {
    label: "Damaged",
    className: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
    dotColor: "bg-yellow-500",
  },
};

interface AuditChecklistTableProps {
  items: AuditItem[];
  auditId: string;
  isClosed: boolean;
}

export function AuditChecklistTable({
  items,
  auditId,
  isClosed,
}: AuditChecklistTableProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      status,
    }: {
      itemId: string;
      status: string;
    }) => updateAuditItem(auditId, itemId, { physical_status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
    },
    onError: (error: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
      toast({
        title: "Update failed",
        description: getErrorMessage(error),
        variant: "error",
      });
    },
  });

  const handleStatusChange = (itemId: string, newStatus: string) => {
    if (isClosed) return;
    updateMutation.mutate({ itemId, status: newStatus });
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-800 hover:bg-transparent">
            <TableHead className="text-neutral-400">Asset</TableHead>
            <TableHead className="text-neutral-400">
              Expected Location
            </TableHead>
            <TableHead className="text-neutral-400">Assigned To</TableHead>
            <TableHead className="text-neutral-400 text-right">
              Verification
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-neutral-500"
              >
                No items in this audit cycle
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const config =
                STATUS_CONFIG[item.physical_status] || STATUS_CONFIG.PENDING;
              return (
                <TableRow
                  key={item.id}
                  className="border-neutral-800/50"
                >
                  <TableCell>
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-400">
                        {item.asset_tag || "N/A"}
                      </p>
                      <p className="text-sm text-white">
                        {item.asset_name || "Unknown Asset"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-400">
                    {item.asset_location || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-400">
                    {item.auditor_name || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isClosed ? (
                      <Badge
                        variant="outline"
                        className={cn("text-xs", config.className)}
                      >
                        <span
                          className={cn(
                            "mr-1.5 h-1.5 w-1.5 rounded-full",
                            config.dotColor
                          )}
                        />
                        {config.label}
                      </Badge>
                    ) : (
                      <select
                        value={item.physical_status}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value)
                        }
                        disabled={updateMutation.isPending}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                          "bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50",
                          item.physical_status === "VERIFIED" &&
                            "border-emerald-800 text-emerald-400",
                          item.physical_status === "MISSING" &&
                            "border-red-800 text-red-400",
                          item.physical_status === "DAMAGED" &&
                            "border-yellow-800 text-yellow-400",
                          item.physical_status === "PENDING" &&
                            "border-neutral-700 text-neutral-400"
                        )}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="MISSING">Missing</option>
                        <option value="DAMAGED">Damaged</option>
                      </select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
