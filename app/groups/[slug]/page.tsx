import Link from "next/link";
import { notFound } from "next/navigation";
import { GrowthChart } from "@/components/growth-chart";
import { MetricBarList } from "@/components/metric-bar-list";
import { SiteNav } from "@/components/site-nav";
import { officialGroups } from "@/lib/official-directory";
import { getGroup, getGroupStats, getGroupTimeline, groupMembers } from "@/lib/analytics";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);

export function generateStaticParams() {
  return officialGroups.map((group) => ({ slug: group.slug }));
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getGroup(slug);
  if (!group) notFound();

  const stats = getGroupStats(group.slug);
  const timeline = getGroupTimeline(group.slug);
  const members = groupMembers(group).sort((a, b) => b.stats.totalFollowers - a.stats.totalFollowers);

  return (
    <main>
      <SiteNav />
      <header className="pageHero compactHero">
        <div>
          <p className="eyebrow">{group.category.replaceAll("_", " ")}</p>
          <h1>{group.name}</h1>
          <p className="lead">Scale / Growth / Activity を分けて観測。コンテンツ指標は比較画面へそのまま掘り下げられます。</p>
        </div>
        <span className="badge">coverage {stats.observed}/{stats.expected}</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article><span>Group scale</span><strong>{fmt(stats.totalFollowers)}</strong><small>official + canonical members</small></article>
        <article><span>Official accounts</span><strong>{fmt(stats.officialFollowers)}</strong><small>{group.accounts.length} official SNS</small></article>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`}><span>TikTok total likes</span><strong>{fmt(stats.tiktokLikes)}</strong><small>open member comparison →</small></Link>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=youtubeViews&group=${group.slug}`}><span>YouTube total views</span><strong>{fmt(stats.youtubeViews)}</strong><small>open member comparison →</small></Link>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">SCALE HISTORY</p><h2>SNS合計推移</h2></div><span>{timeline.length} snapshots</span></div>
        {timeline.length >= 2 ? <GrowthChart data={timeline} groups={["Total"]} xKey="date" /> : <p className="lead">2日目の観測から時系列グラフが伸びます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>媒体別規模</h2></div></div>
          <div className="metricList">
            {Object.entries(stats.platformFollowers).map(([platform, value]) => <div key={platform}><span>{platform}</span><strong>{fmt(value)}</strong></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">OFFICIAL SNS</p><h2>グループ公式</h2></div></div>
          <div className="accountStack">
            {group.accounts.map((account) => <a href={account.url} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}><span>{account.platform}</span><strong>@{account.handle.replace(/^@/, "")}</strong></a>)}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">MEMBER CONTRIBUTION</p><h2>メンバーSNS規模</h2></div><span>visual scale comparison</span></div>
        <MetricBarList items={members.map(({ member, stats: memberStats, growth }) => ({
          href: `/members/${member.slug}`,
          label: member.name,
          sub: `${member.status === "HIATUS" ? "HIATUS · " : ""}daily ${growth.day == null ? "—" : `${growth.day >= 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(growth.day)}`} · coverage ${memberStats.observed}/${memberStats.expected}`,
          value: memberStats.totalFollowers,
        }))} />
      </section>

      <div className="backRow"><Link href="/groups">← All groups</Link><Link href={`/compare/?scope=members&metric=audience&group=${group.slug}`}>Compare members →</Link></div>
    </main>
  );
}
