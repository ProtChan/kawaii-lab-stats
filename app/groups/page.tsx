import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { officialGroups } from "@/lib/official-directory";
import { getGroupStats } from "@/lib/analytics";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);
const platformClass = { X: "isX", Instagram: "isInstagram", TikTok: "isTikTok", YouTube: "isYouTube" } as const;

export default function GroupsPage() {
  const groups = officialGroups
    .map((group) => ({ group, stats: getGroupStats(group.slug) }))
    .sort((a, b) => b.stats.totalFollowers - a.stats.totalFollowers);

  return (
    <main>
      <SiteNav />
      <header className="pageHero pageHeroTight">
        <div><p className="eyebrow">GROUP DIRECTORY</p><h1>Groups</h1><p className="lead">グループごとの規模・SNS構成・公式比率を一覧。カードからメンバー寄与と時系列へ掘り下げます。</p></div>
        <span className="badge">{groups.length} TRACKED GROUPS / UNITS</span>
      </header>

      <section className="cardGrid groupCardGrid">
        {groups.map(({ group, stats }, index) => (
          <Link className="entityCard groupEntityCard" href={`/groups/${group.slug}`} key={group.slug}>
            <div className="entityCardTop"><span className="entityType">{group.category.replaceAll("_", " ")}</span><span>#{String(index + 1).padStart(2, "0")} · {stats.observed}/{stats.expected}</span></div>
            <h2>{group.name}</h2>
            <strong className="bigMetric">{fmt(stats.totalFollowers)}</strong>
            <span className="metricLabel">observed SNS audience sum</span>
            <div className="miniAudienceTrack" aria-label="platform mix">
              {Object.entries(stats.platformFollowers).map(([platform, value]) => {
                const width = stats.totalFollowers > 0 ? (value / stats.totalFollowers) * 100 : 0;
                return width > 0 ? <i className={platformClass[platform as keyof typeof platformClass]} style={{ width: `${width}%` }} title={`${platform}: ${fmt(value)}`} key={platform} /> : null;
              })}
            </div>
            <div className="miniStats"><span>Official <b>{fmt(stats.officialFollowers)}</b></span><span>Members <b>{fmt(stats.memberFollowers)}</b></span></div>
            <div className="cardAction">Open analytics <b>↗</b></div>
          </Link>
        ))}
      </section>
    </main>
  );
}
