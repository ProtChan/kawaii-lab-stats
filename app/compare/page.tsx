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
          <p className="lead">現在値と1日増減を切り替えながら、グループ・メンバー・指標を横断比較。グラフ系列はその場で表示 / 非表示を切り替えられます。</p>
        </div>
        <span className="badge">SHAREABLE STATE</span>
      </header>
      <CompareExplorer groups={payload.groups} members={payload.members} />
      <footer>比較URLは scope / metric / view / group / selected をquery parameterとして保持します。日次増減は前日・当日の両方で必要な観測が揃った場合だけ算出し、欠測値は0に置換しません。</footer>
    </main>
  );
}
