import { SiteNav } from "@/components/site-nav";
import { liveSnapshot } from "@/lib/live-stats";

const labels = { X: "X", INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube" } as const;

export default function CoveragePage() {
  const byPlatform = (Object.keys(labels) as Array<keyof typeof labels>).map((platform) => {
    const rows = liveSnapshot.accounts.filter((account) => account.platform === platform);
    const ok = rows.filter((account) => !account.error && typeof account.followers === "number").length;
    return { platform, label: labels[platform], total: rows.length, ok, failed: rows.length - ok, rate: rows.length ? (ok / rows.length) * 100 : 0 };
  });
  const failures = liveSnapshot.accounts.filter((account) => account.error);

  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">DATA QUALITY</p><h1>Coverage</h1><p className="lead">取得不能を0にせず欠測として可視化。ランキングや合計値を読む前に、どの媒体がどれだけ観測できているか確認できます。</p></div><span className="badge">{liveSnapshot.successful}/{liveSnapshot.attempted} observed</span></header>

      <section className="metricGrid metricGrid4">
        {byPlatform.map((item) => <article key={item.platform}><span>{item.label}</span><strong>{item.rate.toFixed(1)}%</strong><small>{item.ok}/{item.total} profiles</small></article>)}
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">UNAVAILABLE</p><h2>最新snapshotの欠測</h2></div><span>{failures.length} accounts</span></div>
        {failures.length ? <div className="failureList">{failures.map((account)=><a href={account.profileUrl} target="_blank" rel="noreferrer" key={`${account.platform}-${account.handle}`}><div><strong>{account.entityName}</strong><span>{labels[account.platform]} · @{account.handle.replace(/^@/,"")}</span></div><b>{account.error}</b></a>)}</div> : <p className="lead">現在のsnapshotに欠測はありません。</p>}
      </section>
    </main>
  );
}
