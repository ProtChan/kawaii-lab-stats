import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { currentMemberRanking } from "@/lib/analytics";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function MembersPage() {
  const ranking = currentMemberRanking();
  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div><p className="eyebrow">MEMBER DATABASE</p><h1>Members</h1><p className="lead">所属をまたいで個人SNSの現在規模と成長を一覧化。PiKiなど兼任関係も個人ページ側で統合して表示します。</p></div>
        <span className="badge">{ranking.length} unique members</span>
      </header>

      <section className="tablePanel">
        <div className="dataTable memberTable headerRow"><span>#</span><span>Member</span><span>Group</span><span>SNS total</span><span>Coverage</span></div>
        {ranking.map(({ member, stats }, index) => (
          <Link className="dataTable memberTable" href={`/members/${member.slug}`} key={member.slug}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span><strong>{member.name}</strong>{member.status === "HIATUS" ? <small className="statusTag">HIATUS</small> : null}</span>
            <span>{member.primaryGroup?.name ?? member.relations[0]?.name ?? "—"}</span>
            <strong>{fmt(stats.totalFollowers)}</strong>
            <span>{stats.observed}/{stats.expected}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
