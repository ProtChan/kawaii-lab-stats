import { SiteNav } from "@/components/site-nav";

export default function MethodologyPage() {
  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">METHODOLOGY</p><h1>How we measure</h1><p className="lead">KAWAII LAB. Stats のcanonical account、日次観測、欠測、比較可能性、集計指標のルール。</p></div><span className="badge">UNOFFICIAL · AUDITABLE</span></header>

      <section className="panel"><p className="eyebrow">DATA MODEL</p><h2>Identity → Observation → Derived metrics</h2><p className="lead">誰のどのSNSを追うかというcanonical directoryと、日々変化する観測値を分離します。表示用のScale / Growth / Activityはraw snapshotから再計算できる派生値です。</p></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">CADENCE</p><h2>取得成功を最優先 · JST日付ごとに1回</h2><p className="lead">GitHub Actionsを5分ごとに起動します。JST日付ごとの初回はcanonical accountを取得し、その後は失敗・補完中の行だけをSNS別バックオフ付きで再試行します。実測済み行は保持するため、1件の失敗で全件を取り直しません。</p></article><article className="panel"><p className="eyebrow">SOURCE</p><h2>公開プロフィール値</h2><p className="lead">X / Instagram / TikTokはまず公開プロフィールproviderを使い、失敗時はSNS別の独立経路へ切り替えます。Instagramは匿名Web・公開ミラーに加え、REFETCHER_API_KEY設定時は専用profile APIを最終実測経路として使います。YouTubeは公開Aboutページの信頼済みparserです。すべてsource typeとcapture timeを保存します。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">MISSING DATA</p><h2>欠測 ≠ 0</h2><p className="lead">取得失敗・login wall・parser除外は0に置換しません。直近実測や公開ミラーで補完できる場合はimputed=trueとして絶対値/INDEXの連続表示にだけ利用し、実測と明確に分離します。取得可能になれば後続Actionが実測値へ自動置換します。</p></article><article className="panel"><p className="eyebrow">COMPARABILITY</p><h2>実日付差とアカウント集合を両方確認</h2><p className="lead">1-day / 7-day / 30-day Growthは実際の日付差が1/7/30日ちょうどの2点を選び、両端で実測できた同一アカウントの交差集合だけで計算します。補完値・片側だけの新規アカウント・handle移行は差分から除外するため、Instagram障害やdirectory追加が他SNSのGrowthまで消すことはありません。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">SCALE</p><h2>Audienceは単純合計</h2><p className="lead">X / Instagram / TikTok followersとYouTube subscribersのアカウント値を合計します。SNS横断で同じ実人数をdeduplicateした値ではありません。媒体構成は同じ合計を4SNSに分解したものです。</p></article><article className="panel"><p className="eyebrow">ACTIVITY</p><h2>TikTok likes / YouTube views</h2><p className="lead">TikTok profile total likesとYouTube lifetime channel viewsはAudienceとは別系列です。現在の累積規模に加え、比較可能な連続観測から日次増加を計算できます。</p></article></section>

      <section className="panel"><p className="eyebrow">AGGREGATION</p><h2>Primary groupとunitを混同しない</h2><p className="lead">primary groupはgroup official + canonical membersをecosystemとして比較します。PiKiなどの兼任unitでは同じ個人SNSを二重所有させずrelationとして保持するため、primary groupのecosystem rankingとは別カテゴリで表示します。trainee unitも同様に別カテゴリです。</p></section>

      <section className="panel"><p className="eyebrow">MOMENTUM · PLANNED</p><h2>勢いはversioned modelとして追加</h2><p className="lead">十分な履歴が蓄積した後、7日速度・成長率・加速度・Activity変化をロバストに正規化して統合します。式・必要履歴・versionを公開し、過去値を同じ式で再計算できる形にします。</p></section>

      <section className="notice">SNS横断のfollowers/subscribers合計は「ユニークなファン人数」ではありません。ランキングやGrowthは、定義・coverage・canonical account集合が比較可能な範囲で読む必要があります。</section>
      <footer>Methodology can evolve, but raw source metadata, capture timestamps, parser versions and formula versions should remain auditable.</footer>
    </main>
  );
}
