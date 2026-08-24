import Link from "next/link";

export type AudienceMix = {
  X: number;
  Instagram: number;
  TikTok: number;
  YouTube: number;
};

export type AudienceBarItem = {
  href: string;
  label: string;
  sub?: string;
  value: number;
  mix: AudienceMix;
};

const fmt = (value: number) => new Intl.NumberFormat("ja-JP").format(value);
const platforms = ["X", "Instagram", "TikTok", "YouTube"] as const;
const classNames: Record<(typeof platforms)[number], string> = {
  X: "isX",
  Instagram: "isInstagram",
  TikTok: "isTikTok",
  YouTube: "isYouTube",
};

export function AudienceBarList({ items, showLegend = true }: { items: AudienceBarItem[]; showLegend?: boolean }) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <div className="audienceBarBlock">
      {showLegend ? (
        <div className="platformLegend" aria-label="SNS color legend">
          {platforms.map((platform) => <span key={platform}><i className={classNames[platform]} />{platform}</span>)}
        </div>
      ) : null}
      <div className="audienceBarList">
        {items.map((item, index) => {
          const totalWidth = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <Link className="audienceBarRow" href={item.href} key={item.href}>
              <div className="audienceBarTop">
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div><strong>{item.label}</strong>{item.sub ? <small>{item.sub}</small> : null}</div>
                <em>{fmt(item.value)}</em>
              </div>
              <div className="audienceTrack">
                <div className="audienceTotal" style={{ width: `${totalWidth}%` }}>
                  {platforms.map((platform) => {
                    const value = item.mix[platform] ?? 0;
                    const width = item.value > 0 ? (value / item.value) * 100 : 0;
                    return width > 0 ? <i className={classNames[platform]} style={{ width: `${width}%` }} title={`${platform}: ${fmt(value)}`} key={platform} /> : null;
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
