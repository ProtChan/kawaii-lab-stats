import Link from "next/link";
import { GrowthChart } from "@/components/growth-chart";
import { directorySummary } from "@/lib/official-directory";
import { hasLiveData, liveGroupStats, liveSummary, liveTimeline } from "@/lib/live-stats";

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);
const optionalFmt = (value: number | null) => value == null ? "—" : fmt(value);
const signed = (value: number | null) => value == null ? "—" : `${value >= 0 ? "+" : ""}${fmt(value)}`;

export default function Home() {
  if (!hasLiveData) {
    return (
      <main>
        <header className="hero">
          <div>
            <p className="eyebrow">FANMADE ANALYTICS · LIVE</p>
            <h1>KAWAII LAB. Stats</h1>
            <p className="lead">公式・メンバーの公開SNSプロフィールを1日1回観測し、日次履歴として公開する非公式データサイト。</p>
          </div>
          <span className="badge">FIRST COLLECTION PENDING</span>
        </header>

        <nav className="nav">
          <Link href="/demo">Placeholder demo</Link>
          <Link href="/directory">Verified official accounts ({directorySummary.accounts})</Link>
        </nav>

        <section className="notice">初回の日次収集を待っています。取得完了後、このトップページは実測値へ自動的に切り替わります。</section>
        <section className="kpis">
          <article><span>Canonical accounts</span><strong>{directorySummary.accounts}</strong></article>
          <article><span>Unique members</span><strong>{directorySummary.members}</strong></article>
          <article><span>Daily frequency</span><strong>1×</strong></article>
        </section>

        <section className="panel">
          <p className="eyebrow">DATA PIPELINE</p>
          <h2>Daily public-profile snapshot</h2>
          <p className="lead">同じJST日付の収集済みファイルが存在する場合はネットワークアクセス自体をスキップし、同一アカウントを同日に再取得しません。</p>
        </section>

        <footer>Fanmade / unofficial project. Not affiliated with KAWAII LAB. or its management.</footer>
      </main>
    );
  }

  const ranked = [...liveGroupStats].sort((a, b) => b.ecosystemFollowers - a.ecosystemFollowers);
  const growthRanked = [...liveGroupStats].sort((a, b) => (b.dailyGain ?? -Infinity) - (a.dailyGain ?? -Infinity));
  const collectedAt = liveSummary.collectedAt
    ? new Date(liveSummary.collectedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">FANMADE ANALYTICS · LIVE</p>
          <h1>KAWAII LAB. Stats</h1>
          <p className="lead">KAWAII LAB.各グループ・メンバーの公開SNS規模を、毎日1回の同条件観測で比較します。</p>
        </div>
        <span className="badge">UPDATED {liveSummary.date}</span>
      </header>

      <nav className="nav">
        <Link href="/demo">Placeholder demo</Link>
        <Link href="/directory">Official accounts ({directorySummary.accounts})</Link>
        <Link href="/methodology">Methodology</Link>
        <a href="data/latest.json">Raw latest JSON</a>
      </nav>

      <section className="notice">最終取得: {collectedAt} JST · 成功 {liveSummary.successful}/{liveSummary.attempted} · 取得不能は0として扱わず欠測のまま保持します。</section>

      <section className="kpis">
        <article><span>Observed account-sum audience</span><strong>{fmt(liveSummary.observedAudience)}</strong></article>
        <article><span>Successful profiles</span><strong>{liveSummary.successful}/{liveSummary.attempted}</strong></article>
        <article><span>Unavailable today</span><strong>{liveSummary.failed}</strong></article>
      </section>

      <section className="grid2">
        <article className="panel">
          <p className="eyebrow">YOUTUBE REACH</p>
          <h2>{liveSummary.youtubeViews == null ? "次回取得から計測" : fmt(liveSummary.youtubeViews)}</h2>
          <p className="lead">追跡対象YouTubeチャンネルの公開「総再生回数」合計。登録者数と同じ日次観測で保存します。</p>
        </article>
        <article className="panel">
          <p className="eyebrow">TIKTOK ENGAGEMENT</p>
          <h2>{optionalFmt(liveSummary.tiktokLikes)}</h2>
          <p className="lead">追跡対象TikTokプロフィールの公開「総いいね」合計。これは動画単体いいねではなくプロフィール累計値です。</p>
        </article>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div><p className="eyebrow">DAILY TREND</p><h2>グループ別 SNS合計推移</h2></div>
          <span>{liveTimeline.length} daily snapshots</span>
        </div>
        {liveTimeline.length >= 2 ? (
          <>
            <GrowthChart data={liveTimeline} groups={liveGroupStats.map((group) => group.name)} xKey="date" />
            <div className="legend">{liveGroupStats.map((group, index) => <span key={group.slug}><i style={{ background: `var(--chart-${(index % 5) + 1})` }} />{group.name}</span>)}</div>
          </>
        ) : (
          <p className="lead">初回スナップショットを取得済みです。2日目の取得後から時系列グラフを表示します。</p>
        )}
      </section>

      <section className="grid2">
        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">CURRENT SCALE</p><h2>現在SNS規模</h2></div></div>
          <div className="ranking">
            {ranked.map((group, index) => (
              <div className="rankRow" key={group.slug}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div>
                  <strong>{group.name}</strong>
                  <small>公式 {fmt(group.officialFollowers)} · メンバー {fmt(group.memberFollowers)} · coverage {group.observedAccounts}/{group.expectedAccounts}</small>
                </div>
                <em>{fmt(group.ecosystemFollowers)}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="sectionHead"><div><p className="eyebrow">DAILY GROWTH</p><h2>前日増加数</h2></div></div>
          <div className="ranking">
            {growthRanked.map((group, index) => (
              <div className="rankRow" key={group.slug}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.dailyGrowthRate == null ? "2日目から算出" : `${group.dailyGrowthRate >= 0 ? "+" : ""}${group.dailyGrowthRate.toFixed(3)}% / day`}</small>
                </div>
                <em>{signed(group.dailyGain)}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><p className="eyebrow">PLATFORM MIX</p><h2>媒体別アカウント合計</h2></div></div>
        {liveGroupStats.map((group) => (
          <div className="platformGroup" key={group.slug}>
            <strong>{group.name}</strong>
            <div>{Object.entries(group.platforms).map(([platform, value]) => <span key={platform}>{platform}<b>{fmt(value)}</b></span>)}</div>
            <small>YouTube 総再生 {optionalFmt(group.youtubeViews)} · TikTok 総いいね {optionalFmt(group.tiktokLikes)}</small>
          </div>
        ))}
      </section>

      <footer>
        Fanmade / unofficial. Counts are public-profile observations, not deduplicated unique people. Group official accounts and member accounts are shown separately and may share followers. Source and capture time are retained in the public JSON.
      </footer>
    </main>
  );
}
