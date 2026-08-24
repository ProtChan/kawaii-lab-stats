"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GrowthChart } from "@/components/growth-chart";
import type { CompareEntity, CompareMetricKey } from "@/lib/compare-data";

const metricLabels: Record<CompareMetricKey, string> = {
  audience: "SNS total audience",
  tiktokLikes: "TikTok total likes",
  youtubeViews: "YouTube total views",
};

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);

function validMetric(value: string | null): CompareMetricKey {
  return value === "tiktokLikes" || value === "youtubeViews" ? value : "audience";
}

export function CompareExplorer({ groups, members }: { groups: CompareEntity[]; members: CompareEntity[] }) {
  const [scope, setScope] = useState<"groups" | "members">("groups");
  const [metric, setMetric] = useState<CompareMetricKey>("audience");
  const [groupSlug, setGroupSlug] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextScope = params.get("scope") === "members" ? "members" : "groups";
    const nextMetric = validMetric(params.get("metric"));
    const nextGroup = params.get("group") ?? "";
    const requested = (params.get("selected") ?? "").split(",").filter(Boolean);
    setScope(nextScope);
    setMetric(nextMetric);
    setGroupSlug(nextGroup);
    setSelected(requested);
    setHydrated(true);
  }, []);

  const candidates = useMemo(() => {
    if (scope === "groups") return groups;
    return groupSlug ? members.filter((member) => member.groupSlugs.includes(groupSlug)) : members;
  }, [scope, groupSlug, groups, members]);

  const orderedCandidates = useMemo(
    () => [...candidates].sort((a, b) => (b.current[metric] ?? -1) - (a.current[metric] ?? -1)),
    [candidates, metric],
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
    return dates.map((date) => {
      const row: Record<string, string | number | null> = { date: date.slice(5) };
      for (const entity of selectedEntities) {
        row[entity.name] = entity.history.find((point) => point.date === date)?.[metric] ?? null;
      }
      return row;
    });
  }, [selectedEntities, metric]);

  function writeUrl(next: { scope?: "groups" | "members"; metric?: CompareMetricKey; groupSlug?: string; selected?: string[] }) {
    const nextScope = next.scope ?? scope;
    const nextMetric = next.metric ?? metric;
    const nextGroup = next.groupSlug ?? groupSlug;
    const nextSelected = next.selected ?? effectiveSelected;
    const params = new URLSearchParams();
    params.set("scope", nextScope);
    params.set("metric", nextMetric);
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

  const max = Math.max(0, ...orderedCandidates.map((entity) => entity.current[metric] ?? 0));

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
        {scope === "members" ? <label className="controlBlock"><span className="controlLabel">Group filter</span><select value={groupSlug} onChange={(event) => changeGroup(event.target.value)}><option value="">All members</option>{groups.map((group) => <option value={group.slug} key={group.slug}>{group.name}</option>)}</select></label> : null}
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">CURRENT RANKING</p><h2>{metricLabels[metric]}</h2></div><span>{orderedCandidates.length} candidates</span></div>
        <div className="compareBarList">
          {orderedCandidates.map((entity, index) => {
            const value = entity.current[metric];
            const ratio = value != null && max > 0 ? Math.max(2, (value / max) * 100) : 0;
            const isSelected = effectiveSelected.includes(entity.slug);
            return (
              <div className={`compareBarRow ${isSelected ? "selected" : ""}`} key={entity.slug}>
                <button className="comparePick" onClick={() => toggleEntity(entity.slug)} aria-label={`${entity.name}を比較${isSelected ? "から外す" : "に追加"}`}><span>{isSelected ? "●" : "○"}</span></button>
                <div className="compareBarMain">
                  <div className="barRankTop"><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{entity.name}</strong><small>{entity.primaryGroupName ?? (entity.type === "GROUP" ? "GROUP / UNIT" : "MEMBER")}</small></div><em>{fmt(value)}</em></div>
                  <div className="barTrack"><i style={{ width: `${ratio}%` }} /></div>
                </div>
                <Link className="detailArrow" href={entity.type === "GROUP" ? `/groups/${entity.slug}` : `/members/${entity.slug}`}>↗</Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">HISTORY COMPARE</p><h2>{metricLabels[metric]} 推移</h2></div><span>{selectedEntities.length} selected</span></div>
        <div className="selectionLegend">{selectedEntities.map((entity) => <button key={entity.slug} onClick={() => toggleEntity(entity.slug)}>{entity.name} ×</button>)}</div>
        {chartData.length >= 2 ? <GrowthChart data={chartData} groups={selectedEntities.map((entity) => entity.name)} xKey="date" connectNulls={false} /> : <p className="lead">この指標は履歴が2点以上になると比較推移を表示します。現在値ランキングは上で利用できます。</p>}
      </section>
    </>
  );
}
