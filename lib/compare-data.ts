import { officialGroups } from "@/lib/official-directory";
import { allMembers, getGroupStats, getMemberStats, historySnapshots } from "@/lib/analytics";
import { accountSetKey, aggregateAccounts, trustedMetricAccount, type PlatformLabel } from "@/lib/metrics";
import type { LiveAccount } from "@/lib/live-stats";

export type CompareMetricKey = "audience" | "tiktokLikes" | "youtubeViews";
export type PlatformAudience = Record<PlatformLabel, number | null>;

export type ComparePoint = {
  date: string;
  audience: number | null;
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

function observationUsable(observation: { value: number | null; observed: number; imputed: number; expected: number }) {
  return observation.value != null && observation.observed + observation.imputed === observation.expected;
}

function observedMetricValues(rows: LiveAccount[], metric: CompareMetricKey) {
  return Object.fromEntries(
    rows
      .filter((account) => {
        if (!trustedMetricAccount(account) || account.error || account.imputed) return false;
        const value = metric === "audience" ? account.followers : metric === "tiktokLikes" ? account.likes : account.views;
        if (metric === "tiktokLikes" && account.platform !== "TIKTOK") return false;
        if (metric === "youtubeViews" && account.platform !== "YOUTUBE") return false;
        return typeof value === "number" && Number.isFinite(value);
      })
      .map((account) => {
        const value = metric === "audience" ? account.followers : metric === "tiktokLikes" ? account.likes : account.views;
        return [`${account.platform}:${String(account.handle).toLowerCase()}`, value as number];
      }),
  );
}

function metricsForRows(rows: LiveAccount[]) {
  const aggregate = aggregateAccounts(rows);
  const tiktokRows = rows.filter((account) => account.platform === "TIKTOK");
  const youtubeRows = rows.filter((account) => account.platform === "YOUTUBE");
  const audienceUsable = observationUsable(aggregate.audience);
  const tiktokUsable = aggregate.tiktokLikes.expected > 0 && observationUsable(aggregate.tiktokLikes);
  const youtubeUsable = aggregate.youtubeViews.expected > 0 && observationUsable(aggregate.youtubeViews);
  return {
    audience: audienceUsable ? aggregate.audience.value : null,
    tiktokLikes: tiktokUsable ? aggregate.tiktokLikes.value : null,
    youtubeViews: youtubeUsable ? aggregate.youtubeViews.value : null,
    complete: {
      audience: aggregate.audience.complete,
      tiktokLikes: aggregate.tiktokLikes.expected > 0 && aggregate.tiktokLikes.complete,
      youtubeViews: aggregate.youtubeViews.expected > 0 && aggregate.youtubeViews.complete,
    },
    usable: {
      audience: audienceUsable,
      tiktokLikes: tiktokUsable,
      youtubeViews: youtubeUsable,
    },
    accountSet: {
      audience: accountSetKey(rows),
      tiktokLikes: accountSetKey(tiktokRows),
      youtubeViews: accountSetKey(youtubeRows),
    },
    observedValues: {
      audience: observedMetricValues(rows, "audience"),
      tiktokLikes: observedMetricValues(rows, "tiktokLikes"),
      youtubeViews: observedMetricValues(rows, "youtubeViews"),
    },
  };
}

export function buildComparePayload() {
  const groups: CompareEntity[] = officialGroups.map((group) => {
    const current = getGroupStats(group.slug);
    return {
      slug: group.slug,
      name: group.name,
      type: "GROUP",
      groupSlugs: [group.slug],
      current: {
        audience: current.totalFollowers,
        tiktokLikes: current.tiktokLikes,
        youtubeViews: current.youtubeViews,
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
    return {
      slug: member.slug,
      name: member.name,
      type: "MEMBER",
      groupSlugs: member.relations.map((group) => group.slug),
      primaryGroupName: member.primaryGroup?.name ?? member.relations[0]?.name ?? null,
      current: {
        audience: current.totalFollowers,
        tiktokLikes: current.tiktokLikes,
        youtubeViews: current.youtubeViews,
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
