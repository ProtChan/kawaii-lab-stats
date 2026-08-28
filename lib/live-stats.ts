import latestJson from "@/data/live/latest.json";
import seriesJson from "@/data/live/series.json";
import { debutedGroups } from "@/lib/official-directory";
import { aggregateAccounts, exactDayInterval, TRUSTED_YOUTUBE_PARSER, trustedMetricAccount, type PlatformLabel } from "@/lib/metrics";

export { TRUSTED_YOUTUBE_PARSER };

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
  parserVersion?: string | null;
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

export type Snapshot = {
  date: string | null;
  collectedAt: string | null;
  complete: boolean;
  attempted?: number;
  successful?: number;
  failed?: number;
  accounts: LiveAccount[];
  errors: string[];
};

type SeriesGroup = {
  name: string;
  official: number;
  members: number;
  ecosystem: number;
  platforms: Record<PlatformLabel, number>;
  youtubeViews?: number | null;
  youtubeViewAccounts?: number;
  tiktokLikes?: number | null;
  tiktokLikeAccounts?: number;
  observedAccounts: number;
  expectedAccounts: number;
};

type SeriesPoint = {
  date: string;
  collectedAt: string;
  groups: Record<string, SeriesGroup>;
};

export const liveSnapshot = latestJson as Snapshot;
export const liveSeries = seriesJson as SeriesPoint[];
export const hasLiveData = Boolean(liveSnapshot.complete && liveSnapshot.collectedAt && liveSnapshot.accounts.length);
export const trustedAccount = (account: LiveAccount) => trustedMetricAccount(account);

const attemptedAccounts = liveSnapshot.attempted ?? liveSnapshot.accounts.length;
const trustedObservedAccounts = liveSnapshot.accounts.filter(
  (account) => trustedAccount(account) && !account.error && typeof account.followers === "number" && Number.isFinite(account.followers),
);
const latestSeriesDate = liveSeries.at(-1)?.date ?? liveSnapshot.date;
const previousPoint = latestSeriesDate
  ? [...liveSeries].reverse().find((point) => point.date !== latestSeriesDate && exactDayInterval(point.date, latestSeriesDate, 1)) ?? null
  : null;

export const liveGroupStats = debutedGroups.map((group) => {
  const all = liveSnapshot.accounts.filter((account) => account.groupSlug === group.slug);
  const officialRows = all.filter((account) => account.entityType === "GROUP" && account.entitySlug === group.slug);
  const memberRows = all.filter((account) => account.entityType === "MEMBER");
  const aggregate = aggregateAccounts(all);
  const official = aggregateAccounts(officialRows);
  const members = aggregateAccounts(memberRows);
  const previous = previousPoint?.groups[group.slug] ?? null;
  const previousComplete = Boolean(previous && previous.observedAccounts === previous.expectedAccounts);
  const ecosystem = aggregate.audience.value;
  const dailyGain = aggregate.audience.complete && previousComplete && ecosystem != null ? ecosystem - previous!.ecosystem : null;

  return {
    slug: group.slug,
    name: group.name,
    officialFollowers: official.audience.value,
    memberFollowers: members.audience.value,
    ecosystemFollowers: ecosystem,
    platforms: Object.fromEntries(
      Object.entries(aggregate.platforms).map(([label, observation]) => [label, observation.value]),
    ) as Record<PlatformLabel, number | null>,
    platformCoverage: aggregate.platforms,
    youtubeViews: aggregate.youtubeViews.value,
    youtubeViewAccounts: aggregate.youtubeViews.observed,
    youtubeViewExpected: aggregate.youtubeViews.expected,
    tiktokLikes: aggregate.tiktokLikes.value,
    tiktokLikeAccounts: aggregate.tiktokLikes.observed,
    tiktokLikeExpected: aggregate.tiktokLikes.expected,
    observedAccounts: aggregate.audience.observed,
    expectedAccounts: aggregate.audience.expected,
    complete: aggregate.audience.complete,
    dailyGain,
    dailyGrowthRate: previousComplete && previous!.ecosystem > 0 && dailyGain != null ? (dailyGain / previous!.ecosystem) * 100 : null,
  };
});

export const liveTimeline = liveSeries.map((point) => {
  const row: Record<string, string | number | null> = { date: point.date.slice(5) };
  for (const group of debutedGroups) {
    const item = point.groups[group.slug];
    row[group.name] = item && item.observedAccounts === item.expectedAccounts ? item.ecosystem : null;
  }
  return row;
});

const groupAudienceValues = liveGroupStats.map((group) => group.ecosystemFollowers).filter((value): value is number => value != null);
const youtubeValues = liveGroupStats.map((group) => group.youtubeViews).filter((value): value is number => value != null);
const tiktokValues = liveGroupStats.map((group) => group.tiktokLikes).filter((value): value is number => value != null);

export const liveSummary = {
  date: liveSnapshot.date,
  collectedAt: liveSnapshot.collectedAt,
  attempted: attemptedAccounts,
  successful: trustedObservedAccounts.length,
  failed: Math.max(0, attemptedAccounts - trustedObservedAccounts.length),
  observedAudience: groupAudienceValues.length ? groupAudienceValues.reduce((sum, value) => sum + value, 0) : null,
  youtubeViews: youtubeValues.length ? youtubeValues.reduce((sum, value) => sum + value, 0) : null,
  tiktokLikes: tiktokValues.length ? tiktokValues.reduce((sum, value) => sum + value, 0) : null,
};
