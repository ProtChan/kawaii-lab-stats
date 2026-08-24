import type { Metadata } from "next";
import "./globals.css";
import "./visuals.css";

export const metadata: Metadata = {
  title: "KAWAII LAB. Stats",
  description: "Fanmade social media statistics dashboard for KAWAII LAB. artists and members.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
