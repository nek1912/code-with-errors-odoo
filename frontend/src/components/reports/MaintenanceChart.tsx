import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MaintenanceFrequency } from "@/lib/types";

interface MaintenanceChartProps {
  data: MaintenanceFrequency[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-neutral-400">
          {payload[0].value} request{payload[0].value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
}

export function MaintenanceChart({ data }: MaintenanceChartProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Maintenance Frequency
      </h3>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-neutral-500">No maintenance data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: "#2563eb", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
