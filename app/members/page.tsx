import { MetricBarList } from "@/components/metric-bar-list";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";

export default function MembersPage() {
  const ranking = currentMemberRanking();

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div>
          <p className="eyebrow">MEMBER DATABASE</p>
          <h1>Members</h1>
          <p className="lead">所属をまたいだ個人SNS規模を、数値と横棒で一覧化。各行から個人ページへ掘り下げます。</p>
        </div>
        <span className="badge">{ranking.length} unique members</span>
      </header>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>個人SNS総規模</h2></div><span>all tracked members</span></div>
        <MetricBarList items={ranking.map(({ member, stats }) => ({
          href: `/members/${member.slug}`,
          label: member.name,
          sub: `${member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"}${member.status === "HIATUS" ? " · HIATUS" : ""} · coverage ${stats.observed}/${stats.expected}`,
          value: stats.totalFollowers,
        }))} />
      </section>
    </main>
  );
}
