import Link from "next/link";
import { AudienceBarList } from "@/components/audience-bar-list";
import { GrowthChart } from "@/components/growth-chart";
import { SiteNav } from "@/components/site-nav";
import { directorySummary } from "@/lib/official-directory";
import { hasLiveData, liveGroupStats, liveSummary, liveTimeline } from "@/lib/live-stats";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;

export default function Home() {
  if (!hasLiveData) {
    return <main><SiteNav/><header className="pageHero"><div><p className="eyebrow">FANMADE ANALYTICS</p><h1>KAWAII LAB.<br/>Stats</h1><p className="lead">公式・メンバーの公開SNSプロフィールを1日1回観測し、Scale / Growth / Momentum / Activityへ加工して公開する非公式データサイト。</p></div><span className="badge">COLLECTION PENDING</span></header><section className="metricGrid"><article><span>Canonical accounts</span><strong>{directorySummary.accounts}</strong></article><article><span>Unique members</span><strong>{directorySummary.members}</strong></article><article><span>Cadence</span><strong>1× / day</strong></article></section></main>;
  }

  const ranked = [...liveGroupStats].sort((a,b)=>b.ecosystemFollowers-a.ecosystemFollowers);
  const growthRanked = [...liveGroupStats].sort((a,b)=>(b.dailyGain ?? -Infinity)-(a.dailyGain ?? -Infinity));
  const top = ranked[0];
  const coverage = liveSummary.attempted ? (liveSummary.successful/liveSummary.attempted)*100 : 0;
  const collectedAt = liveSummary.collectedAt ? new Date(liveSummary.collectedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

  return (
    <main>
      <SiteNav />
      <header className="hero heroObservatory">
        <div className="heroCopy"><p className="eyebrow">KAWAII LAB. DATA OBSERVATORY</p><h1>KAWAII LAB.<br/><span>Stats</span></h1><p className="lead">SNSの「大きさ」と「伸び」を同じ場所で。公式・メンバーの公開プロフィールを日次で観測し、グループから個人まで掘り下げます。</p><div className="heroActions"><Link className="primaryAction" href="/rankings">Explore rankings →</Link><Link className="secondaryAction" href="/compare">Open compare</Link></div></div>
        <div className="heroStatus"><span className="statusDot"/><div><small>LAST SNAPSHOT</small><strong>{liveSummary.date}</strong><span>{collectedAt} JST</span></div></div>
      </header>

      <section className="metricGrid metricGrid4 overviewKpis">
        <article className="metricHero"><span>Observed audience</span><strong>{fmt(liveSummary.observedAudience)}</strong><small>primary-group ecosystem sum</small></article>
        <article><span>Largest group</span><strong>{top?.name ?? "—"}</strong><small>{fmt(top?.ecosystemFollowers ?? null)}</small></article>
        <article><span>TikTok total likes</span><strong>{fmt(liveSummary.tiktokLikes)}</strong><small>available debuted-group profiles</small></article>
        <article><span>Trusted coverage</span><strong>{coverage.toFixed(1)}%</strong><small>{liveSummary.successful}/{liveSummary.attempted} valid observations</small></article>
      </section>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>グループSNS規模</h2></div><Link href="/rankings">Full rankings →</Link></div>
        <AudienceBarList items={ranked.map((group)=>({href:`/groups/${group.slug}`,label:group.name,sub:`official ${fmt(group.officialFollowers)} · members ${fmt(group.memberFollowers)}`,value:group.ecosystemFollowers,mix:group.platforms}))}/>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">GROUP SCALE HISTORY</p><h2>グループ別 SNS合計推移</h2></div><span>{liveTimeline.length} daily snapshots</span></div>
        {liveTimeline.length >= 2 ? <><GrowthChart data={liveTimeline} groups={liveGroupStats.map((group)=>group.name)} xKey="date"/><div className="legend">{liveGroupStats.map((group,index)=><span key={group.slug}><i style={{background:`var(--chart-${(index%5)+1})`}}/>{group.name}</span>)}</div></> : <p className="lead">2日目からグループ間の推移比較が表示されます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">DAILY MOVERS</p><h2>前日増加数</h2></div><Link href="/rankings">All metrics →</Link></div>
          <div className="ranking">{growthRanked.map((group,index)=><Link className="rankRow rankLink" href={`/groups/${group.slug}`} key={group.slug}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{group.name}</strong><small>{group.dailyGrowthRate==null?"2日目から算出":`${group.dailyGrowthRate>=0?"+":""}${group.dailyGrowthRate.toFixed(3)}% / day`}</small></div><em>{signed(group.dailyGain)}</em></Link>)}</div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>コンテンツ規模</h2></div><Link href="/compare/?metric=tiktokLikes">Compare →</Link></div>
          <div className="activityList">{ranked.map((group)=><Link href={`/groups/${group.slug}`} className="activityRow" key={group.slug}><div><strong>{group.name}</strong><small>TikTok likes</small></div><b>{fmt(group.tiktokLikes)}</b><span>YouTube {fmt(group.youtubeViews)}</span></Link>)}</div>
        </div>
      </section>

      <section className="dataStrip"><div><span>Coverage policy</span><strong>欠測は0にしない</strong></div><div><span>Update cadence</span><strong>Daily · 00:00 JST</strong></div><div><span>Public raw data</span><strong><Link href="/data/latest.json">latest.json ↗</Link></strong></div><div><span>Method</span><strong><Link href="/methodology">Read methodology →</Link></strong></div></section>

      <footer>Unofficial fanmade analytics. SNS横断合計はユニーク人数ではありません。Source / capture time / missing observations are preserved in public JSON.</footer>
    </main>
  );
}
