import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { officialGroups } from "@/lib/official-directory";
import { getGroupStats, groupGrowth } from "@/lib/analytics";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;
const platformClass = { X: "isX", Instagram: "isInstagram", TikTok: "isTikTok", YouTube: "isYouTube" } as const;

function GroupSection({ title, eyebrow, groups, note }: { title: string; eyebrow: string; groups: typeof officialGroups; note: string }) {
  const rows = groups
    .map((group) => ({ group, stats: getGroupStats(group.slug), growth: groupGrowth(group.slug) }))
    .sort((a, b) => (b.stats.totalFollowers ?? -1) - (a.stats.totalFollowers ?? -1));

  return (
    <section className="panel groupDirectorySection">
      <div className="sectionHead"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{note}</span></div>
      <div className="cardGrid groupCardGrid">
        {rows.map(({ group, stats, growth }) => {
          const knownTotal = Object.values(stats.platformFollowers).reduce((sum, value) => sum + (value ?? 0), 0);
          return (
            <Link className="entityCard groupEntityCard" href={`/groups/${group.slug}`} key={group.slug}>
              <div className="entityCardTop"><span className="entityType">{group.category.replaceAll("_", " ")}</span><span>{stats.observed}/{stats.expected}</span></div>
              <h2>{group.name}</h2>
              <strong className="bigMetric">{fmt(stats.totalFollowers)}</strong>
              <span className="metricLabel">{group.category === "SPECIAL_UNIT" ? "official unit + canonical non-duplicated accounts" : "observed SNS audience sum"}</span>
              <div className="miniAudienceTrack" aria-label="platform mix">
                {Object.entries(stats.platformFollowers).map(([platform, value]) => {
                  const width = value != null && knownTotal > 0 ? (value / knownTotal) * 100 : 0;
                  return width > 0 ? <i className={platformClass[platform as keyof typeof platformClass]} style={{ width: `${width}%` }} title={`${platform}: ${fmt(value)}`} key={platform} /> : null;
                })}
              </div>
              <div className="miniStats"><span>1D <b>{signed(growth.day)}</b></span><span>Members <b>{group.members.length}</b></span></div>
              <div className="cardAction">Open analytics <b>↗</b></div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function GroupsPage() {
  const primary = officialGroups.filter((group) => group.category === "DEBUTED");
  const special = officialGroups.filter((group) => group.category === "SPECIAL_UNIT");
  const trainee = officialGroups.filter((group) => group.category === "TRAINEE");

  return (
    <main>
      <SiteNav />
      <header className="pageHero pageHeroTight">
        <div><p className="eyebrow">GROUP DIRECTORY</p><h1>Groups</h1><p className="lead">比較可能なprimary groupsと、兼任unit・traineeを分離。カテゴリごとの意味を保ったまま詳細へ掘り下げます。</p></div>
        <span className="badge">{officialGroups.length} GROUPS / UNITS</span>
      </header>

      <GroupSection eyebrow="PRIMARY" title="Debuted groups" groups={primary} note="ecosystem scale is directly comparable" />
      {special.length ? <GroupSection eyebrow="SPECIAL UNITS" title="Concurrent units" groups={special} note="relation members are not double-counted" /> : null}
      {trainee.length ? <GroupSection eyebrow="TRAINEE" title="KAWAII LAB. trainee units" groups={trainee} note="shown separately from debuted-group rankings" /> : null}
    </main>
  );
}
