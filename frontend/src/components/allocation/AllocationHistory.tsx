import { ArrowLeftRight, CheckCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AllocationHistoryItem } from "@/lib/types";

interface AllocationHistoryProps {
  history: AllocationHistoryItem[];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AllocationHistory({ history }: AllocationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <ArrowLeftRight className="mx-auto h-8 w-8 text-neutral-600" />
        <p className="mt-3 text-sm text-neutral-500">No allocation history</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h3 className="mb-4 text-sm font-medium text-white">Allocation History</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-neutral-800" />

        <div className="space-y-4">
          {history.map((item, i) => {
            const isReturned = item.status === "RETURNED" || item.status === "TRANSFERRED";
            const isReturnedCondition = item.status === "RETURNED";

            return (
              <div key={item.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 mt-0.5">
                  {isReturned ? (
                    <RotateCcw className="h-[30px] w-[30px] rounded-full border border-neutral-700 bg-neutral-800 p-1.5 text-neutral-400" />
                  ) : (
                    <CheckCircle className="h-[30px] w-[30px] rounded-full border border-blue-600/30 bg-blue-600/10 p-1.5 text-blue-400" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-neutral-500">
                      {formatDate(item.allocated_at)}
                    </span>
                    <Badge variant={isReturned ? "secondary" : "default"}>
                      {isReturned ? "Returned" : "Allocated"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-white">
                    {isReturned ? "Returned by" : "Allocated to"}{" "}
                    <span className="font-medium">{item.user_name ?? "Unknown"}</span>
                  </p>
                  {item.department_name && (
                    <p className="text-xs text-neutral-500">{item.department_name}</p>
                  )}
                  {item.actual_return_date && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Returned: {formatDate(item.actual_return_date)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
