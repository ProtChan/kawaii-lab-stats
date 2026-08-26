import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { directorySummary, officialGroups, officialProject } from "@/lib/official-directory";

const label = (platform: string) => platform === "INSTAGRAM" ? "Instagram" : platform === "YOUTUBE" ? "YouTube" : platform === "TIKTOK" ? "TikTok" : platform;
const categoryLabel = (category: string) => category === "DEBUTED" ? "PRIMARY GROUP" : category === "SPECIAL_UNIT" ? "SPECIAL UNIT" : category === "TRAINEE" ? "TRAINEE UNIT" : category;

export default function DirectoryPage() {
  const verifiedDates = [officialProject.verifiedAt, ...officialGroups.map((group) => group.verifiedAt)].filter(Boolean).sort();
  const latestVerified = verifiedDates.at(-1)?.slice(0, 10) ?? "—";

  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">CANONICAL DIRECTORY</p><h1>Official accounts</h1><p className="lead">公式プロフィール・公式サイト等を一次ソースに、分析対象となるentity・membership・SNSアカウントを固定するidentity layerです。</p></div><span className="badge">VERIFIED {latestVerified}</span></header>
      <section className="metricGrid"><article><span>Groups / units</span><strong>{directorySummary.groups}</strong></article><article><span>Unique members</span><strong>{directorySummary.members}</strong></article><article><span>Canonical accounts</span><strong>{directorySummary.accounts}</strong></article></section>
      <section className="notice">Account identity and membership only. Follower measurements are separate timestamped observations. <a href={officialProject.sourceUrl} target="_blank" rel="noreferrer">Primary KAWAII LAB. source ↗</a></section>
      <section className="directoryGrid">{officialGroups.map((group)=><article className="directoryCard" key={group.slug}><h2><Link href={`/groups/${group.slug}`}>{group.name}</Link></h2><div className="directoryMeta">{categoryLabel(group.category)} · {group.members.length} member relations · verified {group.verifiedAt.slice(0,10)}</div><div className="accountLinks">{group.accounts.map((account)=><a key={`${account.platform}-${account.handle}`} href={account.url} target="_blank" rel="noreferrer">{label(account.platform)} @{account.handle.replace(/^@/,"")}</a>)}</div><div className="memberList">{group.members.map((member)=><div className="memberRow" key={member.slug}><strong><Link href={`/members/${member.slug}`}>{member.name}</Link>{member.status === "HIATUS" ? " · HIATUS" : member.relationOnly ? " · UNIT MEMBER" : ""}</strong>{member.notes ? <small>{member.notes}</small> : null}{member.status === "HIATUS" && member.statusSourceUrl ? <small><a href={member.statusSourceUrl} target="_blank" rel="noreferrer">Official hiatus notice ↗</a></small> : null}<div className="accountLinks">{member.accounts.map((account)=><a key={`${account.platform}-${account.handle}`} href={account.url} target="_blank" rel="noreferrer">{label(account.platform)}</a>)}</div></div>)}</div></article>)}</section>
      <footer>Mappings are source-attributed and dated. Unknown or conflicting links remain unresolved rather than being silently guessed.</footer>
    </main>
  );
}
