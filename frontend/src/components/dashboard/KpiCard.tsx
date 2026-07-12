import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  trend?: string;
  variant?: "default" | "accent" | "warning";
}

const variantStyles = {
  default: "border-neutral-800 bg-neutral-900",
  accent: "border-blue-900/40 bg-blue-950/30",
  warning: "border-amber-900/40 bg-amber-950/30",
};

const iconBg = {
  default: "bg-neutral-800 text-neutral-400",
  accent: "bg-blue-900/50 text-blue-400",
  warning: "bg-amber-900/50 text-amber-400",
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "transition-colors hover:border-neutral-700",
        variantStyles[variant]
      )}
    >
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              iconBg[variant]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && (
            <p className="mt-0.5 text-xs text-neutral-500">{trend}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
