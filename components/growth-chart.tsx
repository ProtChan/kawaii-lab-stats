"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartRow = Record<string, string | number | null>;
const compact = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

export function GrowthChart({
  data,
  groups,
  xKey = "date",
  connectNulls = true,
  zeroLine = false,
  seriesLinks = {},
}: {
  data: ChartRow[];
  groups: string[];
  xKey?: string;
  connectNulls?: boolean;
  zeroLine?: boolean;
  seriesLinks?: Record<string, string | undefined>;
}) {
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenGroups((current) => {
      const next = new Set([...current].filter((group) => groups.includes(group)));
      if (next.size === current.size && [...next].every((group) => current.has(group))) return current;
      return next;
    });
  }, [groups]);

  function toggleGroup(group: string) {
    setHiddenGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="chartBlock">
      <div className="chartSeriesControls" aria-label="グラフ系列の表示切替">
        <span>系列</span>
        {groups.map((group, index) => {
          const visible = !hiddenGroups.has(group);
          const href = seriesLinks[group];
          if (href) {
            return (
              <div className={`chartSeriesChip ${visible ? "active" : ""}`} key={group}>
                <button
                  type="button"
                  className="chartSeriesToggle"
                  aria-pressed={visible}
                  onClick={() => toggleGroup(group)}
                  title={`${group}を${visible ? "非表示" : "表示"}`}
                >
                  <i style={{ background: `var(--chart-${(index % 5) + 1})` }} />
                  <span className="srOnly">{group}を{visible ? "非表示" : "表示"}</span>
                </button>
                <Link href={href}>{group}</Link>
              </div>
            );
          }
          return (
            <button
              key={group}
              type="button"
              className={visible ? "active" : ""}
              aria-pressed={visible}
              onClick={() => toggleGroup(group)}
              title={`${group}を${visible ? "非表示" : "表示"}`}
            >
              <i style={{ background: `var(--chart-${(index % 5) + 1})` }} />
              {group}
            </button>
          );
        })}
        {hiddenGroups.size > 0 ? <button type="button" className="showAllSeries" onClick={() => setHiddenGroups(new Set())}>すべて表示</button> : null}
      </div>
      <div className="chartWrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={66} tickFormatter={(v) => compact.format(Number(v))} tickLine={false} axisLine={false} />
            {zeroLine ? <ReferenceLine y={0} stroke="var(--line2)" /> : null}
            <Tooltip formatter={(v) => v == null ? "—" : Number(v).toLocaleString("ja-JP")} contentStyle={{ background: "#11131a", border: "1px solid #2a2f3d", borderRadius: 12 }} />
            {groups.map((group, index) => <Line key={group} type="monotone" dataKey={group} hide={hiddenGroups.has(group)} stroke={`var(--chart-${(index % 5) + 1})`} strokeWidth={3} dot={data.length < 10} connectNulls={connectNulls} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
