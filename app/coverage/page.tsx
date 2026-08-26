import { GrowthChart } from "@/components/growth-chart";
import { SiteNav } from "@/components/site-nav";
import { historySnapshots } from "@/lib/analytics";
import { aggregateAccounts, trustedMetricAccount } from "@/lib/metrics";
import { liveSnapshot, trustedAccount } from "@/lib/live-stats";

const labels = { X: "X", INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube" } as const;

export default function CoveragePage() {
  const byPlatform = (Object.keys(labels) as Array<keyof typeof labels>).map((platform) => {
    const rows = liveSnapshot.accounts.filter((account) => account.platform === platform);
    const ok = rows.filter((account) => trustedAccount(account) && !account.error && typeof account.followers === "number").length;
    return { platform, label: labels[platform], total: rows.length, ok, failed: rows.length - ok, rate: rows.length ? (ok / rows.length) * 100 : 0 };
  });
  const aggregate = aggregateAccounts(liveSnapshot.accounts);
  const failures = liveSnapshot.accounts.filter((account) => account.error || !trustedAccount(account));
  const observed = byPlatform.reduce((total, item) => total + item.ok, 0);
  const attempted = byPlatform.reduce((total, item) => total + item.total, 0);
  const history = historySnapshots.map((snapshot) => {
    const expected = snapshot.accounts.length;
    const observedRows = snapshot.accounts.filter((account) => trustedMetricAccount(account) && !account.error && typeof account.followers === "number").length;
    return { date: snapshot.date?.slice(5) ?? "—", Observed: observedRows, Expected: expected };
  });

  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">DATA QUALITY</p><h1>Coverage</h1><p className="lead">取得率・欠測・parser除外を独立表示。分析値が「完全観測」なのか「観測できた範囲の部分合計」なのかを確認するための品質ページです。</p></div><span className="badge">{observed}/{attempted} trusted</span></header>

      <section className="metricGrid metricGrid4">
        {byPlatform.map((item) => <article key={item.platform}><span>{item.label} audience</span><strong>{item.rate.toFixed(1)}%</strong><small>{item.ok}/{item.total} profiles</small></article>)}
      </section>

      <section className="grid2">
        <article className="panel"><p className="eyebrow">ACTIVITY METRIC</p><h2>TikTok likes</h2><div className="bigMetric">{aggregate.tiktokLikes.expected ? `${aggregate.tiktokLikes.observed}/${aggregate.tiktokLikes.expected}` : "N/A"}</div><p className="lead">profile total likesが数値として取得できたTikTokアカウント。</p></article>
        <article className="panel"><p className="eyebrow">ACTIVITY METRIC</p><h2>YouTube views</h2><div className="bigMetric">{aggregate.youtubeViews.expected ? `${aggregate.youtubeViews.observed}/${aggregate.youtubeViews.expected}` : "N/A"}</div><p className="lead">信頼済みparserでtotal channel viewsを取得できたYouTubeチャンネル。</p></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">HISTORY HEALTH</p><h2>日次観測件数</h2></div><span>{history.length} snapshots</span></div>
        {history.length >= 2 ? <GrowthChart data={history} groups={["Observed", "Expected"]} xKey="date" connectNulls={false} /> : <p className="lead">履歴が2日以上になると観測件数の推移を表示します。</p>}
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">UNAVAILABLE</p><h2>最新snapshotの欠測・除外値</h2></div><span>{failures.length} accounts</span></div>
        {failures.length ? <div className="failureList">{failures.map((account)=><a href={account.profileUrl} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}><div><strong>{account.entityName}</strong><span>{labels[account.platform]} · @{account.handle.replace(/^@/,"")}</span></div><b>{account.error ?? "parser excluded"}</b></a>)}</div> : <p className="lead">現在のsnapshotに欠測はありません。</p>}
      </section>
    </main>
  );
}
