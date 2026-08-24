import Link from "next/link";

const items = [
  ["Overview", "/"],
  ["Groups", "/groups"],
  ["Members", "/members"],
  ["Rankings", "/rankings"],
  ["Compare", "/compare"],
  ["Coverage", "/coverage"],
  ["Directory", "/directory"],
  ["Method", "/methodology"],
] as const;

export function SiteNav() {
  return (
    <nav className="siteNav" aria-label="Primary navigation">
      <Link className="siteBrand" href="/">KL<span>STATS</span></Link>
      <div className="siteNavLinks">
        {items.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </div>
    </nav>
  );
}
