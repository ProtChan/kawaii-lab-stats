import Link from "next/link";
import { AudienceBarList } from "@/components/audience-bar-list";
import { DeltaBarList } from "@/components/delta-bar-list";
import { GrowthChart } from "@/components/growth-chart";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking, historySnapshots } from "@/lib/analytics";
import { directorySummary } from "@/lib/official-directory";
import { hasLiveData, liveGroupStats, liveSummary, liveTimeline } from "@/lib/live-stats";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;

export default function Home() {
  if (!hasLiveData) {
    return <main><SiteNav/><header className="pageHero"><div><p className="eyebrow">FANMADE ANALYTICS</p><h1>KAWAII LAB.<br/>Stats</h1><p className="lead">公式・メンバーの公開SNSプロフィールを1日1回観測し、Scale / Growth / Activityへ加工して公開する非公式データサイト。</p></div><span className="badge">COLLECTION PENDING</span></header><section className="metricGrid"><article><span>Canonical accounts</span><strong>{directorySummary.accounts}</strong></article><article><span>Unique members</span><strong>{directorySummary.members}</strong></article><article><span>Cadence</span><strong>1× / day</strong></article></section></main>;
  }

  const ranked = [...liveGroupStats].sort((a,b)=>(b.ecosystemFollowers ?? -1)-(a.ecosystemFollowers ?? -1));
  const groupMovers = [...liveGroupStats].sort((a,b)=>(b.dailyGain ?? Number.NEGATIVE_INFINITY)-(a.dailyGain ?? Number.NEGATIVE_INFINITY));
  const memberMovers = currentMemberRanking().sort((a,b)=>(b.growth.day ?? Number.NEGATIVE_INFINITY)-(a.growth.day ?? Number.NEGATIVE_INFINITY)).slice(0,8);
  const top = ranked[0];
  const topMover = groupMovers.find((group) => group.dailyGain != null) ?? null;
  const coverage = liveSummary.attempted ? (liveSummary.successful/liveSummary.attempted)*100 : 0;
  const collectedAt = liveSummary.collectedAt ? new Date(liveSummary.collectedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

  return (
    <main>
      <SiteNav />
      <header className="hero heroObservatory">
        <div className="heroCopy"><p className="eyebrow">KAWAII LAB. DATA OBSERVATORY</p><h1>KAWAII LAB.<br/><span>Stats</span></h1><p className="lead">「誰が大きいか」だけでなく、「今日どこが動いたか」まで。公開SNSを日次観測し、グループから個人・媒体まで同じルールで掘り下げます。</p><div className="heroActions"><Link className="primaryAction" href="/rankings">See today&apos;s movers →</Link><Link className="secondaryAction" href="/compare">Build a comparison</Link></div></div>
        <div className="heroStatus"><span className="statusDot"/><div><small>LAST SNAPSHOT</small><strong>{liveSummary.date}</strong><span>{collectedAt} JST · {liveSummary.successful}/{liveSummary.attempted}</span></div></div>
      </header>

      <section className="dataStrip snapshotStrip">
        <div><span>Snapshot</span><strong>{liveSummary.date}</strong></div>
        <div><span>Trusted coverage</span><strong>{coverage.toFixed(1)}% · {liveSummary.successful}/{liveSummary.attempted}</strong></div>
        <div><span>History</span><strong>{historySnapshots.length} daily snapshots</strong></div>
        <div><span>Cadence</span><strong>00:00 JST · 00:30 fallback</strong></div>
      </section>

      <section className="metricGrid metricGrid4 overviewKpis">
        <article className="metricHero"><span>Observed audience</span><strong>{fmt(liveSummary.observedAudience)}</strong><small>primary-group ecosystem sum</small></article>
        <article><span>Largest group</span><strong>{top?.name ?? "—"}</strong><small>{fmt(top?.ecosystemFollowers ?? null)}</small></article>
        <article><span>Top group mover</span><strong>{topMover?.name ?? "—"}</strong><small>{signed(topMover?.dailyGain ?? null)} / day</small></article>
        <article><span>TikTok total likes</span><strong>{fmt(liveSummary.tiktokLikes)}</strong><small>trusted observed profiles</small></article>
      </section>

      <section className="grid2">
        <div className="panel panelFeature">
          <div className="sectionHead"><div><p className="eyebrow">TODAY · GROUPS</p><h2>前日増加数</h2></div><Link href="/rankings">Full rankings →</Link></div>
          <DeltaBarList items={groupMovers.map((group)=>({href:`/compare/?scope=groups&metric=audience&view=daily&selected=${group.slug}`,label:group.name,sub:group.dailyGrowthRate==null?"not comparable":`${group.dailyGrowthRate>=0?"+":""}${group.dailyGrowthRate.toFixed(3)}%`,value:group.dailyGain}))}/>
        </div>
        <div className="panel panelFeature">
          <div className="sectionHead"><div><p className="eyebrow">TODAY · MEMBERS</p><h2>個人前日増加 Top 8</h2></div><Link href="/rankings">Full rankings →</Link></div>
          <DeltaBarList items={memberMovers.map(({member,growth})=>({href:`/compare/?scope=members&metric=audience&view=daily&selected=${member.slug}`,label:member.name,sub:member.primaryGroup?.name ?? member.relations[0]?.name ?? "MEMBER",value:growth.day}))}/>
        </div>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>グループSNS規模</h2></div><Link href="/rankings">Full rankings →</Link></div>
        <AudienceBarList items={ranked.map((group)=>({href:`/groups/${group.slug}`,label:group.name,sub:`official ${fmt(group.officialFollowers)} · members ${fmt(group.memberFollowers)} · coverage ${group.observedAccounts}/${group.expectedAccounts}`,value:group.ecosystemFollowers,mix:group.platforms}))}/>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">GROUP HISTORY</p><h2>SNS合計推移</h2></div><Link href="/compare/?scope=groups&metric=audience">Open Compare →</Link></div>
        {liveTimeline.length >= 2 ? <GrowthChart data={liveTimeline} groups={liveGroupStats.map((group)=>group.name)} xKey="date" connectNulls={false}/> : <p className="lead">2日目からグループ間の推移比較が表示されます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>TikTok総いいね</h2></div><Link href="/compare/?metric=tiktokLikes">Compare →</Link></div>
          <div className="activityList">{[...ranked].sort((a,b)=>(b.tiktokLikes ?? -1)-(a.tiktokLikes ?? -1)).map((group)=><Link href={`/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`} className="activityRow" key={group.slug}><div><strong>{group.name}</strong><small>{group.tiktokLikeAccounts}/{group.tiktokLikeExpected} profiles</small></div><b>{fmt(group.tiktokLikes)}</b><span>Open member breakdown →</span></Link>)}</div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>YouTube総再生</h2></div><Link href="/compare/?metric=youtubeViews">Compare →</Link></div>
          <div className="activityList">{[...ranked].sort((a,b)=>(b.youtubeViews ?? -1)-(a.youtubeViews ?? -1)).map((group)=><Link href={`/compare/?scope=members&metric=youtubeViews&group=${group.slug}`} className="activityRow" key={group.slug}><div><strong>{group.name}</strong><small>{group.youtubeViewAccounts}/{group.youtubeViewExpected} channels</small></div><b>{fmt(group.youtubeViews)}</b><span>Open member breakdown →</span></Link>)}</div>
        </div>
      </section>

      <section className="dataStrip"><div><span>Coverage policy</span><strong>欠測 ≠ 0</strong></div><div><span>Growth policy</span><strong>same account set only</strong></div><div><span>Public raw data</span><strong><Link href="/data/latest.json">latest.json ↗</Link></strong></div><div><span>Method</span><strong><Link href="/methodology">Read methodology →</Link></strong></div></section>

      <footer>Unofficial fanmade analytics. SNS横断合計はユニーク人数ではありません。Source / capture time / missing observations are preserved in public JSON.</footer>
    </main>
  );
}
