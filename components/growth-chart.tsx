"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { timeline } from "@/lib/demo-data";

const groups = ["FRUITS ZIPPER", "CANDY TUNE", "SWEET STEADY", "CUTIE STREET", "MORE STAR"] as const;

export function GrowthChart() {
  return (
    <div className="chartWrap">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={timeline} margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => Number(v).toLocaleString()} />
          {groups.map((group, index) => (
            <Line key={group} type="monotone" dataKey={group} stroke={`var(--chart-${index + 1})`} strokeWidth={3} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
