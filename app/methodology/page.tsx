import { SiteNav } from "@/components/site-nav";

export default function MethodologyPage() {
  return (
    <main>
      <SiteNav />
      <header className="pageHero"><div><p className="eyebrow">METHODOLOGY</p><h1>How we measure</h1><p className="lead">KAWAII LAB. Stats の日次SNS観測・集計・欠測処理・派生指標のルール。</p></div><span className="badge">UNOFFICIAL</span></header>

      <section className="panel"><p className="eyebrow">CADENCE</p><h2>1アカウントにつき1日1回</h2><p className="lead">JST日付ごとに各canonical SNSアカウントを1回だけ観測します。同日の完了済みsnapshotが存在する場合、再実行してもプロフィール取得前に終了します。取得不能だったアカウントも同日には再試行せず、その日は欠測として残します。</p></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">SOURCE</p><h2>公開プロフィール値</h2><p className="lead">X / Instagram / TikTok は公開プロフィールを1日1回読み取り、followers、following、posts、TikTok total likesなどを保存します。YouTubeは公開チャンネルのAboutページを1日1回読み取り、subscribers、videos、total channel viewsを同時に保存します。</p></article><article className="panel"><p className="eyebrow">MISSING DATA</p><h2>欠測 ≠ 0</h2><p className="lead">ログイン壁、非公開、削除、取得エラーなどは0として集計しません。coverageを併記し、観測できたアカウントだけの合計であることが分かるようにします。</p></article></section>

      <section className="grid2"><article className="panel"><p className="eyebrow">SCALE / GROWTH</p><h2>規模と伸びを分離</h2><p className="lead">Scaleはその日の公開audience合計。Growthは1D / 7D / 30Dの差分と成長率として履歴から計算します。現在値が大きいことと、今伸びていることを同じ指標にしません。</p></article><article className="panel"><p className="eyebrow">ACTIVITY</p><h2>YouTube総再生 / TikTok総いいね</h2><p className="lead">YouTube total views と TikTok profile total likes はフォロワーとは別系列で保存します。履歴が溜まれば日次増加をContent Activityとして扱います。</p></article></section>

      <section className="panel"><p className="eyebrow">MOMENTUM · PLANNED</p><h2>勢いは再現可能なモデルとして追加</h2><p className="lead">7日増加速度、成長率、加速度、コンテンツ消費の変化を正規化して統合する予定です。数式とversionを公開し、過去データを同じ式で再計算できる形にします。</p></section>

      <section className="panel"><p className="eyebrow">AGGREGATION</p><h2>公式・メンバー・ecosystem</h2><p className="lead">group official はグループ公式SNSだけ、members は所属メンバーSNSの合計、ecosystem はその2つの合計です。PiKiなどの兼任関係は全体比較で同じ個人SNSを二重加算しません。</p></section>

      <section className="notice">SNS横断のfollowers合計は「ユニークな人数」ではありません。同じ人が複数SNS・複数メンバーをフォローできるため、あくまでアカウントaudienceの単純合計です。</section>
      <footer>Methodology may evolve, but historical source / capture metadata and formula versions should remain auditable.</footer>
    </main>
  );
}
