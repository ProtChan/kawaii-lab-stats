import { CompareExplorer } from "@/components/compare-explorer";
import { SiteNav } from "@/components/site-nav";
import { buildComparePayload } from "@/lib/compare-data";

export default function ComparePage() {
  const payload = buildComparePayload();

  return (
    <main>
      <SiteNav />
      <header className="pageHero">
        <div>
          <p className="eyebrow">COMPARE LAB</p>
          <h1>Compare</h1>
          <p className="lead">合計オーディエンスに加え、X・Instagram・TikTokのフォロワー数、YouTube登録者数、TikTokいいね、YouTube再生回数をグループ・メンバー横断で比較。期間増分やINDEXにも切り替えられます。</p>
        </div>
        <span className="badge">SHAREABLE STATE</span>
      </header>
      <CompareExplorer groups={payload.groups} members={payload.members} />
      <footer>比較URLは scope / metric / view / group / selected をquery parameterとして保持します。期間増分は実日付差が一致する両端で、同じアカウントの実測値を突き合わせて算出し、欠測値は0に置換しません。</footer>
    </main>
  );
}
