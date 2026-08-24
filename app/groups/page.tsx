import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { officialGroups } from "@/lib/official-directory";
import { getGroupStats } from "@/lib/analytics";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function GroupsPage() {
  const groups = officialGroups
    .map((group) => ({ group, stats: getGroupStats(group.slug) }))
    .sort((a, b) => b.stats.totalFollowers - a.stats.totalFollowers);

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div><p className="eyebrow">GROUP DIRECTORY</p><h1>Groups</h1><p className="lead">現在規模、公式SNS、所属メンバー、コンテンツ指標をグループ単位で掘り下げます。</p></div>
        <span className="badge">{groups.length} tracked groups / units</span>
      </header>

      <section className="cardGrid">
        {groups.map(({ group, stats }) => (
          <Link className="entityCard" href={`/groups/${group.slug}`} key={group.slug}>
            <div className="entityCardTop"><span className="entityType">{group.category.replaceAll("_", " ")}</span><span>{stats.observed}/{stats.expected}</span></div>
            <h2>{group.name}</h2>
            <strong className="bigMetric">{fmt(stats.totalFollowers)}</strong>
            <span className="metricLabel">observed SNS audience sum</span>
            <div className="miniStats"><span>Official <b>{fmt(stats.officialFollowers)}</b></span><span>Members <b>{fmt(stats.memberFollowers)}</b></span></div>
          </Link>
        ))}
      </section>
    </main>
  );
}
