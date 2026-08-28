"use client";

import { useEffect, useState } from "react";

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function SnapshotFreshness({ snapshotDate }: { snapshotDate: string | null }) {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setToday(todayJst());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!today || snapshotDate === today) return null;

  return (
    <div className="snapshotFreshness" role="status">
      <strong>TODAY&apos;S SNAPSHOT MISSING</strong>
      <span>JST {today} · latest valid snapshot {snapshotDate ?? "none"}. Late observations are not backfilled into the 24-hour series.</span>
    </div>
  );
}
