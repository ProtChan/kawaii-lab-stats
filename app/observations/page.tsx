import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { historySnapshots } from "@/lib/analytics";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Observations",
  description: "KAWAII LAB. Statsの日別SNS snapshot取得時刻・実観測・補完件数・欠測を監査するページ。",
};

const DAY_MS = 86_400_000;

function dateKeyTime(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

function enumerateDates(first: string, last: string) {
  const start = dateKeyTime(first);
  const end = dateKeyTime(last);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const dates: string[] = [];
  for (let time = start; time <= end; time += DAY_MS) dates.push(new Date(time).toISOString().slice(0, 10));
  return dates;
}

function jstClockParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  if (![hour, minute, second].every(Number.isFinite)) return null;
  return { hour, minute, second };
}

function jstTime(value: string | null) {
  if (!value) return "—";
  const parts = jstClockParts(value);
  return parts ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}` : "—";
}

function midnightOffsetMinutes(value: string | null) {
  if (!value) return null;
  const parts = jstClockParts(value);
  return parts ? parts.hour * 60 + parts.minute + parts.second / 60 : null;
}

function offsetLabel(minutes: number | null) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (!hours) return `+${mins}m`;
  return `+${hours}h ${String(mins).padStart(2, "0")}m`;
}

function intervalLabel(previous: string | null, current: string | null) {
  if (!previous || !current) return "—";
  const diff = Date.parse(current) - Date.parse(previous);
  if (!Number.isFinite(diff) || diff < 0) return "—";
  const totalMinutes = Math.round(diff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function ObservationsPage() {
  const snapshots = [...historySnapshots].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const firstDate = snapshots[0]?.date ?? null;
  const lastDate = snapshots.at(-1)?.date ?? null;
  const dateRange = firstDate && lastDate ? enumerateDates(firstDate, lastDate) : [];
  const byDate = new Map(snapshots.map((snapshot) => [snapshot.date, snapshot]));

  let previousCapturedAt: string | null = null;
  const rows = dateRange.map((date) => {
    const snapshot = byDate.get(date) ?? null;
    const collectedAt = snapshot?.collectedAt ?? null;
    const offset = midnightOffsetMinutes(collectedAt);
    const attempted = snapshot?.attempted ?? snapshot?.accounts.length ?? 0;
    const failed = snapshot?.failed ?? snapshot?.accounts.filter((account) => account.error).length ?? 0;
    const imputed = snapshot?.imputed ?? snapshot?.accounts.filter((account) => !account.error && account.imputed).length ?? 0;
    const observed = snapshot?.observedSuccessful ?? snapshot?.accounts.filter((account) => !account.error && !account.imputed).length ?? 0;
    const usable = Math.max(0, attempted - failed);
    const interval = snapshot ? intervalLabel(previousCapturedAt, collectedAt) : "—";
    if (snapshot?.collectedAt) previousCapturedAt = snapshot.collectedAt;
    return { date, snapshot, collectedAt, offset, attempted, observed, imputed, usable, failed, interval };
  });

  const missing = rows.filter((row) => !row.snapshot).length;
  const latest = rows.filter((row) => row.snapshot).at(-1) ?? null;
  const coverage = latest?.attempted ? (latest.observed / latest.attempted) * 100 : null;

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div>
          <p className="eyebrow">DATA · OBSERVATIONS</p>
          <h1>Daily capture log</h1>
          <p className="lead">各JST日付のsnapshot取得時刻と品質を監査します。実測できなかった値は直近の正常観測から補完されても、実観測とは分離して表示し、増分・増加率には使用しません。</p>
        </div>
        <span className="badge">AUDITABLE · JST</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article><span>Captured snapshots</span><strong>{snapshots.length}</strong><small>retained observations</small></article>
        <article><span>Calendar span</span><strong>{rows.length}</strong><small>{firstDate ?? "—"} → {lastDate ?? "—"}</small></article>
        <article><span>Missing dates</span><strong>{missing}</strong><small>no snapshot retained</small></article>
        <article><span>Latest observed</span><strong>{coverage == null ? "—" : `${coverage.toFixed(1)}%`}</strong><small>{latest ? `${latest.observed} observed · ${latest.imputed} imputed` : "no snapshot"}</small></article>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div><p className="eyebrow">CAPTURE CLOCK</p><h2>日別取得時刻</h2></div>
          <span className={styles.timeZone}>Asia/Tokyo · JST</span>
        </div>
        <div className={styles.axis} aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        <div className={styles.clockList}>
          {[...rows].reverse().map((row) => {
            const position = row.offset == null ? null : Math.min(100, Math.max(0, (row.offset / 1440) * 100));
            return (
              <article className={`${styles.clockRow} ${!row.snapshot ? styles.missing : ""}`} key={row.date}>
                <div className={styles.clockMeta}>
                  <strong>{row.date}</strong>
                  <span>{row.snapshot ? `${jstTime(row.collectedAt)} JST` : "MISSING"}</span>
                </div>
                <div className={styles.clockTrack} aria-label={row.snapshot ? `${row.date} ${jstTime(row.collectedAt)} JST` : `${row.date} missing`}>
                  {position != null ? <i style={{ "--position": `${position}%` } as CSSProperties} /> : null}
                </div>
                <b>{row.snapshot ? offsetLabel(row.offset) : "—"}</b>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">AUDIT TABLE</p><h2>取得履歴</h2></div><span className={styles.timeZone}>newest first</span></div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Date</th><th>Captured JST</th><th>From midnight</th><th>Since previous capture</th><th>Profiles</th><th>Status</th><th>Raw</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((row) => {
                const status = !row.snapshot ? "MISSING" : row.failed ? "PARTIAL" : row.imputed ? "IMPUTED" : "OBSERVED";
                return (
                  <tr key={row.date} className={!row.snapshot ? styles.missingTableRow : undefined}>
                    <td><strong>{row.date}</strong></td>
                    <td>{row.snapshot ? jstTime(row.collectedAt) : "—"}</td>
                    <td>{row.snapshot ? offsetLabel(row.offset) : "—"}</td>
                    <td>{row.interval}</td>
                    <td>{row.snapshot ? `${row.observed} observed` : "—"}{row.imputed ? <small> · {row.imputed} imputed</small> : null}{row.failed ? <small className={styles.failed}> · {row.failed} failed</small> : null}</td>
                    <td><span className={`${styles.status} ${row.snapshot ? styles.captured : styles.missingStatus}`}>{status}</span></td>
                    <td>{row.snapshot ? <Link href={`/data/history/${row.date}.json`}>JSON ↗</Link> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="notice">補完値は <code>imputed=true</code> / <code>imputedFromDate</code> 付きでraw JSONに残ります。表示用の合計には利用できますが、INDEX・1D/7D/30D増分・増加率では実観測として扱いません。後続Actionは補完行を再び取得対象にし、実測できれば自動置換します。</section>
      <footer>Observation timestamps, observed coverage, imputed values and missing dates remain auditable.</footer>
    </main>
  );
}
