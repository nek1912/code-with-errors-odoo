import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}) {
  const variants: Record<string, string> = {
    default: "bg-blue-600/20 text-blue-400 border-blue-600/30",
    secondary: "bg-neutral-800 text-neutral-300 border-neutral-700",
    destructive: "bg-red-600/20 text-red-400 border-red-600/30",
    outline: "border-neutral-700 text-neutral-300",
    success: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
    warning: "bg-amber-600/20 text-amber-400 border-amber-600/30",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
