import { officialGroups } from "@/lib/official-directory";
import { allMembers, getGroupStats, getMemberStats, historySnapshots } from "@/lib/analytics";
import { accountSetKey, aggregateAccounts, type PlatformLabel } from "@/lib/metrics";
import type { LiveAccount } from "@/lib/live-stats";

export type CompareMetricKey = "audience" | "tiktokLikes" | "youtubeViews";
export type PlatformAudience = Record<PlatformLabel, number | null>;

export type ComparePoint = {
  date: string;
  audience: number | null;
  tiktokLikes: number | null;
  youtubeViews: number | null;
  complete: Record<CompareMetricKey, boolean>;
  accountSet: Record<CompareMetricKey, string>;
};

export type CompareEntity = {
  slug: string;
  name: string;
  type: "GROUP" | "MEMBER";
  groupSlugs: string[];
  primaryGroupName?: string | null;
  current: Omit<ComparePoint, "date" | "complete" | "accountSet">;
  platforms: PlatformAudience;
  history: ComparePoint[];
};

function metricsForRows(rows: LiveAccount[]) {
  const aggregate = aggregateAccounts(rows);
  const tiktokRows = rows.filter((account) => account.platform === "TIKTOK");
  const youtubeRows = rows.filter((account) => account.platform === "YOUTUBE");
  return {
    audience: aggregate.audience.value,
    tiktokLikes: aggregate.tiktokLikes.value,
    youtubeViews: aggregate.youtubeViews.value,
    complete: {
      audience: aggregate.audience.complete,
      tiktokLikes: aggregate.tiktokLikes.expected > 0 && aggregate.tiktokLikes.complete,
      youtubeViews: aggregate.youtubeViews.expected > 0 && aggregate.youtubeViews.complete,
    },
    accountSet: {
      audience: accountSetKey(rows),
      tiktokLikes: accountSetKey(tiktokRows),
      youtubeViews: accountSetKey(youtubeRows),
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
