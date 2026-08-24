"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { timeline as demoTimeline } from "@/lib/demo-data";

const demoGroups = ["FRUITS ZIPPER", "CANDY TUNE", "SWEET STEADY", "CUTIE STREET", "MORE STAR"];

type ChartRow = Record<string, string | number>;

export function GrowthChart({
  data = demoTimeline as ChartRow[],
  groups = demoGroups,
  xKey = "month",
}: {
  data?: ChartRow[];
  groups?: string[];
  xKey?: string;
}) {
  return (
    <div className="chartWrap">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => Number(v).toLocaleString()} />
          {groups.map((group, index) => (
            <Line
              key={group}
              type="monotone"
              dataKey={group}
              stroke={`var(--chart-${(index % 5) + 1})`}
              strokeWidth={3}
              dot={data.length < 10}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
