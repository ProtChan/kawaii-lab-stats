"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GrowthChart } from "@/components/growth-chart";
import type { CompareEntity, CompareMetricKey, ComparePoint } from "@/lib/compare-data";

const metricLabels: Record<CompareMetricKey, string> = {
  audience: "SNS total audience",
  tiktokLikes: "TikTok total likes",
  youtubeViews: "YouTube total views",
};

const platformKeys = ["X", "Instagram", "TikTok", "YouTube"] as const;
type ViewMode = "level" | "daily";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const fmtSigned = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(value)}`;

function validMetric(value: string | null): CompareMetricKey {
  return value === "tiktokLikes" || value === "youtubeViews" ? value : "audience";
}

function validView(value: string | null): ViewMode {
  return value === "daily" ? "daily" : "level";
}

function dailyDelta(history: ComparePoint[], index: number, metric: CompareMetricKey) {
  if (index <= 0) return null;
  const previous = history[index - 1];
  const current = history[index];
  if (!previous?.complete[metric] || !current?.complete[metric]) return null;
  if (previous.accountSet[metric] !== current.accountSet[metric]) return null;
  const before = previous[metric];
  const after = current[metric];
  return typeof before === "number" && typeof after === "number" ? after - before : null;
}

function latestDailyDelta(entity: CompareEntity, metric: CompareMetricKey) {
  return dailyDelta(entity.history, entity.history.length - 1, metric);
}

export function CompareExplorer({ groups, members }: { groups: CompareEntity[]; members: CompareEntity[] }) {
  const [scope, setScope] = useState<"groups" | "members">("groups");
  const [metric, setMetric] = useState<CompareMetricKey>("audience");
  const [view, setView] = useState<ViewMode>("level");
  const [groupSlug, setGroupSlug] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextScope = params.get("scope") === "members" ? "members" : "groups";
    const nextMetric = validMetric(params.get("metric"));
    const nextView = validView(params.get("view"));
    const nextGroup = params.get("group") ?? "";
    const requested = (params.get("selected") ?? "").split(",").filter(Boolean);
    setScope(nextScope);
    setMetric(nextMetric);
    setView(nextView);
    setGroupSlug(nextGroup);
    setSelected(requested);
    setHydrated(true);
  }, []);

  const candidates = useMemo(() => {
    if (scope === "groups") return groups;
    return groupSlug ? members.filter((member) => member.groupSlugs.includes(groupSlug)) : members;
  }, [scope, groupSlug, groups, members]);

  const valueFor = (entity: CompareEntity) => view === "daily" ? latestDailyDelta(entity, metric) : entity.current[metric];

  const orderedCandidates = useMemo(
    () => [...candidates].sort((a, b) => (valueFor(b) ?? Number.NEGATIVE_INFINITY) - (valueFor(a) ?? Number.NEGATIVE_INFINITY)),
    [candidates, metric, view],
  );

  const effectiveSelected = useMemo(() => {
    const valid = selected.filter((slug) => candidates.some((candidate) => candidate.slug === slug));
    if (valid.length) return valid.slice(0, 8);
    return orderedCandidates.slice(0, scope === "members" && groupSlug ? 8 : 5).map((entity) => entity.slug);
  }, [selected, candidates, orderedCandidates, scope, groupSlug]);

  const selectedEntities = effectiveSelected
    .map((slug) => candidates.find((entity) => entity.slug === slug))
    .filter((entity): entity is CompareEntity => Boolean(entity));

  const chartData = useMemo(() => {
    const dates = [...new Set(selectedEntities.flatMap((entity) => entity.history.map((point) => point.date)))].sort();
    const rows = dates.map((date) => {
      const row: Record<string, string | number | null> = { date: date.slice(5) };
      for (const entity of selectedEntities) {
        const index = entity.history.findIndex((point) => point.date === date);
        row[entity.name] = view === "daily"
          ? dailyDelta(entity.history, index, metric)
          : entity.history[index]?.[metric] ?? null;
      }
      return row;
    });
    return view === "daily"
      ? rows.filter((row) => selectedEntities.some((entity) => typeof row[entity.name] === "number"))
      : rows;
  }, [selectedEntities, metric, view]);

  function writeUrl(next: { scope?: "groups" | "members"; metric?: CompareMetricKey; view?: ViewMode; groupSlug?: string; selected?: string[] }) {
    const nextScope = next.scope ?? scope;
    const nextMetric = next.metric ?? metric;
    const nextView = next.view ?? view;
    const nextGroup = next.groupSlug ?? groupSlug;
    const nextSelected = next.selected ?? effectiveSelected;
    const params = new URLSearchParams();
    params.set("scope", nextScope);
    params.set("metric", nextMetric);
    if (nextView === "daily") params.set("view", "daily");
    if (nextScope === "members" && nextGroup) params.set("group", nextGroup);
    if (nextSelected.length) params.set("selected", nextSelected.join(","));
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }

  function changeScope(nextScope: "groups" | "members") {
    setScope(nextScope);
    setSelected([]);
    const nextGroup = nextScope === "members" ? groupSlug : "";
    if (nextScope === "groups") setGroupSlug("");
    writeUrl({ scope: nextScope, groupSlug: nextGroup, selected: [] });
  }

  function changeMetric(nextMetric: CompareMetricKey) {
    setMetric(nextMetric);
    setSelected([]);
    writeUrl({ metric: nextMetric, selected: [] });
  }

  function changeView(nextView: ViewMode) {
    setView(nextView);
    setSelected([]);
    writeUrl({ view: nextView, selected: [] });
  }

  function changeGroup(nextGroup: string) {
    setGroupSlug(nextGroup);
    setSelected([]);
    writeUrl({ groupSlug: nextGroup, selected: [] });
  }

  function toggleEntity(slug: string) {
    const current = effectiveSelected;
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(-8);
    setSelected(next);
    writeUrl({ selected: next });
  }

  if (!hydrated) return <section className="panel"><p className="lead">比較条件を読み込んでいます。</p></section>;

  const currentValues = orderedCandidates.map(valueFor).filter((value): value is number => typeof value === "number");
  const max = Math.max(0, ...currentValues);
  const maxAbs = Math.max(0, ...currentValues.map((value) => Math.abs(value)));
  const latestDate = selectedEntities.flatMap((entity) => entity.history.map((point) => point.date)).sort().at(-1)?.slice(5) ?? "—";

  return (
    <>
      <section className="panel compareControls">
        <div className="controlBlock">
          <span className="controlLabel">Scope</span>
          <div className="segmented"><button className={scope === "groups" ? "active" : ""} onClick={() => changeScope("groups")}>Groups</button><button className={scope === "members" ? "active" : ""} onClick={() => changeScope("members")}>Members</button></div>
        </div>
        <div className="controlBlock">
          <span className="controlLabel">Metric</span>
          <div className="segmented metricSegments"><button className={metric === "audience" ? "active" : ""} onClick={() => changeMetric("audience")}>Audience</button><button className={metric === "tiktokLikes" ? "active" : ""} onClick={() => changeMetric("tiktokLikes")}>TikTok likes</button><button className={metric === "youtubeViews" ? "active" : ""} onClick={() => changeMetric("youtubeViews")}>YouTube views</button></div>
        </div>
        <div className="controlBlock">
          <span className="controlLabel">View</span>
          <div className="segmented"><button className={view === "level" ? "active" : ""} onClick={() => changeView("level")}>Total</button><button className={view === "daily" ? "active" : ""} onClick={() => changeView("daily")}>1-day Δ</button></div>
        </div>
        {scope === "members" ? <label className="controlBlock"><span className="controlLabel">Group filter</span><select value={groupSlug} onChange={(event) => changeGroup(event.target.value)}><option value="">All members</option>{groups.map((group) => <option value={group.slug} key={group.slug}>{group.name}</option>)}</select></label> : null}
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">{view === "daily" ? "DAILY CHANGE" : "CURRENT RANKING"}</p><h2>{metricLabels[metric]}{view === "daily" ? " 1日増減" : ""}</h2></div><span>{view === "daily" ? `${latestDate} 前日比` : `${orderedCandidates.length} candidates`}</span></div>
        {metric === "audience" && view === "level" ? <div className="platformLegend">{platformKeys.map((platform) => <span key={platform}><i className={`platformDot platform${platform}`} />{platform}</span>)}</div> : null}
        {view === "daily" ? <p className="deltaNote">前日・当日とも完全観測で、かつcanonical account集合が同じ区間だけ算出します。欠測やアカウント構成変更を成長として扱いません。</p> : null}
        <div className="compareBarList">
          {orderedCandidates.map((entity, index) => {
            const value = valueFor(entity);
            const ratio = value != null && max > 0 ? Math.max(2, (value / max) * 100) : 0;
            const deltaWidth = value != null && maxAbs > 0 ? (Math.abs(value) / maxAbs) * 50 : 0;
            const deltaLeft = value != null && value < 0 ? 50 - deltaWidth : 50;
            const isSelected = effectiveSelected.includes(entity.slug);
            return (
              <div className={`compareBarRow ${isSelected ? "selected" : ""}`} key={entity.slug}>
                <button className="comparePick" onClick={() => toggleEntity(entity.slug)} aria-label={`${entity.name}を比較${isSelected ? "から外す" : "に追加"}`}><span>{isSelected ? "●" : "○"}</span></button>
                <div className="compareBarMain">
                  <div className="barRankTop"><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{entity.name}</strong><small>{entity.primaryGroupName ?? (entity.type === "GROUP" ? "GROUP / UNIT" : "MEMBER")}</small></div><em className={view === "daily" ? value != null && value < 0 ? "deltaNegative" : "deltaPositive" : ""}>{view === "daily" ? fmtSigned(value) : fmt(value)}</em></div>
                  {metric === "audience" && view === "level" ? (
                    <div className="barTrack stackedAudience" aria-label={`${entity.name} SNS platform mix`}>
                      {platformKeys.map((platform) => {
                        const platformValue = entity.platforms[platform] ?? 0;
                        const width = max > 0 ? (platformValue / max) * 100 : 0;
                        return width > 0 ? <i key={platform} className={`platformSegment platform${platform}`} style={{ width: `${width}%` }} title={`${platform}: ${fmt(platformValue)}`} /> : null;
                      })}
                    </div>
                  ) : view === "daily" ? (
                    <div className="deltaTrack" aria-label={`${entity.name} 前日比 ${fmtSigned(value)}`}>
                      {value != null ? <i className={value < 0 ? "negative" : "positive"} style={{ width: `${deltaWidth}%`, left: `${deltaLeft}%` }} /> : null}
                    </div>
                  ) : <div className="barTrack"><i style={{ width: `${ratio}%` }} /></div>}
                </div>
                <Link className="detailArrow" href={entity.type === "GROUP" ? `/groups/${entity.slug}` : `/members/${entity.slug}`}>↗</Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">{view === "daily" ? "DAILY DELTA HISTORY" : "HISTORY COMPARE"}</p><h2>{metricLabels[metric]} {view === "daily" ? "1日増減推移" : "推移"}</h2></div><span>{selectedEntities.length} selected</span></div>
        <div className="selectionLegend">{selectedEntities.map((entity) => <button key={entity.slug} onClick={() => toggleEntity(entity.slug)}>{entity.name} ×</button>)}</div>
        {chartData.length >= (view === "daily" ? 1 : 2) ? <GrowthChart data={chartData} groups={selectedEntities.map((entity) => entity.name)} xKey="date" connectNulls={false} /> : <p className="lead">{view === "daily" ? "比較可能な連続2日分のデータが揃うと、ここに1日増減を表示します。" : "この指標は履歴が2点以上になると比較推移を表示します。現在値ランキングは上で利用できます。"}</p>}
      </section>
    </>
  );
}
