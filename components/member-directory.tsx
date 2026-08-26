"use client";

import { useMemo, useState } from "react";
import { AudienceBarList, type AudienceMix } from "@/components/audience-bar-list";
import { DeltaBarList } from "@/components/delta-bar-list";

export type MemberDirectoryRow = {
  slug: string;
  name: string;
  groupName: string;
  groupSlugs: string[];
  status: string;
  total: number | null;
  mix: AudienceMix;
  growthDay: number | null;
  observed: number;
  expected: number;
};

export function MemberDirectory({ rows, groups }: { rows: MemberDirectoryRow[]; groups: Array<{ slug: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<"scale" | "daily">("scale");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ja");
    return rows
      .filter((row) => !group || row.groupSlugs.includes(group))
      .filter((row) => !normalized || `${row.name} ${row.groupName}`.toLocaleLowerCase("ja").includes(normalized))
      .sort((a, b) => sort === "daily"
        ? (b.growthDay ?? Number.NEGATIVE_INFINITY) - (a.growthDay ?? Number.NEGATIVE_INFINITY)
        : (b.total ?? Number.NEGATIVE_INFINITY) - (a.total ?? Number.NEGATIVE_INFINITY));
  }, [rows, query, group, sort]);

  return (
    <>
      <section className="panel directoryControls">
        <label className="controlBlock"><span className="controlLabel">Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="メンバー名で検索" /></label>
        <label className="controlBlock"><span className="controlLabel">Group</span><select value={group} onChange={(event) => setGroup(event.target.value)}><option value="">All groups / units</option>{groups.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
        <div className="controlBlock"><span className="controlLabel">Sort</span><div className="segmented"><button className={sort === "scale" ? "active" : ""} onClick={() => setSort("scale")}>Total</button><button className={sort === "daily" ? "active" : ""} onClick={() => setSort("daily")}>1-day Δ</button></div></div>
        <div className="directoryCount"><span>RESULTS</span><strong>{filtered.length}</strong></div>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">{sort === "daily" ? "DAILY MOVERS" : "CURRENT SCALE"}</p><h2>{sort === "daily" ? "個人SNS 前日増加" : "個人SNS総規模"}</h2></div><span>{group ? "filtered cohort" : "all unique members"}</span></div>
        {sort === "daily" ? (
          <DeltaBarList items={filtered.map((row) => ({ href: `/members/${row.slug}`, label: row.name, sub: `${row.groupName} · coverage ${row.observed}/${row.expected}`, value: row.growthDay }))} />
        ) : (
          <AudienceBarList items={filtered.map((row) => ({ href: `/members/${row.slug}`, label: row.name, sub: `${row.groupName}${row.status === "HIATUS" ? " · HIATUS" : ""} · coverage ${row.observed}/${row.expected}`, value: row.total, mix: row.mix }))} />
        )}
      </section>
    </>
  );
}
