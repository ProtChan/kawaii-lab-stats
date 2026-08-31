"use client";

import { useMemo, useState } from "react";
import { GrowthChart } from "@/components/growth-chart";
import type { MemberTimelinePoint } from "@/lib/analytics";
import { exactDayInterval } from "@/lib/metrics";
import styles from "@/components/member-history-explorer.module.css";

const series = ["Total", "X", "Instagram", "TikTok", "YouTube"] as const;
type SeriesKey = (typeof series)[number];
type ViewMode = "level" | "indexed" | "change" | "rate";
type PeriodDays = 1 | 7 | 30;
type ChartRow = Record<string, string | number | null>;

const numberFormat = new Intl.NumberFormat("ja-JP");
const signed = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${numberFormat.format(value)}`;
const signedPercent = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}%`;
const indexFormat = (value: number | null) => value == null ? "—" : value.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function levelRows(data: MemberTimelinePoint[]): ChartRow[] {
  return data.map((point) => {
    const row: ChartRow = { date: point.date };
    for (const key of series) row[key] = point[key];
    return row;
  });
}

function indexedRows(data: MemberTimelinePoint[]): ChartRow[] {
  return data.map((point, pointIndex) => {
    const row: ChartRow = { date: point.date };
    for (const key of series) {
      const current = point[key];
      if (typeof current !== "number") {
        row[key] = null;
        continue;
      }
      const accountSet = point.accountSet[key as SeriesKey];
      const baseline = data
        .slice(0, pointIndex + 1)
        .find((candidate) => candidate.accountSet[key as SeriesKey] === accountSet && typeof candidate[key] === "number" && candidate[key] !== 0);
      const baseValue = baseline?.[key];
      row[key] = typeof baseValue === "number" && baseValue !== 0 ? (current / baseValue) * 100 : null;
    }
    return row;
  });
}

function periodRows(data: MemberTimelinePoint[], days: PeriodDays, mode: "change" | "rate"): ChartRow[] {
  return data.map((point, pointIndex) => {
    const row: ChartRow = { date: point.date };
    const earlierPoints = data.slice(0, pointIndex).reverse();
    const previous = earlierPoints.find((candidate) => exactDayInterval(candidate.isoDate, point.isoDate, days));

    for (const key of series) {
      if (!previous) {
        row[key] = null;
        continue;
      }
      const before = previous[key];
      const after = point[key];
      const sameAccounts = previous.accountSet[key as SeriesKey] === point.accountSet[key as SeriesKey];
      if (!sameAccounts || typeof before !== "number" || typeof after !== "number") {
        row[key] = null;
        continue;
      }
      const delta = after - before;
      row[key] = mode === "change" ? delta : before !== 0 ? (delta / before) * 100 : null;
    }
    return row;
  });
}

function hasAnyValue(row: ChartRow) {
  return series.some((key) => typeof row[key] === "number");
}

export function MemberHistoryExplorer({ data }: { data: MemberTimelinePoint[] }) {
  const [view, setView] = useState<ViewMode>("level");
  const [period, setPeriod] = useState<PeriodDays>(1);

  const levels = useMemo(() => levelRows(data), [data]);
  const indexed = useMemo(() => indexedRows(data), [data]);
  const changes = useMemo(() => periodRows(data, period, "change"), [data, period]);
  const rates = useMemo(() => periodRows(data, period, "rate"), [data, period]);

  const chartData = view === "indexed" ? indexed : view === "change" ? changes : view === "rate" ? rates : levels;
  const latestDerived = view === "level" ? null : [...chartData].reverse().find(hasAnyValue) ?? null;
  const validRows = chartData.filter(hasAnyValue).length;
  const derived = view === "change" || view === "rate";

  const heading = view === "indexed"
    ? { eyebrow: "AUDIENCE INDEX", title: "SNS別 INDEX（基準=100）" }
    : view === "change"
      ? { eyebrow: `${period}-DAY AUDIENCE CHANGE`, title: `SNS別 ${period}日増分` }
      : view === "rate"
        ? { eyebrow: `${period}-DAY AUDIENCE GROWTH RATE`, title: `SNS別 ${period}日増加率` }
        : { eyebrow: "AUDIENCE HISTORY", title: "SNS別フォロワー推移" };

  const displayValue = (value: number | null) => {
    if (view === "rate") return signedPercent(value);
    if (view === "indexed") return indexFormat(value);
    return signed(value);
  };

  const emptyText = view === "indexed"
    ? "2日目以降、各SNSをそれぞれ100基準にしたINDEX推移を表示します。"
    : view === "change"
      ? `比較可能な${period}日差の観測が揃うと、SNSごとの期間増分を表示します。`
      : view === "rate"
        ? `比較可能な${period}日差の観測が揃うと、SNSごとの期間増加率を表示します。`
        : "2日目以降、Totalと各SNSの時系列がここに表示されます。";

  return (
    <section className="panel">
      <div className={`sectionHead ${styles.head}`}>
        <div>
          <p className="eyebrow">{heading.eyebrow}</p>
          <h2>{heading.title}</h2>
        </div>
        <div className={styles.actions}>
          <div className="segmented" aria-label="履歴の表示モード">
            <button type="button" className={view === "level" ? "active" : ""} onClick={() => setView("level")}>実数</button>
            <button type="button" className={view === "indexed" ? "active" : ""} onClick={() => setView("indexed")}>INDEX</button>
            <button type="button" className={view === "change" ? "active" : ""} onClick={() => setView("change")}>増分</button>
            <button type="button" className={view === "rate" ? "active" : ""} onClick={() => setView("rate")}>増加率</button>
          </div>
          {derived ? (
            <div className={`segmented ${styles.periods}`} aria-label="比較期間">
              {([1, 7, 30] as const).map((days) => (
                <button type="button" key={days} className={period === days ? "active" : ""} onClick={() => setPeriod(days)}>{days}D</button>
              ))}
            </div>
          ) : null}
          <span>{view === "level" ? `${data.length} snapshots` : `${validRows} valid points`}</span>
        </div>
      </div>

      {latestDerived ? (
        <div className={styles.strip}>
          {series.map((key) => {
            const value = latestDerived[key];
            const numeric = typeof value === "number" ? value : null;
            const negative = numeric != null && numeric < 0;
            return (
              <div key={key}>
                <span>{key}</span>
                <strong className={view === "indexed" ? "" : negative ? styles.negative : styles.positive}>{displayValue(numeric)}</strong>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "indexed" ? (
        <p className={styles.note}>Total / X / Instagram / TikTok / YouTubeをそれぞれ独立してINDEX化します。同じcanonical account集合で最初に取得できた値を100とし、アカウント集合が変わった場合はその新しい区間で基準を取り直します。</p>
      ) : null}

      {derived ? (
        <p className={styles.note}>{period}日前の実日付と一致し、両端が観測済みで、そのSNSのcanonical account集合が同じ場合だけ{view === "rate" ? "増加率" : "増分"}を表示します。欠測やアカウント変更をまたぐ区間は `—` のままです。</p>
      ) : null}

      {chartData.some(hasAnyValue) && chartData.length >= (view === "level" || view === "indexed" ? 2 : 1)
        ? <GrowthChart
            data={chartData}
            groups={[...series]}
            xKey="date"
            connectNulls={false}
            zeroLine={view === "change" || view === "rate"}
            valueFormat={view === "rate" ? "percent" : view === "indexed" ? "index" : "number"}
          />
        : <p className="lead">{emptyText}</p>}
    </section>
  );
}
