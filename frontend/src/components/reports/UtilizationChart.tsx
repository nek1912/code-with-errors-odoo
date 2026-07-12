import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DeptUtilization } from "@/lib/types";

interface UtilizationChartProps {
  data: DeptUtilization[];
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
          {payload[0].value} allocated asset{payload[0].value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
}

export function UtilizationChart({ data }: UtilizationChartProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Utilization by Department
      </h3>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-neutral-500">No allocation data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis
              dataKey="dept_name"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              axisLine={{ stroke: "#262626" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.1)" }} />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
