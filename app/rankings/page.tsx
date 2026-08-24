import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";
import { liveGroupStats } from "@/lib/live-stats";

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);

export default function RankingsPage() {
  const groups = [...liveGroupStats].sort((a, b) => b.ecosystemFollowers - a.ecosystemFollowers);
  const members = currentMemberRanking().slice(0, 20);

  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">LEADERBOARDS</p><h1>Rankings</h1><p className="lead">まず現在規模を基準に公開。履歴が溜まるにつれて1D / 7D / 30D GrowthとMomentumを追加します。</p></div><span className="badge">LIVE SNAPSHOT</span></header>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">GROUP SCALE</p><h2>グループ総SNS規模</h2></div></div>
          <div className="ranking">{groups.map((group, index) => <Link className="rankRow rankLink" href={`/groups/${group.slug}`} key={group.slug}><b>{String(index + 1).padStart(2,"0")}</b><div><strong>{group.name}</strong><small>coverage {group.observedAccounts}/{group.expectedAccounts}</small></div><em>{fmt(group.ecosystemFollowers)}</em></Link>)}</div>
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT SCALE</p><h2>TikTok総いいね</h2></div></div>
          <div className="ranking">{[...groups].sort((a,b)=>(b.tiktokLikes ?? -1)-(a.tiktokLikes ?? -1)).map((group,index)=><Link className="rankRow rankLink" href={`/groups/${group.slug}`} key={group.slug}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{group.name}</strong><small>{group.tiktokLikeAccounts} observed TikTok accounts</small></div><em>{fmt(group.tiktokLikes)}</em></Link>)}</div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">MEMBER SCALE</p><h2>個人SNS総規模 Top 20</h2></div><span>all tracked platforms</span></div>
        <div className="ranking">{members.map(({member,stats},index)=><Link className="rankRow rankLink" href={`/members/${member.slug}`} key={member.slug}><b>{String(index+1).padStart(2,"0")}</b><div><strong>{member.name}</strong><small>{member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"} · coverage {stats.observed}/{stats.expected}</small></div><em>{fmt(stats.totalFollowers)}</em></Link>)}</div>
      </section>
    </main>
  );
}
