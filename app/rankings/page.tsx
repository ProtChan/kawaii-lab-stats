import { AudienceBarList } from "@/components/audience-bar-list";
import { DeltaBarList } from "@/components/delta-bar-list";
import { MetricBarList } from "@/components/metric-bar-list";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking, groupGrowth } from "@/lib/analytics";
import { liveGroupStats } from "@/lib/live-stats";

export default function RankingsPage() {
  const groups = [...liveGroupStats].sort((a, b) => (b.ecosystemFollowers ?? -1) - (a.ecosystemFollowers ?? -1));
  const members = currentMemberRanking();
  const memberScale = members.slice(0, 20);
  const groupDaily = groups
    .map((group) => ({ group, growth: groupGrowth(group.slug) }))
    .sort((a, b) => (b.growth.day ?? Number.NEGATIVE_INFINITY) - (a.growth.day ?? Number.NEGATIVE_INFINITY));
  const memberDaily = [...members]
    .sort((a, b) => (b.growth.day ?? Number.NEGATIVE_INFINITY) - (a.growth.day ?? Number.NEGATIVE_INFINITY))
    .slice(0, 20);
  const tiktok = [...groups].sort((a, b) => (b.tiktokLikes ?? -1) - (a.tiktokLikes ?? -1));
  const youtube = [...groups].sort((a, b) => (b.youtubeViews ?? -1) - (a.youtubeViews ?? -1));

  return (
    <main>
      <SiteNav />
      <header className="pageHero pageHeroTight">
        <div>
          <p className="eyebrow">DISCOVERY</p>
          <h1>Rankings</h1>
          <p className="lead">Scaleは「今どれだけ大きいか」、Daily moversは「前日から何が動いたか」。ランキングで発見し、行から詳細またはCompareへ掘ります。</p>
        </div>
        <span className="badge">SCALE × CHANGE</span>
      </header>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">GROUP SCALE</p><h2>グループ総SNS規模</h2></div><span>official + members · absolute scale</span></div>
        <AudienceBarList items={groups.map((group) => ({ href: `/groups/${group.slug}`, label: group.name, sub: `coverage ${group.observedAccounts}/${group.expectedAccounts}`, value: group.ecosystemFollowers, mix: group.platforms }))} />
      </section>

      <section className="grid2">
        <div className="panel panelFeature">
          <div className="sectionHead"><div><p className="eyebrow">DAILY MOVERS</p><h2>グループ 1-day Δ</h2></div><span>comparable snapshots only</span></div>
          <DeltaBarList items={groupDaily.map(({ group, growth }) => ({ href: `/compare/?scope=groups&metric=audience&view=daily&selected=${group.slug}`, label: group.name, sub: "audience change", value: growth.day }))} />
        </div>
        <div className="panel panelFeature">
          <div className="sectionHead"><div><p className="eyebrow">DAILY MOVERS</p><h2>メンバー 1-day Δ Top 20</h2></div><span>same canonical accounts only</span></div>
          <DeltaBarList items={memberDaily.map(({ member, growth }) => ({ href: `/compare/?scope=members&metric=audience&view=daily&selected=${member.slug}`, label: member.name, sub: member.primaryGroup?.name ?? member.relations[0]?.name ?? "MEMBER", value: growth.day }))} />
        </div>
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT SCALE</p><h2>TikTok総いいね</h2></div><span>click → member compare</span></div>
          <MetricBarList items={tiktok.map((group) => ({ href: `/compare/?scope=members&metric=tiktokLikes&group=${group.slug}`, label: group.name, sub: `${group.tiktokLikeAccounts}/${group.tiktokLikeExpected} observed TikTok accounts`, value: group.tiktokLikes }))} />
        </div>
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CONTENT SCALE</p><h2>YouTube総再生</h2></div><span>trusted parser only</span></div>
          <MetricBarList items={youtube.map((group) => ({ href: `/compare/?scope=members&metric=youtubeViews&group=${group.slug}`, label: group.name, sub: `${group.youtubeViewAccounts}/${group.youtubeViewExpected} observed YouTube accounts`, value: group.youtubeViews }))} />
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">MEMBER SCALE</p><h2>個人SNS総規模 Top 20</h2></div><span>stacked by platform</span></div>
        <AudienceBarList items={memberScale.map(({ member, stats }) => ({ href: `/members/${member.slug}`, label: member.name, sub: `${member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"} · coverage ${stats.observed}/${stats.expected}`, value: stats.totalFollowers, mix: stats.platformFollowers }))} />
      </section>
    </main>
  );
}
