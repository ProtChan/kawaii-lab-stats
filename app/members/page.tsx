import { MemberDirectory } from "@/components/member-directory";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";
import { officialGroups } from "@/lib/official-directory";

export default function MembersPage() {
  const ranking = currentMemberRanking();
  const rows = ranking.map(({ member, stats, growth }) => ({
    slug: member.slug,
    name: member.name,
    groupName: member.primaryGroup?.name ?? member.relations[0]?.name ?? "—",
    groupSlugs: member.relations.map((group) => group.slug),
    status: member.status ?? "ACTIVE",
    total: stats.totalFollowers,
    mix: stats.platformFollowers,
    growthDay: growth.day,
    observed: stats.observed,
    expected: stats.expected,
  }));

  return (
    <main>
      <SiteNav />
      <header className="pageHero pageHeroTight">
        <div>
          <p className="eyebrow">MEMBER EXPLORER</p>
          <h1>Members</h1>
          <p className="lead">名前・所属で絞り込み、現在規模と前日増加を切替。個人ページでは媒体別推移と日次差分まで掘れます。</p>
        </div>
        <span className="badge">{ranking.length} UNIQUE MEMBERS</span>
      </header>

      <MemberDirectory rows={rows} groups={officialGroups.map((group) => ({ slug: group.slug, name: group.name }))} />
    </main>
  );
}
