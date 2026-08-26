import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AudienceBarList } from "@/components/audience-bar-list";
import { MemberHistoryExplorer } from "@/components/member-history-explorer";
import { SiteNav } from "@/components/site-nav";
import { officialGroups } from "@/lib/official-directory";
import { getGroup, getGroupStats, getGroupTimeline, groupGrowth, groupMembers } from "@/lib/analytics";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;

export function generateStaticParams() {
  return officialGroups.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const group = getGroup(slug);
  return group ? { title: `${group.name} | KAWAII LAB. Stats`, description: `${group.name}のSNS規模・前日比・媒体別推移・メンバー寄与を追跡。` } : {};
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getGroup(slug);
  if (!group) notFound();

  const stats = getGroupStats(group.slug);
  const growth = groupGrowth(group.slug);
  const timeline = getGroupTimeline(group.slug);
  const members = groupMembers(group).sort((a, b) => (b.stats.totalFollowers ?? -1) - (a.stats.totalFollowers ?? -1));

  return (
    <main>
      <SiteNav />
      <header className="pageHero compactHero pageHeroTight">
        <div>
          <p className="eyebrow">{group.category.replaceAll("_", " ")}</p>
          <h1>{group.name}</h1>
          <p className="lead">規模・日次成長・コンテンツ指標・SNS構成を同じ観測系列から追跡し、メンバーまで掘り下げます。</p>
        </div>
        <span className="badge">COVERAGE {stats.observed}/{stats.expected}</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article className="metricHero"><span>SNS total</span><strong>{fmt(stats.totalFollowers)}</strong><small>official + canonical members</small></article>
        <article><span>1-day audience Δ</span><strong>{signed(growth.day)}</strong><small>complete comparable account set only</small></article>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`}><span>TikTok total likes</span><strong>{fmt(stats.tiktokLikes)}</strong><small>open member comparison →</small></Link>
        <Link className="metricCardLink" href={`/compare/?scope=members&metric=youtubeViews&group=${group.slug}`}><span>YouTube total views</span><strong>{fmt(stats.youtubeViews)}</strong><small>trusted parser only →</small></Link>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>現在のSNS構成</h2></div><Link href={`/compare/?scope=members&metric=audience&group=${group.slug}`}>Compare members →</Link></div>
        <AudienceBarList showLegend items={[{ href: `/compare/?scope=members&metric=audience&group=${group.slug}`, label: group.name, sub: `official ${fmt(stats.officialFollowers)} · members ${fmt(stats.memberFollowers)} · ${stats.observed}/${stats.expected} observed`, value: stats.totalFollowers, mix: stats.platformFollowers }]} />
      </section>

      <MemberHistoryExplorer data={timeline} />

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">AUDIENCE BREAKDOWN</p><h2>現在の媒体別規模</h2></div><span>missing stays unknown</span></div>
          <div className="metricList metricListDense">
            {Object.entries(stats.platformFollowers).map(([platform, value]) => <div key={platform}><span>{platform}</span><strong>{fmt(value)}</strong></div>)}
          </div>
          <div className="metricList metricListDense"><div><span>Official accounts</span><strong>{fmt(stats.officialFollowers)}</strong></div><div><span>Members</span><strong>{fmt(stats.memberFollowers)}</strong></div></div>
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
        <AudienceBarList items={members.map(({ member, stats: memberStats, growth: memberGrowth }) => ({
          href: `/members/${member.slug}`,
          label: member.name,
          sub: `${member.status === "HIATUS" ? "HIATUS · " : ""}1D ${signed(memberGrowth.day)} · coverage ${memberStats.observed}/${memberStats.expected}`,
          value: memberStats.totalFollowers,
          mix: memberStats.platformFollowers,
        }))} />
      </section>

      <div className="backRow"><Link href="/groups">← All groups</Link><Link href={`/compare/?scope=members&metric=audience&group=${group.slug}`}>Compare members →</Link></div>
    </main>
  );
}
