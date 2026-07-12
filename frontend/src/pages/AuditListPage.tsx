import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus, Calendar, Users } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Button } from "@/components/ui/button";
import { getAuditCycles } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import type { AuditCycle } from "@/lib/types";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-US", opts)} - ${e.toLocaleDateString("en-US", opts)}`;
}

export default function AuditListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["audit-cycles"],
    queryFn: getAuditCycles,
  });

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />

      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Asset Audit
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage verification cycles and discrepancy reports
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => navigate("/dashboard/audit/new")}>
                <Plus className="mr-2 h-4 w-4" />
                New Audit Cycle
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            </div>
          ) : cycles.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800">
                  <ClipboardCheck className="h-7 w-7 text-neutral-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-neutral-400">
                  No audit cycles yet
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Create a new audit cycle to start verifying assets
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cycles.map((cycle: AuditCycle) => (
                <button
                  key={cycle.id}
                  onClick={() => navigate(`/dashboard/audit/${cycle.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-neutral-700"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {cycle.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateRange(cycle.start_date, cycle.end_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {cycle.scope_type}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      cycle.status === "CLOSED"
                        ? "bg-neutral-800 text-neutral-400"
                        : "bg-emerald-600/20 text-emerald-400"
                    }`}
                  >
                    {cycle.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
