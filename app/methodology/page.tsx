import { SiteNav } from "@/components/site-nav";

export default function MethodologyPage() {
  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">METHODOLOGY</p><h1>How we measure</h1><p className="lead">KAWAII LAB. Stats のcanonical account、日次観測、欠測、比較可能性、集計指標のルール。</p></div><span className="badge">UNOFFICIAL · AUDITABLE</span></header>

      <section className="panel"><p className="eyebrow">DATA MODEL</p><h2>Identity → Observation → Derived metrics</h2><p className="lead">誰のどのSNSを追うかというcanonical directoryと、日々変化する観測値を分離します。表示用のScale / Growth / Activityはraw snapshotから再計算できる派生値です。</p></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">CADENCE</p><h2>実際の開始時刻が0時台のrunだけ採用</h2><p className="lead">GitHub Actionsのscheduled runは数時間遅れる場合があるため、毎時07/27/47分に軽いgateを起動します。プロフィール取得を許可するのは、runが実際に00:00〜01:30 JSTに開始した場合だけです。窓外runは正常なno-opになり、完了済みsnapshotがあれば取得前に終了します。遅れて取得した値を日次系列へ後付けしません。</p></article><article className="panel"><p className="eyebrow">SOURCE</p><h2>公開プロフィール値</h2><p className="lead">X / Instagram / TikTokは公開プロフィール由来のprovider値、YouTubeは公開Aboutページの信頼済みparserからsubscribers / videos / total channel viewsを取得します。source type・capture time・parser versionを保存します。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">MISSING DATA</p><h2>欠測 ≠ 0</h2><p className="lead">取得失敗・login wall・parser除外・有効時刻窓に観測できなかった日を0に置換しません。現在値が部分観測の場合はcoverageを併記し、完全な時系列では欠測点をnullとして線を接続しません。</p></article><article className="panel"><p className="eyebrow">COMPARABILITY</p><h2>実日付差とアカウント集合を両方確認</h2><p className="lead">1-day / 7-day / 30-day Growthは、実際の日付差が1/7/30日ちょうどで、両端が完全観測、かつ同じcanonical account集合である場合だけ計算します。欠測日をまたぐ差分やSNS新設・handle移行・directory変更の段差を「成長」と誤認しません。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">SCALE</p><h2>Audienceは単純合計</h2><p className="lead">X / Instagram / TikTok followersとYouTube subscribersのアカウント値を合計します。SNS横断で同じ実人数をdeduplicateした値ではありません。媒体構成は同じ合計を4SNSに分解したものです。</p></article><article className="panel"><p className="eyebrow">ACTIVITY</p><h2>TikTok likes / YouTube views</h2><p className="lead">TikTok profile total likesとYouTube lifetime channel viewsはAudienceとは別系列です。現在の累積規模に加え、比較可能な連続観測から日次増加を計算できます。</p></article></section>

      <section className="panel"><p className="eyebrow">AGGREGATION</p><h2>Primary groupとunitを混同しない</h2><p className="lead">primary groupはgroup official + canonical membersをecosystemとして比較します。PiKiなどの兼任unitでは同じ個人SNSを二重所有させずrelationとして保持するため、primary groupのecosystem rankingとは別カテゴリで表示します。trainee unitも同様に別カテゴリです。</p></section>

      <section className="panel"><p className="eyebrow">MOMENTUM · PLANNED</p><h2>勢いはversioned modelとして追加</h2><p className="lead">十分な履歴が蓄積した後、7日速度・成長率・加速度・Activity変化をロバストに正規化して統合します。式・必要履歴・versionを公開し、過去値を同じ式で再計算できる形にします。</p></section>

      <section className="notice">SNS横断のfollowers/subscribers合計は「ユニークなファン人数」ではありません。ランキングやGrowthは、定義・coverage・canonical account集合が比較可能な範囲で読む必要があります。</section>
      <footer>Methodology can evolve, but raw source metadata, capture timestamps, parser versions and formula versions should remain auditable.</footer>
    </main>
  );
}
