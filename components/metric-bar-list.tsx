import Link from "next/link";

export type MetricBarItem = {
  href: string;
  label: string;
  sub?: string;
  value: number | null;
  valueLabel?: string;
};

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);

export function MetricBarList({ items }: { items: MetricBarItem[] }) {
  const max = Math.max(0, ...items.map((item) => item.value ?? 0));

  return (
    <div className="barRankList">
      {items.map((item, index) => {
        const ratio = item.value != null && max > 0 ? Math.max(2, (item.value / max) * 100) : 0;
        return (
          <Link href={item.href} className="barRankRow" key={`${item.href}-${item.label}`}>
            <div className="barRankTop">
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div><strong>{item.label}</strong>{item.sub ? <small>{item.sub}</small> : null}</div>
              <em>{item.valueLabel ?? fmt(item.value)}</em>
            </div>
            <div className="barTrack" aria-hidden="true"><i style={{ width: `${ratio}%` }} /></div>
          </Link>
        );
      })}
    </div>
  );
}
