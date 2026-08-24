import Link from "next/link";
import { GrowthChart } from "@/components/growth-chart";
import { demoNotice, groupStats } from "@/lib/demo-data";
import { directorySummary } from "@/lib/official-directory";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function Home() {
  const total = groupStats.reduce((sum, g) => sum + g.totalFollowers, 0);
  const monthly = groupStats.reduce((sum, g) => sum + g.monthlyGain, 0);
  const ranked = [...groupStats].sort((a, b) => b.monthlyGain - a.monthlyGain);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">FANMADE ANALYTICS · DEMO</p>
          <h1>KAWAII LAB. Stats</h1>
          <p className="lead">各グループ・メンバーのSNS規模と成長を、時系列で比較できる非公式データサイト。</p>
        </div>
        <span className="badge">PLACEHOLDER DATA</span>
      </header>

      <nav className="nav">
        <Link href="/demo">Demo dashboard</Link>
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
        <div className="legend">{groupStats.map((g, i) => <span key={g.slug}><i style={{ background: `var(--chart-${i + 1})` }} />{g.name}</span>)}</div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">MOMENTUM</p><h2>月間増加ランキング</h2></div></div>
          <div className="ranking">{ranked.map((g, i) => <div className="rankRow" key={g.slug}><b>{String(i + 1).padStart(2, "0")}</b><div><strong>{g.name}</strong><small>{g.monthlyGrowthRate.toFixed(2)}% / month · demo</small></div><em>+{fmt(g.monthlyGain)}</em></div>)}</div>
        </div>

        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>SNS内訳</h2></div></div>
          {groupStats.map((g) => <div className="platformGroup" key={g.slug}><strong>{g.name}</strong><div>{Object.entries(g.platforms).map(([name, value]) => <span key={name}>{name}<b>{fmt(value)}</b></span>)}</div></div>)}
        </div>
      </section>

      <footer>Fanmade / unofficial project. Not affiliated with KAWAII LAB. or its management. Demo statistics are fictional placeholders; official account mappings and source timestamps are maintained separately.</footer>
    </main>
  );
}
