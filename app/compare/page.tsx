import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { liveGroupStats } from "@/lib/live-stats";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);

export default function ComparePage() {
  const groups = [...liveGroupStats].sort((a,b)=>b.ecosystemFollowers-a.ecosystemFollowers);
  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">COMPARE LAB</p><h1>Compare</h1><p className="lead">比較機能の第一版。現在値を横並びにし、履歴が溜まり次第 Indexed=100 / Growth / Momentum の選択比較へ拡張します。</p></div><span className="badge">PHASE 1</span></header>
      <section className="tablePanel compareTable">
        <div className="dataTable compareRow headerRow"><span>Group</span><span>Total</span><span>X</span><span>Instagram</span><span>TikTok</span><span>YouTube</span></div>
        {groups.map((group)=><Link href={`/groups/${group.slug}`} className="dataTable compareRow" key={group.slug}><strong>{group.name}</strong><b>{fmt(group.ecosystemFollowers)}</b><span>{fmt(group.platforms.X)}</span><span>{fmt(group.platforms.Instagram)}</span><span>{fmt(group.platforms.TikTok)}</span><span>{fmt(group.platforms.YouTube)}</span></Link>)}
      </section>
      <section className="notice">次フェーズでは2〜5対象を選択し、Absolute / Growth / Growth % / Indexed / Momentum を同じチャート上で切り替えられる比較UIにします。</section>
    </main>
  );
}
