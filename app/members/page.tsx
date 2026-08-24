import { AudienceBarList } from "@/components/audience-bar-list";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";

export default function MembersPage() {
  const ranking = currentMemberRanking();

  return (
    <main>
      <SiteNav />
      <header className="pageHero pageHeroTight">
        <div>
          <p className="eyebrow">MEMBER DATABASE</p>
          <h1>Members</h1>
          <p className="lead">個人SNS規模を4媒体の積み上げで一覧化。総量だけでなく「どのSNSが強いか」まで一目で比較できます。</p>
        </div>
        <span className="badge">{ranking.length} UNIQUE MEMBERS</span>
      </header>

      <section className="panel panelFeature">
        <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>個人SNS総規模</h2></div><span>absolute scale · stacked by platform</span></div>
        <AudienceBarList items={ranking.map(({ member, stats }) => ({
          href: `/members/${member.slug}`,
          label: member.name,
          sub: `${member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"}${member.status === "HIATUS" ? " · HIATUS" : ""} · coverage ${stats.observed}/${stats.expected}`,
          value: stats.totalFollowers,
          mix: stats.platformFollowers,
        }))} />
      </section>
    </main>
  );
}
