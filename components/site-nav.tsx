"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/site-nav.module.css";

const primaryItems = [
  ["Overview", "/"],
  ["Rankings", "/rankings"],
  ["Compare", "/compare"],
  ["Groups", "/groups"],
  ["Members", "/members"],
] as const;

const dataItems = [
  ["Observations", "/observations"],
  ["Coverage", "/coverage"],
  ["Directory", "/directory"],
  ["Methodology", "/methodology"],
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const dataActive = dataItems.some(([, href]) => active(href));

  return (
    <nav className={`siteNav ${styles.navRoot}`} aria-label="Primary navigation">
      <Link className="siteBrand" href="/" aria-label="KAWAII LAB Stats home"><span className="brandMark">KL</span><b>STATS</b></Link>
      <div className={`siteNavLinks ${styles.navLinks}`}>
        {primaryItems.map(([label, href]) => <Link className={active(href) ? "active" : ""} href={href} key={href}>{label}</Link>)}
        <details className={`${styles.dataMenu} ${dataActive ? styles.dataMenuActive : ""}`}>
          <summary>Data</summary>
          <div className={styles.menu}>
            {dataItems.map(([label, href]) => <Link className={active(href) ? styles.active : ""} href={href} key={href}>{label}</Link>)}
          </div>
        </details>
      </div>
    </nav>
  );
}
