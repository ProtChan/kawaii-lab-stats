"use client";

import { useMemo, useState } from "react";
import { GrowthChart } from "@/components/growth-chart";
import type { MemberTimelinePoint } from "@/lib/analytics";
import { exactDayInterval } from "@/lib/metrics";
import styles from "@/components/member-history-explorer.module.css";

const series = ["Total", "X", "Instagram", "TikTok", "YouTube"] as const;
type SeriesKey = (typeof series)[number];
type ViewMode = "level" | "daily";
type ChartRow = Record<string, string | number | null>;

const signed = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(value)}`;

function levelRows(data: MemberTimelinePoint[]): ChartRow[] {
  return data.map((point) => {
    const row: ChartRow = { date: point.date };
    for (const key of series) row[key] = point[key];
    return row;
  });
}

function deltaRows(data: MemberTimelinePoint[]): ChartRow[] {
  return data.slice(1).map((point, index) => {
    const previous = data[index];
    const row: ChartRow = { date: point.date };
    const consecutiveDay = exactDayInterval(previous.isoDate, point.isoDate, 1);
    for (const key of series) {
      const before = previous[key];
      const after = point[key];
      const sameAccounts = previous.accountSet[key as SeriesKey] === point.accountSet[key as SeriesKey];
      row[key] = consecutiveDay && sameAccounts && typeof before === "number" && typeof after === "number" ? after - before : null;
    }
    return row;
  });
}

export function MemberHistoryExplorer({ data }: { data: MemberTimelinePoint[] }) {
  const [view, setView] = useState<ViewMode>("level");
  const levels = useMemo(() => levelRows(data), [data]);
  const daily = useMemo(() => deltaRows(data), [data]);
  const chartData = view === "daily" ? daily : levels;
  const latestDaily = [...daily].reverse().find((row) => series.some((key) => typeof row[key] === "number")) ?? null;

  return (
    <section className="panel">
      <div className={`sectionHead ${styles.head}`}>
        <div>
          <p className="eyebrow">{view === "daily" ? "DAILY AUDIENCE CHANGE" : "AUDIENCE HISTORY"}</p>
          <h2>{view === "daily" ? "SNS別フォロワー前日比" : "SNS別フォロワー推移"}</h2>
        </div>
        <div className={styles.actions}>
          <div className="segmented" aria-label="個人履歴の表示モード">
            <button type="button" className={view === "level" ? "active" : ""} onClick={() => setView("level")}>Total</button>
            <button type="button" className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>1-day Δ</button>
          </div>
          <span>{view === "daily" ? `${daily.filter((row) => series.some((key) => typeof row[key] === "number")).length} valid daily intervals` : `${data.length} snapshots`}</span>
        </div>
      </div>

      {view === "daily" && latestDaily ? (
        <div className={styles.strip}>
          {series.map((key) => {
            const value = latestDaily[key];
            const numeric = typeof value === "number" ? value : null;
            return (
              <div key={key}>
                <span>{key}</span>
                <strong className={numeric != null && numeric < 0 ? styles.negative : styles.positive}>{signed(numeric)}</strong>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "daily" ? <p className={styles.note}>日付がちょうど1日違い、両日が完全観測、かつそのSNSのcanonical account集合が同じ区間だけ差分を表示します。欠測日をまたぐ48時間差などは1Dとして扱いません。</p> : null}

      {chartData.some((row) => series.some((key) => typeof row[key] === "number")) && chartData.length >= (view === "daily" ? 1 : 2)
        ? <GrowthChart data={chartData} groups={[...series]} xKey="date" connectNulls={false} zeroLine={view === "daily"} />
        : <p className="lead">{view === "daily" ? "比較可能な連続2日分のデータが揃うと、SNSごとの前日比を表示します。" : "2日目以降、Totalと各SNSの時系列がここに表示されます。"}</p>}
    </section>
  );
}
