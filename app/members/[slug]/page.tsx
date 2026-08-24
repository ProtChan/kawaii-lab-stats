import Link from "next/link";
import { notFound } from "next/navigation";
import { GrowthChart } from "@/components/growth-chart";
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
      <header className="pageHero compactHero">
        <div>
          <p className="eyebrow">MEMBER ANALYTICS</p>
          <h1>{member.name}</h1>
          <div className="relationTags">
            {member.relations.map((group) => <Link href={`/groups/${group.slug}`} key={group.slug}>{group.name}</Link>)}
            {member.status === "HIATUS" ? <span className="statusTag">HIATUS</span> : null}
          </div>
        </div>
        <span className="badge">coverage {stats.observed}/{stats.expected}</span>
      </header>

      <section className="metricGrid metricGrid4">
        <article><span>SNS total</span><strong>{fmt(stats.totalFollowers)}</strong><small>account audience sum</small></article>
        <article><span>24h growth</span><strong>{signed(growth.day)}</strong><small>available from 2nd snapshot</small></article>
        <article><span>TikTok total likes</span><strong>{fmt(stats.tiktokLikes)}</strong><small>profile total likes</small></article>
        <article><span>YouTube total views</span><strong>{fmt(stats.youtubeViews)}</strong><small>channel lifetime views</small></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">AUDIENCE HISTORY</p><h2>SNS別フォロワー推移</h2></div><span>{timeline.length} snapshots</span></div>
        {timeline.length >= 2 ? <GrowthChart data={timeline} groups={["Total", "X", "Instagram", "TikTok", "YouTube"]} xKey="date" /> : <p className="lead">2日目以降、Totalと各SNSの時系列がここに表示されます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">PLATFORM SCALE</p><h2>現在の媒体別規模</h2></div></div>
          <div className="metricList">
            {Object.entries(stats.platformFollowers).map(([platform, value]) => <div key={platform}><span>{platform}</span><strong>{fmt(value)}</strong></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">GROWTH WINDOWS</p><h2>増加数</h2></div></div>
          <div className="metricList"><div><span>1 day</span><strong>{signed(growth.day)}</strong></div><div><span>7 days</span><strong>{signed(growth.week)}</strong></div><div><span>30 days</span><strong>{signed(growth.month)}</strong></div></div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">SOCIAL ACCOUNTS</p><h2>アカウント別観測値</h2></div><span>raw public-profile observations</span></div>
        <div className="accountDataGrid">
          {liveAccounts.map((account) => {
            const trusted = trustedAccount(account);
            const unavailable = Boolean(account.error) || !trusted;
            return (
              <a className={`accountDataCard ${unavailable ? "isMissing" : ""}`} href={account.profileUrl} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}>
                <div><span>{account.platform}</span><strong>@{account.handle.replace(/^@/, "")}</strong></div>
                {unavailable ? <><b>Unavailable</b><small>{account.error ?? "parser result excluded from analytics"}</small></> : <><b>{fmt(account.followers ?? null)}</b><small>{account.platform === "YOUTUBE" ? "subscribers" : "followers"}{account.platform === "TIKTOK" && account.likes != null ? ` · ${fmt(account.likes)} likes` : ""}{account.platform === "YOUTUBE" && account.views != null ? ` · ${fmt(account.views)} views` : ""}</small></>}
              </a>
            );
          })}
        </div>
      </section>

      <div className="backRow"><Link href="/members">← All members</Link><Link href="/rankings">Rankings →</Link></div>
    </main>
  );
}