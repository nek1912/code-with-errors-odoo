import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  count: number;
  message: string;
}

export function AlertBanner({ count, message }: AlertBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-red-900/40 bg-red-950/40 px-4 py-3"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-900/50">
        <AlertTriangle className="h-4 w-4 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-300">{message}</p>
    </div>
  );
}
