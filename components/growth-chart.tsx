"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartRow = Record<string, string | number | null>;
const compact = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

function finiteValue(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function niceStep(raw: number) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / power;
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return factor * power;
}

function fittedDomain(values: number[], includeZero: boolean): [number, number] | undefined {
  if (!values.length) return undefined;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  const magnitude = Math.max(Math.abs(min), Math.abs(max), 1);
  const rawSpan = max - min;
  const span = rawSpan > 0 ? rawSpan : magnitude * 0.08;
  const padding = Math.max(span * 0.12, magnitude * 0.002);
  const paddedMin = min - padding;
  const paddedMax = max + padding;
  const step = niceStep((paddedMax - paddedMin) / 5);

  let lower = Math.floor(paddedMin / step) * step;
  let upper = Math.ceil(paddedMax / step) * step;

  if (includeZero) {
    lower = Math.min(lower, 0);
    upper = Math.max(upper, 0);
  }
  if (lower === upper) {
    lower -= step;
    upper += step;
  }

  return [lower, upper];
}

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

  const visibleGroups = useMemo(
    () => groups.filter((group) => !hiddenGroups.has(group)),
    [groups, hiddenGroups],
  );

  const visibleData = useMemo(() => {
    if (!data.length || !visibleGroups.length) return data;
    const hasVisibleValue = (row: ChartRow) => visibleGroups.some((group) => finiteValue(row[group]) != null);
    const first = data.findIndex(hasVisibleValue);
    if (first < 0) return data;
    let last = data.length - 1;
    while (last > first && !hasVisibleValue(data[last])) last -= 1;
    return data.slice(first, last + 1);
  }, [data, visibleGroups]);

  const yDomain = useMemo(() => {
    const values = visibleData.flatMap((row) =>
      visibleGroups
        .map((group) => finiteValue(row[group]))
        .filter((value): value is number => value != null),
    );
    return fittedDomain(values, zeroLine);
  }, [visibleData, visibleGroups, zeroLine]);

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
          <LineChart data={visibleData} margin={{ top: 12, right: 18, left: 8, bottom: 0 }}>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              width={66}
              domain={yDomain}
              allowDataOverflow={Boolean(yDomain)}
              tickFormatter={(v) => compact.format(Number(v))}
              tickLine={false}
              axisLine={false}
            />
            {zeroLine ? <ReferenceLine y={0} stroke="var(--line2)" /> : null}
            <Tooltip formatter={(v) => v == null ? "—" : Number(v).toLocaleString("ja-JP")} contentStyle={{ background: "#11131a", border: "1px solid #2a2f3d", borderRadius: 12 }} />
            {groups.map((group, index) => <Line key={group} type="monotone" dataKey={group} hide={hiddenGroups.has(group)} stroke={`var(--chart-${(index % 5) + 1})`} strokeWidth={3} dot={visibleData.length < 10} connectNulls={connectNulls} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
