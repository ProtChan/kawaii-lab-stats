import type { Metadata } from "next";
import { SnapshotFreshness } from "@/components/snapshot-freshness";
import { liveSummary } from "@/lib/live-stats";
import "./globals.css";
import "./visuals.css";
import "./explorer.css";
import "./entity-links.css";

export const metadata: Metadata = {
  title: {
    default: "KAWAII LAB. Stats",
    template: "%s · KAWAII LAB. Stats",
  },
  description: "KAWAII LAB.のグループ・メンバー公開SNSを日次観測し、規模・前日比・媒体別推移・コンテンツ指標を比較する非公式データサイト。",
  applicationName: "KAWAII LAB. Stats",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title: "KAWAII LAB. Stats",
    description: "公開SNSの日次観測から、Scale / Growth / Activityをグループ・個人単位で可視化。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <SnapshotFreshness snapshotDate={liveSummary.date} />
        {children}
      </body>
    </html>
  );
}
