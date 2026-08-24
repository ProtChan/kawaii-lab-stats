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
          <p className="lead">対象・指標・所属グループをURLに保持する比較画面。ランキングやグループ詳細から、選択済み状態へそのまま遷移できます。</p>
        </div>
        <span className="badge">SHAREABLE STATE</span>
      </header>
      <CompareExplorer groups={payload.groups} members={payload.members} />
      <footer>比較URLは scope / metric / group / selected をquery parameterとして保持します。欠測値は0に置換せず、時系列では線を接続しません。</footer>
    </main>
  );
}
