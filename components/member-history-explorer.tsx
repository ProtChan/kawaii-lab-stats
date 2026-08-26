"use client";

import { useMemo, useState } from "react";
import { GrowthChart } from "@/components/growth-chart";
import type { MemberTimelinePoint } from "@/lib/analytics";

const series = ["Total", "X", "Instagram", "TikTok", "YouTube"] as const;
type SeriesKey = (typeof series)[number];
type ViewMode = "level" | "daily";

const signed = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(value)}`;

function deltaRows(data: MemberTimelinePoint[]) {
  return data.slice(1).map((point, index) => {
    const previous = data[index];
    const row: Record<string, string | number | null> = { date: point.date };
    for (const key of series) {
      const before = previous[key];
      const after = point[key];
      row[key] = typeof before === "number" && typeof after === "number" ? after - before : null;
    }
    return row;
  });
}

export function MemberHistoryExplorer({ data }: { data: MemberTimelinePoint[] }) {
  const [view, setView] = useState<ViewMode>("level");
  const daily = useMemo(() => deltaRows(data), [data]);
  const chartData = view === "daily" ? daily : data;
  const latestDaily = daily.at(-1) ?? null;

  return (
    <section className="panel">
      <div className="sectionHead memberHistoryHead">
        <div>
          <p className="eyebrow">{view === "daily" ? "DAILY AUDIENCE CHANGE" : "AUDIENCE HISTORY"}</p>
          <h2>{view === "daily" ? "SNS別フォロワー前日比" : "SNS別フォロワー推移"}</h2>
        </div>
        <div className="memberHistoryActions">
          <div className="segmented" aria-label="個人履歴の表示モード">
            <button type="button" className={view === "level" ? "active" : ""} onClick={() => setView("level")}>Total</button>
            <button type="button" className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>1-day Δ</button>
          </div>
          <span>{view === "daily" ? `${daily.length} daily intervals` : `${data.length} snapshots`}</span>
        </div>
      </div>

      {view === "daily" && latestDaily ? (
        <div className="memberDeltaStrip">
          {series.map((key) => {
            const value = latestDaily[key];
            return (
              <div key={key}>
                <span>{key}</span>
                <strong className={typeof value === "number" && value < 0 ? "deltaNegative" : "deltaPositive"}>{signed(typeof value === "number" ? value : null)}</strong>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "daily" ? <p className="deltaNote">前日・当日の両方でそのSNSの観測値が揃った区間だけ差分を表示します。欠測は0として扱いません。</p> : null}

      {chartData.length >= (view === "daily" ? 1 : 2)
        ? <GrowthChart data={chartData} groups={[...series]} xKey="date" connectNulls={false} />
        : <p className="lead">{view === "daily" ? "完全な連続2日分のデータが揃うと、SNSごとの前日比を表示します。" : "2日目以降、Totalと各SNSの時系列がここに表示されます。"}</p>}
    </section>
  );
}
