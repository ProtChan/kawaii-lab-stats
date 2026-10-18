import { officialGroups } from "@/lib/official-directory";
import { allMembers, getGroupStats, getMemberStats, historySnapshots } from "@/lib/analytics";
import { accountSetKey, aggregateAccounts, platformLabel, trustedMetricAccount, type PlatformLabel } from "@/lib/metrics";
import type { LiveAccount } from "@/lib/live-stats";

export type CompareMetricKey =
  | "audience"
  | "xFollowers"
  | "instagramFollowers"
  | "tiktokFollowers"
  | "youtubeSubscribers"
  | "tiktokLikes"
  | "youtubeViews";

export const compareMetricKeys: CompareMetricKey[] = [
  "audience",
  "xFollowers",
  "instagramFollowers",
  "tiktokFollowers",
  "youtubeSubscribers",
  "tiktokLikes",
  "youtubeViews",
];

export type PlatformAudience = Record<PlatformLabel, number | null>;

export type ComparePoint = {
  date: string;
  audience: number | null;
  xFollowers: number | null;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
  youtubeSubscribers: number | null;
  tiktokLikes: number | null;
  youtubeViews: number | null;
  complete: Record<CompareMetricKey, boolean>;
  usable: Record<CompareMetricKey, boolean>;
  accountSet: Record<CompareMetricKey, string>;
  observedValues: Record<CompareMetricKey, Record<string, number>>;
};

export type CompareEntity = {
  slug: string;
  name: string;
  type: "GROUP" | "MEMBER";
  groupSlugs: string[];
  primaryGroupName?: string | null;
  current: Omit<ComparePoint, "date" | "complete" | "usable" | "accountSet" | "observedValues">;
  platforms: PlatformAudience;
  history: ComparePoint[];
};

type MetricObservation = {
  value: number | null;
  observed: number;
  imputed: number;
  expected: number;
  complete: boolean;
};

function observationUsable(observation: MetricObservation) {
  return observation.value != null && observation.observed + observation.imputed === observation.expected;
}

function metricValue(account: LiveAccount, metric: CompareMetricKey): number | null | undefined {
  switch (metric) {
    case "audience":
      return account.followers;
    case "xFollowers":
      return account.platform === "X" ? account.followers : null;
    case "instagramFollowers":
      return account.platform === "INSTAGRAM" ? account.followers : null;
    case "tiktokFollowers":
      return account.platform === "TIKTOK" ? account.followers : null;
    case "youtubeSubscribers":
      return account.platform === "YOUTUBE" ? account.followers : null;
    case "tiktokLikes":
      return account.platform === "TIKTOK" ? account.likes : null;
    case "youtubeViews":
      return account.platform === "YOUTUBE" ? account.views : null;
  }
}

function observedMetricValues(rows: LiveAccount[], metric: CompareMetricKey) {
  return Object.fromEntries(
    rows
      .filter((account) => {
        if (!trustedMetricAccount(account) || account.error || account.imputed) return false;
        const value = metricValue(account, metric);
        return typeof value === "number" && Number.isFinite(value);
      })
      .map((account) => [
        `${account.platform}:${String(account.handle).toLowerCase()}`,
        metricValue(account, metric) as number,
      ]),
  );
}

function metricAccountSet(rows: LiveAccount[], metric: CompareMetricKey) {
  switch (metric) {
    case "audience":
      return accountSetKey(rows);
    case "xFollowers":
      return accountSetKey(rows, "X");
    case "instagramFollowers":
      return accountSetKey(rows, "Instagram");
    case "tiktokFollowers":
    case "tiktokLikes":
      return accountSetKey(rows, "TikTok");
    case "youtubeSubscribers":
    case "youtubeViews":
      return accountSetKey(rows, "YouTube");
  }
}

