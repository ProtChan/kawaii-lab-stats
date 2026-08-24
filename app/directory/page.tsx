import Link from "next/link";
import { directorySummary, officialGroups, officialProject } from "@/lib/official-directory";

const label = (platform: string) =>
  platform === "INSTAGRAM" ? "Instagram" : platform === "YOUTUBE" ? "YouTube" : platform === "TIKTOK" ? "TikTok" : platform;

export default function DirectoryPage() {
  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">VERIFIED DIRECTORY</p>
          <h1>Official accounts</h1>
          <p className="lead">
            KAWAII LAB.公式プロフィールを一次ソースに、追跡対象となるグループ・メンバー・SNSアカウントを固定した台帳です。
          </p>
        </div>
        <span className="badge">VERIFIED 2026-08-24</span>
      </header>

      <nav className="nav">
        <Link href="/">Demo dashboard</Link>
        <a href={officialProject.sourceUrl} target="_blank" rel="noreferrer">Official source</a>
      </nav>

      <section className="kpis">
        <article><span>Groups / units tracked</span><strong>{directorySummary.groups}</strong></article>
        <article><span>Members tracked</span><strong>{directorySummary.members}</strong></article>
        <article><span>Official accounts mapped</span><strong>{directorySummary.accounts}</strong></article>
      </section>

      <section className="notice">
        This page contains verified account mappings, not follower-count measurements. Statistics are stored separately as timestamped snapshots.
      </section>

      <section className="directoryGrid">
        {officialGroups.map((group) => (
          <article className="directoryCard" key={group.slug}>
            <h2>{group.name}</h2>
            <div className="directoryMeta">{group.category} · {group.members.length} members</div>
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
                  <strong>{member.name}</strong>
                  {member.notes ? <small>{member.notes}</small> : null}
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
        Source of truth for this seed: KAWAII LAB. official profile. Account mappings are dated and should be re-verified when handles, membership, or official listings change.
      </footer>
    </main>
  );
}
