import { officialGroups } from "@/lib/official-directory";
import { accountStats, allMembers, getGroupStats, getMemberStats, historySnapshots } from "@/lib/analytics";

export type CompareMetricKey = "audience" | "tiktokLikes" | "youtubeViews";

export type ComparePoint = {
  date: string;
  audience: number | null;
  tiktokLikes: number | null;
  youtubeViews: number | null;
};

export type CompareEntity = {
  slug: string;
  name: string;
  type: "GROUP" | "MEMBER";
  groupSlugs: string[];
  primaryGroupName?: string | null;
  current: Omit<ComparePoint, "date">;
  history: ComparePoint[];
};

function metricsForRows(rows: Parameters<typeof accountStats>[0]) {
  const stats = accountStats(rows);
  return {
    audience: stats.totalFollowers,
    tiktokLikes: stats.tiktokLikes,
    youtubeViews: stats.youtubeViews,
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
      history: historySnapshots.map((snapshot) => ({
        date: snapshot.date ?? "—",
        ...metricsForRows(snapshot.accounts.filter((account) => account.entitySlug === member.slug)),
      })),
    };
  });

  return { groups, members };
}