function metricsForRows(rows: LiveAccount[]) {
  const aggregate = aggregateAccounts(rows);
  const observations: Record<CompareMetricKey, MetricObservation> = {
    audience: aggregate.audience,
    xFollowers: aggregate.platforms.X,
    instagramFollowers: aggregate.platforms.Instagram,
    tiktokFollowers: aggregate.platforms.TikTok,
    youtubeSubscribers: aggregate.platforms.YouTube,
    tiktokLikes: aggregate.tiktokLikes,
    youtubeViews: aggregate.youtubeViews,
  };

  const values = Object.fromEntries(
    compareMetricKeys.map((metric) => {
      const observation = observations[metric];
      const usable = metric === "audience"
        ? observationUsable(observation)
        : observation.expected > 0 && observationUsable(observation);
      return [metric, usable ? observation.value : null];
    }),
  ) as Record<CompareMetricKey, number | null>;

  const complete = Object.fromEntries(
    compareMetricKeys.map((metric) => [metric, observations[metric].complete && observations[metric].expected > 0]),
  ) as Record<CompareMetricKey, boolean>;

  const usable = Object.fromEntries(
    compareMetricKeys.map((metric) => [
      metric,
      metric === "audience"
        ? observationUsable(observations[metric])
        : observations[metric].expected > 0 && observationUsable(observations[metric]),
    ]),
  ) as Record<CompareMetricKey, boolean>;

  const accountSet = Object.fromEntries(
    compareMetricKeys.map((metric) => [metric, metricAccountSet(rows, metric)]),
  ) as Record<CompareMetricKey, string>;

  const observedValues = Object.fromEntries(
    compareMetricKeys.map((metric) => [metric, observedMetricValues(rows, metric)]),
  ) as Record<CompareMetricKey, Record<string, number>>;

  return { ...values, complete, usable, accountSet, observedValues };
}

export function buildComparePayload() {
  const groups: CompareEntity[] = officialGroups.map((group) => {
    const current = getGroupStats(group.slug);
    const currentMetrics = metricsForRows(current.accounts);
    return {
      slug: group.slug,
      name: group.name,
      type: "GROUP",
      groupSlugs: [group.slug],
      current: {
        audience: currentMetrics.audience,
        xFollowers: currentMetrics.xFollowers,
        instagramFollowers: currentMetrics.instagramFollowers,
        tiktokFollowers: currentMetrics.tiktokFollowers,
        youtubeSubscribers: currentMetrics.youtubeSubscribers,
        tiktokLikes: currentMetrics.tiktokLikes,
        youtubeViews: currentMetrics.youtubeViews,
      },
      platforms: current.platformFollowers,
      history: historySnapshots.map((snapshot) => ({
        date: snapshot.date ?? "—",
        ...metricsForRows(snapshot.accounts.filter((account) => account.groupSlug === group.slug)),
      })),
    };
  });

  const members: CompareEntity[] = allMembers.map((member) => {
    const current = getMemberStats(member.slug);
    const currentMetrics = metricsForRows(current.accounts);
    return {
      slug: member.slug,
      name: member.name,
      type: "MEMBER",
      groupSlugs: member.relations.map((group) => group.slug),
      primaryGroupName: member.primaryGroup?.name ?? member.relations[0]?.name ?? null,
      current: {
        audience: currentMetrics.audience,
        xFollowers: currentMetrics.xFollowers,
        instagramFollowers: currentMetrics.instagramFollowers,
        tiktokFollowers: currentMetrics.tiktokFollowers,
        youtubeSubscribers: currentMetrics.youtubeSubscribers,
        tiktokLikes: currentMetrics.tiktokLikes,
        youtubeViews: currentMetrics.youtubeViews,
      },
      platforms: current.platformFollowers,
      history: historySnapshots.map((snapshot) => ({
        date: snapshot.date ?? "—",
        ...metricsForRows(snapshot.accounts.filter((account) => account.entitySlug === member.slug)),
      })),
    };
  });

  return { groups, members };
}
