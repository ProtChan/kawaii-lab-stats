"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="siteNav" aria-label="Primary navigation">
      <Link className="siteBrand" href="/" aria-label="KAWAII LAB Stats home"><span className="brandMark">KL</span><b>STATS</b></Link>
      <div className="siteNavLinks">
        {items.map(([label, href]) => <Link className={active(href) ? "active" : ""} href={href} key={href}>{label}</Link>)}
      </div>
    </nav>
  );
}
