import Link from "next/link";
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
  const collectedAt = liveSummary.collectedAt ? new Date(liveSummary.collectedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"medium",timeStyle:"short"}) : "—";

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div><p className="eyebrow">KAWAII LAB. DATA OBSERVATORY</p><h1>KAWAII LAB.<br/>Stats</h1><p className="lead">現在規模だけでなく、「どれだけ増えたか」「今どれだけ勢いがあるか」「コンテンツがどれだけ消費されているか」を日次観測します。</p></div>
        <span className="badge">UPDATED {liveSummary.date}</span>
      </header>

      <section className="notice">最終取得 {collectedAt} JST · {liveSummary.successful}/{liveSummary.attempted} profiles · 欠測は0に変換しません。</section>

      <section className="metricGrid metricGrid4">
        <article><span>Observed audience</span><strong>{fmt(liveSummary.observedAudience)}</strong><small>primary group ecosystem sum</small></article>
        <article><span>Largest group</span><strong>{top?.name ?? "—"}</strong><small>{fmt(top?.ecosystemFollowers ?? null)}</small></article>
        <article><span>TikTok total likes</span><strong>{fmt(liveSummary.tiktokLikes)}</strong><small>available debuted-group profiles</small></article>
        <article><span>Data coverage</span><strong>{coverage.toFixed(1)}%</strong><small>{liveSummary.failed} unavailable today</small></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">GROUP SCALE HISTORY</p><h2>グループ別 SNS合計推移</h2></div><span>{liveTimeline.length} daily snapshots</span></div>
        {liveTimeline.length >= 2 ? <><GrowthChart data={liveTimeline} groups={liveGroupStats.map((group)=>group.name)} xKey="date"/><div className="legend">{liveGroupStats.map((group,index)=><span key={group.slug}><i style={{background:`var(--chart-${(index%5)+1})`}}/>{group.name}</span>)}</div></> : <p className="lead">初回snapshot取得済み。2日目から比較線が伸び始めます。</p>}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>現在SNS規模</h2></div><Link href="/groups">All groups →</Link></div>
          <div className="ranking">{ranked.map((group,index)=><Link className="rankRow rankLink" href={`/groups/${group.slug}`} key={group.slug}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{group.name}</strong><small>official {fmt(group.officialFollowers)} · members {fmt(group.memberFollowers)}</small></div><em>{fmt(group.ecosystemFollowers)}</em></Link>)}</div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">DAILY MOVERS</p><h2>前日増加数</h2></div><Link href="/rankings">Rankings →</Link></div>
          <div className="ranking">{growthRanked.map((group,index)=><Link className="rankRow rankLink" href={`/groups/${group.slug}`} key={group.slug}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{group.name}</strong><small>{group.dailyGrowthRate==null?"2日目から算出":`${group.dailyGrowthRate>=0?"+":""}${group.dailyGrowthRate.toFixed(3)}% / day`}</small></div><em>{signed(group.dailyGain)}</em></Link>)}</div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">CONTENT ACTIVITY</p><h2>Followers以外の規模指標</h2></div><span>lifetime totals; daily deltas later</span></div>
        <div className="memberStatGrid">{ranked.map((group)=><Link href={`/groups/${group.slug}`} className="memberStatCard" key={group.slug}><div><strong>{group.name}</strong></div><b>{fmt(group.tiktokLikes)}</b><small>TikTok total likes · YouTube views {fmt(group.youtubeViews)}</small></Link>)}</div>
      </section>

      <footer>Unofficial fanmade analytics. SNS横断合計はユニーク人数ではありません。Source / capture time / missing observations are preserved in public JSON. <Link href="/methodology">Methodology</Link></footer>
    </main>
  );
}
