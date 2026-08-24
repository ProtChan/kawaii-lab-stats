import latestJson from "@/data/live/latest.json";
import seriesJson from "@/data/live/series.json";
import { debutedGroups } from "@/lib/official-directory";

export type LiveAccount = {
  entitySlug: string;
  entityName: string;
  entityType: "PROJECT" | "GROUP" | "MEMBER";
  entityStatus?: string;
  groupSlug: string | null;
  groupName: string | null;
  platform: "X" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  handle: string;
  profileUrl: string;
  capturedAt: string;
  sourceType: string;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  likes?: number | null;
  views?: number | null;
  viewsPrecision?: string | null;
  verified?: boolean | null;
  audienceMetric?: "FOLLOWERS" | "SUBSCRIBERS";
  engagementMetric?: "TOTAL_LIKES" | "TOTAL_CHANNEL_VIEWS" | null;
  precision?: string;
  error?: string;
  detail?: string | null;
};

type Snapshot = {
  date: string | null;
  collectedAt: string | null;
  complete: boolean;
  attempted?: number;
  successful?: number;
  failed?: number;
  accounts: LiveAccount[];
  errors: string[];
};

type SeriesPoint = {
  date: string;
  collectedAt: string;
  groups: Record<
    string,
    {
      name: string;
      official: number;
      members: number;
      ecosystem: number;
      platforms: Record<"X" | "Instagram" | "TikTok" | "YouTube", number>;
      youtubeViews?: number | null;
      youtubeViewAccounts?: number;
      tiktokLikes?: number | null;
      tiktokLikeAccounts?: number;
      observedAccounts: number;
      expectedAccounts: number;
    }
  >;
};

export const liveSnapshot = latestJson as Snapshot;
export const liveSeries = seriesJson as SeriesPoint[];
export const hasLiveData = Boolean(liveSnapshot.complete && liveSnapshot.collectedAt && liveSnapshot.accounts.length);

const goodAccounts = liveSnapshot.accounts.filter(
  (account) => !account.error && typeof account.followers === "number" && Number.isFinite(account.followers),
);
const metricAccounts = liveSnapshot.accounts.filter((account) => !account.error);

const previousPoint = liveSeries.length >= 2 ? liveSeries[liveSeries.length - 2] : null;

function sumMetric(items: LiveAccount[], key: "followers" | "likes" | "views"): number | null {
  const values = items
    .map((account) => account[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function sumOptional(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length ? finite.reduce((total, value) => total + value, 0) : null;
}

export const liveGroupStats = debutedGroups.map((group) => {
  const all = liveSnapshot.accounts.filter((account) => account.groupSlug === group.slug);
  const good = goodAccounts.filter((account) => account.groupSlug === group.slug);
  const metrics = metricAccounts.filter((account) => account.groupSlug === group.slug);
  const official = good.filter((account) => account.entityType === "GROUP" && account.entitySlug === group.slug);
  const members = good.filter((account) => account.entityType === "MEMBER");
  const sumFollowers = (items: LiveAccount[]) => items.reduce((total, account) => total + (account.followers ?? 0), 0);
  const platforms = { X: 0, Instagram: 0, TikTok: 0, YouTube: 0 };

  for (const account of good) {
    const platform = account.platform === "INSTAGRAM" ? "Instagram" : account.platform === "TIKTOK" ? "TikTok" : account.platform === "YOUTUBE" ? "YouTube" : "X";
    platforms[platform] += account.followers ?? 0;
  }

  const ecosystem = sumFollowers(good);
  const previous = previousPoint?.groups[group.slug]?.ecosystem ?? null;
  const dailyGain = previous == null ? null : ecosystem - previous;
  const youtubeRows = metrics.filter((account) => account.platform === "YOUTUBE");
  const tiktokRows = metrics.filter((account) => account.platform === "TIKTOK");

  return {
    slug: group.slug,
    name: group.name,
    officialFollowers: sumFollowers(official),
    memberFollowers: sumFollowers(members),
    ecosystemFollowers: ecosystem,
    platforms,
    youtubeViews: sumMetric(youtubeRows, "views"),
    youtubeViewAccounts: youtubeRows.filter((account) => typeof account.views === "number" && Number.isFinite(account.views)).length,
    tiktokLikes: sumMetric(tiktokRows, "likes"),
    tiktokLikeAccounts: tiktokRows.filter((account) => typeof account.likes === "number" && Number.isFinite(account.likes)).length,
    observedAccounts: good.length,
    expectedAccounts: all.length,
    dailyGain,
    dailyGrowthRate: previous && previous > 0 && dailyGain != null ? (dailyGain / previous) * 100 : null,
  };
});

export const liveTimeline = liveSeries.map((point) => {
  const row: Record<string, string | number> = { date: point.date.slice(5) };
  for (const group of debutedGroups) row[group.name] = point.groups[group.slug]?.ecosystem ?? 0;
  return row;
});

export const liveSummary = {
  date: liveSnapshot.date,
  collectedAt: liveSnapshot.collectedAt,
  attempted: liveSnapshot.attempted ?? liveSnapshot.accounts.length,
  successful: liveSnapshot.successful ?? goodAccounts.length,
  failed: liveSnapshot.failed ?? liveSnapshot.accounts.filter((account) => account.error).length,
  observedAudience: liveGroupStats.reduce((sum, group) => sum + group.ecosystemFollowers, 0),
  youtubeViews: sumOptional(liveGroupStats.map((group) => group.youtubeViews)),
  tiktokLikes: sumOptional(liveGroupStats.map((group) => group.tiktokLikes)),
};
