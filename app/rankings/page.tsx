import { MetricBarList } from "@/components/metric-bar-list";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";
import { liveGroupStats } from "@/lib/live-stats";

export default function RankingsPage() {
  const groups = [...liveGroupStats].sort((a, b) => b.ecosystemFollowers - a.ecosystemFollowers);
  const members = currentMemberRanking().slice(0, 20);
  const tiktok = [...groups].sort((a, b) => (b.tiktokLikes ?? -1) - (a.tiktokLikes ?? -1));
  const youtube = [...groups].sort((a, b) => (b.youtubeViews ?? -1) - (a.youtubeViews ?? -1));

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div>
          <p className="eyebrow">LEADERBOARDS</p>
          <h1>Rankings</h1>
          <p className="lead">数値だけでなく横棒の長さで規模差を表示。コンテンツ指標の行を押すと、そのグループ内メンバーを同じ指標で比較する画面へ掘れます。</p>
        </div>
        <span className="badge">VISUAL RANKING</span>
      </header>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">GROUP SCALE</p><h2>グループ総SNS規模</h2></div><span>official + members</span></div>
          <MetricBarList items={groups.map((group) => ({ href: `/groups/${group.slug}`, label: group.name, sub: `coverage ${group.observedAccounts}/${group.expectedAccounts}`, value: group.ecosystemFollowers }))} />
        </div>

        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT SCALE</p><h2>TikTok総いいね</h2></div><span>click → member compare</span></div>
          <MetricBarList items={tiktok.map((group) => ({ href: `/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`, label: group.name, sub: `${group.tiktokLikeAccounts} observed TikTok accounts`, value: group.tiktokLikes }))} />
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT SCALE</p><h2>YouTube総再生</h2></div><span>click → member compare</span></div>
          <MetricBarList items={youtube.map((group) => ({ href: `/compare/?scope=members&metric=youtubeViews&group=${group.slug}`, label: group.name, sub: `${group.youtubeViewAccounts} observed YouTube accounts`, value: group.youtubeViews }))} />
        </div>

        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">MEMBER SCALE</p><h2>個人SNS総規模 Top 20</h2></div><span>all tracked platforms</span></div>
          <MetricBarList items={members.map(({ member, stats }) => ({ href: `/members/${member.slug}`, label: member.name, sub: `${member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"} · coverage ${stats.observed}/${stats.expected}`, value: stats.totalFollowers }))} />
        </div>
      </section>
    </main>
  );
}
