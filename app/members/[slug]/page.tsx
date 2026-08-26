import Link from "next/link";
import { notFound } from "next/navigation";
import { AudienceBarList } from "@/components/audience-bar-list";
import { MemberHistoryExplorer } from "@/components/member-history-explorer";
import { SiteNav } from "@/components/site-nav";
import { allMembers, getMember, getMemberStats, getMemberTimeline, memberGrowth } from "@/lib/analytics";
import { trustedAccount } from "@/lib/live-stats";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;

export function generateStaticParams() {
  return allMembers.map((member) => ({ slug: member.slug }));
}

export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = getMember(slug);
  if (!member) notFound();

  const stats = getMemberStats(slug);
  const growth = memberGrowth(slug);
  const timeline = getMemberTimeline(slug);
  const liveAccounts = stats.accounts;

  return (
    <main>
      <SiteNav />
      <header className="pageHero compactHero pageHeroTight">
        <div>
          <p className="eyebrow">MEMBER ANALYTICS</p>
          <h1>{member.name}</h1>
          <div className="relationTags">
            {member.relations.map((group) => <Link href={`/groups/${group.slug}`} key={group.slug}>{group.name}</Link>)}
            {member.status === "HIATUS" ? <span className="statusTag">HIATUS</span> : null}
          </div>
        </div>
        <span className="badge">COVERAGE {stats.observed}/{stats.expected}</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article className="metricHero"><span>SNS total</span><strong>{fmt(stats.totalFollowers)}</strong><small>trusted account audience sum</small></article>
        <article><span>24h growth</span><strong>{signed(growth.day)}</strong><small>latest complete daily interval</small></article>
        <article><span>TikTok total likes</span><strong>{fmt(stats.tiktokLikes)}</strong><small>profile total likes</small></article>
        <article><span>YouTube total views</span><strong>{fmt(stats.youtubeViews)}</strong><small>trusted channel lifetime views</small></article>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>現在のSNS構成</h2></div><Link href={`/compare/?scope=members&metric=audience&selected=${member.slug}`}>Open in Compare →</Link></div>
        <AudienceBarList items={[{href:`/compare/?scope=members&metric=audience&selected=${member.slug}`,label:member.name,sub:`${member.primaryGroup?.name ?? member.relations[0]?.name ?? "MEMBER"} · coverage ${stats.observed}/${stats.expected}`,value:stats.totalFollowers,mix:stats.platformFollowers}]} />
      </section>

      <MemberHistoryExplorer data={timeline} />

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">AUDIENCE BREAKDOWN</p><h2>現在の媒体別規模</h2></div></div>
          <div className="metricList metricListDense">
            {Object.entries(stats.platformFollowers).map(([platform, value]) => <div key={platform}><span>{platform}</span><strong>{fmt(value)}</strong></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">GROWTH WINDOWS</p><h2>増加数</h2></div></div>
          <div className="metricList metricListDense"><div><span>1 day</span><strong>{signed(growth.day)}</strong></div><div><span>7 days</span><strong>{signed(growth.week)}</strong></div><div><span>30 days</span><strong>{signed(growth.month)}</strong></div></div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">SOCIAL ACCOUNTS</p><h2>アカウント別観測値</h2></div><span>raw source links</span></div>
        <div className="accountDataGrid">
          {liveAccounts.map((account) => {
            const trusted = trustedAccount(account);
            const unavailable = Boolean(account.error) || !trusted;
            return (
              <a className={`accountDataCard ${unavailable ? "isMissing" : ""}`} href={account.profileUrl} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}>
                <div><span>{account.platform}</span><strong>@{account.handle.replace(/^@/, "")}</strong></div>
                {unavailable ? <><b>{account.error ? "Unavailable" : "Re-observe pending"}</b><small>{account.error ?? "旧YouTube parser値を除外。次回0:00 JST観測で更新"}</small></> : <><b>{fmt(account.followers ?? null)}</b><small>{account.platform === "YOUTUBE" ? "subscribers" : "followers"}{account.platform === "TIKTOK" && account.likes != null ? ` · ${fmt(account.likes)} likes` : ""}{account.platform === "YOUTUBE" && account.views != null ? ` · ${fmt(account.views)} views` : ""}</small></>}
              </a>
            );
          })}
        </div>
      </section>

      <div className="backRow"><Link href="/members">← All members</Link><Link href="/rankings">Rankings →</Link></div>
    </main>
  );
}
