import { SiteNav } from "@/components/site-nav";

export default function MethodologyPage() {
  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">METHODOLOGY</p><h1>How we measure</h1><p className="lead">KAWAII LAB. Stats のcanonical account、日次観測、欠測、比較可能性、集計指標のルール。</p></div><span className="badge">UNOFFICIAL · AUDITABLE</span></header>

      <section className="panel"><p className="eyebrow">DATA MODEL</p><h2>Identity → Observation → Derived metrics</h2><p className="lead">誰のどのSNSを追うかというcanonical directoryと、日々変化する観測値を分離します。表示用のScale / Growth / Activityはraw snapshotから再計算できる派生値です。</p></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">CADENCE</p><h2>JST日付ごとに最大1回</h2><p className="lead">名目00:00 JST、保険として00:30 JSTにもworkflowを起動します。ただし完了済みsnapshotがある場合はプロフィール取得前に終了するため、同じJST日付で2回観測しません。</p></article><article className="panel"><p className="eyebrow">SOURCE</p><h2>公開プロフィール値</h2><p className="lead">X / Instagram / TikTokは公開プロフィール由来のprovider値、YouTubeは公開Aboutページの信頼済みparserからsubscribers / videos / total channel viewsを取得します。source type・capture time・parser versionを保存します。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">MISSING DATA</p><h2>欠測 ≠ 0</h2><p className="lead">取得失敗・login wall・parser除外は0に置換しません。現在値が部分観測の場合はcoverageを併記し、完全な時系列では欠測点をnullとして線を接続しません。</p></article><article className="panel"><p className="eyebrow">COMPARABILITY</p><h2>アカウント集合が変わった日は差分にしない</h2><p className="lead">1-day / 7-day / 30-day Growthは両端が完全観測で、かつ同じcanonical account集合である場合だけ計算します。SNS新設・handle移行・directory変更による段差を「成長」と誤認しないためです。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">SCALE</p><h2>Audienceは単純合計</h2><p className="lead">X / Instagram / TikTok followersとYouTube subscribersのアカウント値を合計します。SNS横断で同じ実人数をdeduplicateした値ではありません。媒体構成は同じ合計を4SNSに分解したものです。</p></article><article className="panel"><p className="eyebrow">ACTIVITY</p><h2>TikTok likes / YouTube views</h2><p className="lead">TikTok profile total likesとYouTube lifetime channel viewsはAudienceとは別系列です。現在の累積規模に加え、比較可能な連続観測から日次増加を計算できます。</p></article></section>

      <section className="panel"><p className="eyebrow">AGGREGATION</p><h2>Primary groupとunitを混同しない</h2><p className="lead">primary groupはgroup official + canonical membersをecosystemとして比較します。PiKiなどの兼任unitでは同じ個人SNSを二重所有させずrelationとして保持するため、primary groupのecosystem rankingとは別カテゴリで表示します。trainee unitも同様に別カテゴリです。</p></section>

      <section className="panel"><p className="eyebrow">MOMENTUM · PLANNED</p><h2>勢いはversioned modelとして追加</h2><p className="lead">十分な履歴が蓄積した後、7日速度・成長率・加速度・Activity変化をロバストに正規化して統合します。式・必要履歴・versionを公開し、過去値を同じ式で再計算できる形にします。</p></section>

      <section className="notice">SNS横断のfollowers/subscribers合計は「ユニークなファン人数」ではありません。ランキングやGrowthは、定義・coverage・canonical account集合が比較可能な範囲で読む必要があります。</section>
      <footer>Methodology can evolve, but raw source metadata, capture timestamps, parser versions and formula versions should remain auditable.</footer>
    </main>
  );
}
