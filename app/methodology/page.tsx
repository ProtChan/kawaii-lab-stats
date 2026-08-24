import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">METHODOLOGY</p>
          <h1>How we measure</h1>
          <p className="lead">KAWAII LAB. Stats の日次SNS観測・集計・欠測処理のルール。</p>
        </div>
        <span className="badge">UNOFFICIAL</span>
      </header>

      <nav className="nav">
        <Link href="/">Live dashboard</Link>
        <Link href="/directory">Official account directory</Link>
        <Link href="/demo">Placeholder demo</Link>
      </nav>

      <section className="panel">
        <p className="eyebrow">CADENCE</p>
        <h2>1アカウントにつき1日1回</h2>
        <p className="lead">JST日付ごとに各canonical SNSアカウントを1回だけ観測します。同日の完了済みsnapshotが存在する場合、再実行してもプロフィール取得前に終了します。取得不能だったアカウントも同日には再試行せず、その日は欠測として残します。</p>
      </section>

      <section className="grid2">
        <article className="panel">
          <p className="eyebrow">SOURCE</p>
          <h2>公開プロフィール値</h2>
          <p className="lead">X / Instagram / TikTok / YouTube の公開プロフィールURLを日次で読み取り、followers、YouTube subscribers、posts/videos、TikTok total likes等の公開値を保存します。取得元URLと取得時刻をraw JSONに保持します。</p>
        </article>
        <article className="panel">
          <p className="eyebrow">MISSING DATA</p>
          <h2>欠測 ≠ 0</h2>
          <p className="lead">ログイン壁、非公開、削除、取得エラーなどは0として集計しません。coverageを併記し、観測できたアカウントだけの合計であることが分かるようにします。</p>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">AGGREGATION</p>
        <h2>公式・メンバー・ecosystem</h2>
        <p className="lead">group official はグループ公式SNSだけ、members は所属メンバーSNSの合計、ecosystem はその2つの合計です。媒体別にも X / Instagram / TikTok / YouTube を分けて表示します。</p>
      </section>

      <section className="notice">SNS横断のfollowers合計は「ユニークな人数」ではありません。同じ人が複数SNS・複数メンバーをフォローできるため、あくまでアカウントaudienceの単純合計です。</section>

      <section className="panel">
        <p className="eyebrow">PRECISION</p>
        <h2>公開表示以上の精度を作らない</h2>
        <p className="lead">YouTubeなどプラットフォーム側が公開値を丸めている場合、その丸められた値をそのまま保存します。推測で桁を補完しません。日次差も公開観測値同士の差として扱います。</p>
      </section>

      <footer>Fanmade / unofficial project. Methodology may evolve, but historical source/capture metadata should remain auditable.</footer>
    </main>
  );
}
