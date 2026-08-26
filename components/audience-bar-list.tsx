import Link from "next/link";

export type AudienceMix = {
  X: number | null;
  Instagram: number | null;
  TikTok: number | null;
  YouTube: number | null;
};

export type AudienceBarItem = {
  href: string;
  label: string;
  sub?: string;
  value: number | null;
  mix: AudienceMix;
};

const fmt = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("ja-JP").format(value);
const platforms = ["X", "Instagram", "TikTok", "YouTube"] as const;
const classNames: Record<(typeof platforms)[number], string> = {
  X: "isX",
  Instagram: "isInstagram",
  TikTok: "isTikTok",
  YouTube: "isYouTube",
};

export function AudienceBarList({ items, showLegend = true }: { items: AudienceBarItem[]; showLegend?: boolean }) {
  const values = items.map((item) => item.value).filter((value): value is number => value != null);
  const max = Math.max(0, ...values);

  return (
    <div className="audienceBarBlock">
      {showLegend ? (
        <div className="platformLegend" aria-label="SNS color legend">
          {platforms.map((platform) => <span key={platform}><i className={classNames[platform]} />{platform}</span>)}
        </div>
      ) : null}
      <div className="audienceBarList">
        {items.map((item, index) => {
          const totalWidth = item.value != null && max > 0 ? (item.value / max) * 100 : 0;
          const knownMix = platforms.reduce((sum, platform) => sum + (item.mix[platform] ?? 0), 0);
          return (
            <Link className={`audienceBarRow ${item.value == null ? "isMissing" : ""}`} href={item.href} key={item.href}>
              <div className="audienceBarTop">
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div><strong>{item.label}</strong>{item.sub ? <small>{item.sub}</small> : null}</div>
                <em>{fmt(item.value)}</em>
              </div>
              <div className="audienceTrack">
                <div className="audienceTotal" style={{ width: `${totalWidth}%` }}>
                  {platforms.map((platform) => {
                    const value = item.mix[platform];
                    const width = value != null && knownMix > 0 ? (value / knownMix) * 100 : 0;
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
