import Link from "next/link";
import { GrowthChart } from "@/components/growth-chart";
import { demoNotice, groupStats } from "@/lib/demo-data";
import { directorySummary } from "@/lib/official-directory";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function DemoPage() {
  const total = groupStats.reduce((sum, group) => sum + group.totalFollowers, 0);
  const monthly = groupStats.reduce((sum, group) => sum + group.monthlyGain, 0);
  const ranked = [...groupStats].sort((a, b) => b.monthlyGain - a.monthlyGain);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">FANMADE ANALYTICS · DEMO</p>
          <h1>KAWAII LAB. Stats</h1>
          <p className="lead">レイアウト確認用の仮データ画面。公開トップとは完全に分離しています。</p>
        </div>
        <span className="badge">PLACEHOLDER DATA</span>
      </header>

      <nav className="nav">
        <Link href="/">Live dashboard</Link>
        <Link href="/directory">Verified official accounts ({directorySummary.accounts})</Link>
      </nav>

      <section className="notice">{demoNotice}</section>

      <section className="kpis">
        <article><span>Debuted groups in demo</span><strong>{groupStats.length}</strong></article>
        <article><span>Combined followers · demo</span><strong>{fmt(total)}</strong></article>
        <article><span>30d net growth · demo</span><strong>+{fmt(monthly)}</strong></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">TREND</p><h2>総合フォロワー推移</h2></div><span>6 months · demo</span></div>
        <GrowthChart />
        <div className="legend">{groupStats.map((group, index) => <span key={group.slug}><i style={{ background: `var(--chart-${index + 1})` }} />{group.name}</span>)}</div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">MOMENTUM</p><h2>月間増加ランキング</h2></div></div>
          <div className="ranking">{ranked.map((group, index) => <div className="rankRow" key={group.slug}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{group.name}</strong><small>{group.monthlyGrowthRate.toFixed(2)}% / month · demo</small></div><em>+{fmt(group.monthlyGain)}</em></div>)}</div>
        </div>

        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>SNS内訳</h2></div></div>
          {groupStats.map((group) => <div className="platformGroup" key={group.slug}><strong>{group.name}</strong><div>{Object.entries(group.platforms).map(([name, value]) => <span key={name}>{name}<b>{fmt(value)}</b></span>)}</div></div>)}
        </div>
      </section>

      <footer>Demo only. All values on this route are fictional placeholders.</footer>
    </main>
  );
}
