import { officialGroups } from "@/lib/official-directory";
import { accountStats, allMembers, getGroupStats, getMemberStats, historySnapshots } from "@/lib/analytics";
import { trustedAccount, type LiveAccount } from "@/lib/live-stats";

export type CompareMetricKey = "audience" | "tiktokLikes" | "youtubeViews";
export type PlatformAudience = { X: number; Instagram: number; TikTok: number; YouTube: number };

export type ComparePoint = {
  date: string;
  audience: number | null;
  tiktokLikes: number | null;
  youtubeViews: number | null;
  complete: Record<CompareMetricKey, boolean>;
};

export type CompareEntity = {
  slug: string;
  name: string;
  type: "GROUP" | "MEMBER";
  groupSlugs: string[];
  primaryGroupName?: string | null;
  current: Omit<ComparePoint, "date" | "complete">;
  platforms: PlatformAudience;
  history: ComparePoint[];
};

const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value);

function metricsForRows(rows: LiveAccount[], expectedRows: LiveAccount[]) {
  const stats = accountStats(rows);
  const expectedTikTok = expectedRows.filter((account) => account.platform === "TIKTOK").length;
  const expectedYouTube = expectedRows.filter((account) => account.platform === "YOUTUBE").length;
  const observedTikTokLikes = rows.filter((account) => trustedAccount(account) && account.platform === "TIKTOK" && !account.error && numeric(account.likes)).length;
  const observedYouTubeViews = rows.filter((account) => trustedAccount(account) && account.platform === "YOUTUBE" && !account.error && numeric(account.views)).length;

  return {
    audience: stats.totalFollowers,
    tiktokLikes: stats.tiktokLikes,
    youtubeViews: stats.youtubeViews,
    complete: {
      audience: stats.observed === expectedRows.length,
      tiktokLikes: expectedTikTok > 0 && observedTikTokLikes === expectedTikTok,
      youtubeViews: expectedYouTube > 0 && observedYouTubeViews === expectedYouTube,
    },
  };
}

export function buildComparePayload() {
  const groups: CompareEntity[] = officialGroups.map((group) => {
    const current = getGroupStats(group.slug);
    const expectedRows = current.accounts;
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
        ...metricsForRows(snapshot.accounts.filter((account) => account.groupSlug === group.slug), expectedRows),
      })),
    };
  });

  const members: CompareEntity[] = allMembers.map((member) => {
    const current = getMemberStats(member.slug);
    const expectedRows = current.accounts;
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
        ...metricsForRows(snapshot.accounts.filter((account) => account.entitySlug === member.slug), expectedRows),
      })),
    };
  });

  return { groups, members };
}