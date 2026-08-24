import Link from "next/link";
import { directorySummary, officialGroups, officialProject } from "@/lib/official-directory";

const label = (platform: string) =>
  platform === "INSTAGRAM" ? "Instagram" : platform === "YOUTUBE" ? "YouTube" : platform === "TIKTOK" ? "TikTok" : platform;

const categoryLabel = (category: string) =>
  category === "DEBUTED" ? "PRIMARY GROUP" : category === "SPECIAL_UNIT" ? "SPECIAL UNIT" : category === "TRAINEE" ? "TRAINEE UNIT" : category;

export default function DirectoryPage() {
  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">VERIFIED DIRECTORY</p>
          <h1>Official accounts</h1>
          <p className="lead">
            公式プロフィール・公式サイト等を一次ソースに、追跡対象となるグループ・兼任ユニット・メンバー・SNSアカウントを固定した台帳です。
          </p>
        </div>
        <span className="badge">VERIFIED 2026-08-24</span>
      </header>

      <nav className="nav">
        <Link href="/">Demo dashboard</Link>
        <a href={officialProject.sourceUrl} target="_blank" rel="noreferrer">KAWAII LAB. source</a>
      </nav>

      <section className="kpis">
        <article><span>Groups / units tracked</span><strong>{directorySummary.groups}</strong></article>
        <article><span>Unique members tracked</span><strong>{directorySummary.members}</strong></article>
        <article><span>Canonical official accounts</span><strong>{directorySummary.accounts}</strong></article>
      </section>

      <section className="notice">
        This page contains account mappings and current activity state, not follower-count measurements. Statistics are stored separately as timestamped snapshots. PiKi members remain attached to their primary groups and are additionally linked as a UNIT membership.
      </section>

      <section className="directoryGrid">
        {officialGroups.map((group) => (
          <article className="directoryCard" key={group.slug}>
            <h2>{group.name}</h2>
            <div className="directoryMeta">{categoryLabel(group.category)} · {group.members.length} member links</div>
            <div className="accountLinks">
              {group.accounts.map((account) => (
                <a key={`${account.platform}-${account.handle}`} href={account.url} target="_blank" rel="noreferrer">
                  {label(account.platform)} @{account.handle.replace(/^@/, "")}
                </a>
              ))}
            </div>
            <div className="memberList">
              {group.members.map((member) => (
                <div className="memberRow" key={member.slug}>
                  <strong>{member.name}{member.status === "HIATUS" ? " · HIATUS" : member.relationOnly ? " · UNIT MEMBER" : ""}</strong>
                  {member.notes ? <small>{member.notes}</small> : null}
                  {member.status === "HIATUS" && member.statusSourceUrl ? (
                    <small><a href={member.statusSourceUrl} target="_blank" rel="noreferrer">Official hiatus notice</a></small>
                  ) : null}
                  <div className="accountLinks">
                    {member.accounts.map((account) => (
                      <a key={`${account.platform}-${account.handle}`} href={account.url} target="_blank" rel="noreferrer">
                        {label(account.platform)}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <footer>
        Account mappings are dated and source-attributed. Current seed includes the five primary KAWAII LAB. groups, PiKi as a concurrent special unit, KAWAII LAB. MATES and KAWAII LAB. SOUTH. Unknown or conflicting links are left unresolved rather than guessed.
      </footer>
    </main>
  );
}
