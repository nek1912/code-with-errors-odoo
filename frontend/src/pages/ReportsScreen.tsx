import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Button } from "@/components/ui/button";
import { getReportsOverview } from "@/services/api";
import { UtilizationChart } from "@/components/reports/UtilizationChart";
import { MaintenanceChart } from "@/components/reports/MaintenanceChart";
import { AssetListCard } from "@/components/reports/AssetListCard";
import { Download } from "lucide-react";

export default function ReportsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-overview"],
    queryFn: getReportsOverview,
  });

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[] = [];
    rows.push("Section,Label,Value");
    data.utilization_by_dept.forEach((d) =>
      rows.push(`Utilization,${d.dept_name},${d.count}`)
    );
    data.most_used_assets.forEach((a) =>
      rows.push(`Most Used,${a.asset_tag} - ${a.name},${a.booking_count}`)
    );
    data.idle_assets.forEach((a) =>
      rows.push(`Idle,${a.asset_tag} - ${a.name},${a.days_idle} days`)
    );
    data.retirement_alerts.forEach((a) =>
      rows.push(`Retirement Alert,${a.asset_tag} - ${a.name},"${a.reason}"`)
    );

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assetflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-neutral-950">
      <Sidebar />
      <div className="no-print flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Reports &amp; Analytics
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Asset utilization, maintenance trends, and operational insights
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700"
              >
                Print
              </Button>
              <Button
                onClick={handleExportCSV}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-900/20 p-4">
              <p className="text-sm text-red-400">
                Failed to load reports. Please try again later.
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <UtilizationChart data={data.utilization_by_dept} />
                <MaintenanceChart data={data.maintenance_frequency} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AssetListCard
                  title="Most Used Assets"
                  items={data.most_used_assets}
                  variant="most_used"
                />
                <AssetListCard
                  title="Idle Assets (60+ Days)"
                  items={data.idle_assets}
                  variant="idle"
                />
              </div>

              <AssetListCard
                title="Retirement Alerts"
                items={data.retirement_alerts}
                variant="alerts"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
