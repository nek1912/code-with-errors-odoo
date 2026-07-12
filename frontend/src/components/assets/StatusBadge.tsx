import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "default" | "warning" | "destructive" | "secondary" }
> = {
  AVAILABLE: { label: "Available", variant: "success" },
  ALLOCATED: { label: "Allocated", variant: "default" },
  RESERVED: { label: "Reserved", variant: "secondary" },
  UNDER_MAINTENANCE: { label: "Maintenance", variant: "warning" },
  LOST: { label: "Lost", variant: "destructive" },
  RETIRED: { label: "Retired", variant: "secondary" },
  DISPOSED: { label: "Disposed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
