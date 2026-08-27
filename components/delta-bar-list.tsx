import Link from "next/link";

export type DeltaBarItem = {
  href: string;
  labelHref?: string;
  label: string;
  sub?: string;
  value: number | null;
};

const fmt = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${new Intl.NumberFormat("ja-JP").format(value)}`;

export function DeltaBarList({ items }: { items: DeltaBarItem[] }) {
  const maxAbs = Math.max(0, ...items.map((item) => Math.abs(item.value ?? 0)));

  return (
    <div className="barRankList">
      {items.map((item, index) => {
        const width = item.value != null && maxAbs > 0 ? (Math.abs(item.value) / maxAbs) * 50 : 0;
        const left = item.value != null && item.value < 0 ? 50 - width : 50;
        return (
          <div className="barRankRow" key={`${item.href}-${item.label}`}>
            <div className="barRankTop">
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong><Link className="entityNameLink" href={item.labelHref ?? item.href}>{item.label}</Link></strong>{item.sub ? <small>{item.sub}</small> : null}</div>
              <Link className="barValueLink" href={item.href} aria-label={`${item.label}の分析を開く`}><em className={item.value != null && item.value < 0 ? "deltaNegative" : "deltaPositive"}>{fmt(item.value)}</em></Link>
            </div>
            <Link className="deltaTrack" href={item.href} aria-label={`${item.label} 前日比 ${fmt(item.value)}`}>
              {item.value != null ? <i className={item.value < 0 ? "negative" : "positive"} style={{ width: `${width}%`, left: `${left}%` }} /> : null}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
