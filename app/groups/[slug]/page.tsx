import Link from "next/link";
import { notFound } from "next/navigation";
import { AudienceBarList } from "@/components/audience-bar-list";
import { GrowthChart } from "@/components/growth-chart";
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
      <header className="pageHero compactHero pageHeroTight">
        <div>
          <p className="eyebrow">{group.category.replaceAll("_", " ")}</p>
          <h1>{group.name}</h1>
          <p className="lead">Audience / Activity / Growth を同じ尺度で追跡。構成比から個人寄与まで一段ずつ掘り下げられます。</p>
        </div>
        <span className="badge">COVERAGE {stats.observed}/{stats.expected}</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article className="metricHero"><span>Group scale</span><strong>{fmt(stats.totalFollowers)}</strong><small>official + canonical members</small></article>
        <article><span>Official accounts</span><strong>{fmt(stats.officialFollowers)}</strong><small>{group.accounts.length} official SNS</small></article>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`}><span>TikTok total likes</span><strong>{fmt(stats.tiktokLikes)}</strong><small>open member comparison →</small></Link>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=youtubeViews&group=${group.slug}`}><span>YouTube total views</span><strong>{fmt(stats.youtubeViews)}</strong><small>trusted parser only →</small></Link>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>現在のSNS構成</h2></div><Link href={`/compare/?scope=members&metric=audience&group=${group.slug}`}>Compare members →</Link></div>
        <AudienceBarList showLegend items={[{ href: `/compare/?scope=members&metric=audience&group=${group.slug}`, label: group.name, sub: `official + members · ${stats.observed}/${stats.expected} observed`, value: stats.totalFollowers, mix: stats.platformFollowers }]} />
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">SCALE HISTORY</p><h2>SNS合計推移</h2></div><span>{timeline.length} snapshots</span></div>
        {timeline.length >= 2 ? <GrowthChart data={timeline} groups={["Total"]} xKey="date" /> : <p className="lead">2日目の観測から時系列グラフが伸びます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">AUDIENCE BREAKDOWN</p><h2>媒体別規模</h2></div><span>current snapshot</span></div>
          <div className="metricList metricListDense">
            {Object.entries(stats.platformFollowers).map(([platform, value]) => <div key={platform}><span>{platform}</span><strong>{fmt(value)}</strong></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">OFFICIAL SNS</p><h2>グループ公式</h2></div><span>{group.accounts.length} accounts</span></div>
          <div className="accountStack">
            {group.accounts.map((account) => <a href={account.url} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}><span>{account.platform}</span><strong>@{account.handle.replace(/^@/, "")}</strong><b>↗</b></a>)}
          </div>
        </div>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">MEMBER CONTRIBUTION</p><h2>メンバーSNS規模</h2></div><span>absolute scale · stacked by platform</span></div>
        <AudienceBarList items={members.map(({ member, stats: memberStats, growth }) => ({
          href: `/members/${member.slug}`,
          label: member.name,
          sub: `${member.status === "HIATUS" ? "HIATUS · " : ""}daily ${growth.day == null ? "—" : `${growth.day >= 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(growth.day)}`} · coverage ${memberStats.observed}/${memberStats.expected}`,
          value: memberStats.totalFollowers,
          mix: memberStats.platformFollowers,
        }))} />
      </section>

      <div className="backRow"><Link href="/groups">← All groups</Link><Link href={`/compare/?scope=members&metric=audience&group=${group.slug}`}>Compare members →</Link></div>
    </main>
  );
}
