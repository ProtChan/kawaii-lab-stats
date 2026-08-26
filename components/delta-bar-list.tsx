import Link from "next/link";

export type DeltaBarItem = {
  href: string;
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
          <Link href={item.href} className="barRankRow" key={`${item.href}-${item.label}`}>
            <div className="barRankTop">
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong>{item.label}</strong>{item.sub ? <small>{item.sub}</small> : null}</div>
              <em className={item.value != null && item.value < 0 ? "deltaNegative" : "deltaPositive"}>{fmt(item.value)}</em>
            </div>
            <div className="deltaTrack" aria-label={`${item.label} 前日比 ${fmt(item.value)}`}>
              {item.value != null ? <i className={item.value < 0 ? "negative" : "positive"} style={{ width: `${width}%`, left: `${left}%` }} /> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
