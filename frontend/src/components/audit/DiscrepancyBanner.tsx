import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscrepancyBannerProps {
  missingCount: number;
  damagedCount: number;
}

export function DiscrepancyBanner({
  missingCount,
  damagedCount,
}: DiscrepancyBannerProps) {
  const total = missingCount + damagedCount;

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        missingCount > 0
          ? "border-red-900/50 bg-red-950/50"
          : "border-yellow-900/50 bg-yellow-950/50"
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          missingCount > 0 ? "text-red-400" : "text-yellow-400"
        )}
      />
      <div>
        <p
          className={cn(
            "text-sm font-medium",
            missingCount > 0 ? "text-red-400" : "text-yellow-400"
          )}
        >
          {total} asset{total !== 1 ? "s" : ""} flagged — discrepancy report
          generated automatically
        </p>
        <div className="mt-1 flex gap-3 text-xs">
          {missingCount > 0 && (
            <span className="text-red-400/70">
              {missingCount} missing
            </span>
          )}
          {damagedCount > 0 && (
            <span className="text-yellow-400/70">
              {damagedCount} damaged
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
