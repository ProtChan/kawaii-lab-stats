import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { officialGroups, type DirectoryGroup, type DirectoryMember } from "@/lib/official-directory";
import { liveSnapshot, type LiveAccount, type Snapshot } from "@/lib/live-stats";
import { accountSetKey, aggregateAccounts, completeDelta, exactDayInterval, platformLabels, type PlatformLabel } from "@/lib/metrics";

type RawSnapshot = Snapshot;

function loadHistory(): RawSnapshot[] {
  try {
    const dir = path.join(process.cwd(), "data", "live", "history");
    return readdirSync(dir)
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .sort()
      .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as RawSnapshot);
  } catch {
    return liveSnapshot.complete ? [liveSnapshot] : [];
  }
}

export const historySnapshots = loadHistory();

export type MemberRecord = {
  slug: string;
  name: string;
  status: DirectoryMember["status"];
  accounts: DirectoryMember["accounts"];
  primaryGroup: DirectoryGroup | null;
  relations: DirectoryGroup[];
};

const memberMap = new Map<string, MemberRecord>();
for (const group of officialGroups) {
  for (const member of group.members) {
    const existing = memberMap.get(member.slug);
    if (!existing) {
      memberMap.set(member.slug, {
        slug: member.slug,
        name: member.name,
        status: member.status ?? "ACTIVE",
        accounts: member.relationOnly ? [] : member.accounts,
        primaryGroup: member.relationOnly ? null : group,
        relations: [group],
      });
    } else {
      if (!existing.relations.some((item) => item.slug === group.slug)) existing.relations.push(group);
      if (!member.relationOnly && !existing.primaryGroup) {
        existing.primaryGroup = group;
        existing.accounts = member.accounts;
        existing.status = member.status ?? existing.status;
      }
    }
  }
}

export const allMembers = [...memberMap.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
export const getMember = (slug: string) => memberMap.get(slug) ?? null;
export const getGroup = (slug: string) => officialGroups.find((group) => group.slug === slug) ?? null;

export function accountStats(accounts: LiveAccount[]) {
  const aggregate = aggregateAccounts(accounts);
  return {
    totalFollowers: aggregate.audience.value,
    platformFollowers: Object.fromEntries(platformLabels.map((label) => [label, aggregate.platforms[label].value])) as Record<PlatformLabel, number | null>,
    platformCoverage: aggregate.platforms,
    tiktokLikes: aggregate.tiktokLikes.value,
    youtubeViews: aggregate.youtubeViews.value,
    tiktokCoverage: aggregate.tiktokLikes,
    youtubeCoverage: aggregate.youtubeViews,
    observed: aggregate.audience.observed,
    expected: aggregate.audience.expected,
    complete: aggregate.audience.complete,
  };
}

export function getMemberStats(slug: string) {
  const rows = liveSnapshot.accounts.filter((account) => account.entitySlug === slug);
  return { ...accountStats(rows), accounts: rows };
}

export function getGroupStats(slug: string) {
  const rows = liveSnapshot.accounts.filter((account) => account.groupSlug === slug);
  const officialRows = rows.filter((account) => account.entityType === "GROUP" && account.entitySlug === slug);
  const memberRows = rows.filter((account) => account.entityType === "MEMBER");
  return {
    ...accountStats(rows),
    officialFollowers: accountStats(officialRows).totalFollowers,
    memberFollowers: accountStats(memberRows).totalFollowers,
    accounts: rows,
  };
}

function snapshotRows(snapshot: RawSnapshot, predicate: (account: LiveAccount) => boolean) {
  return snapshot.accounts.filter(predicate);
}

export type MemberTimelinePoint = {
  date: string;
  isoDate: string;
  Total: number | null;
  X: number | null;
  Instagram: number | null;
  TikTok: number | null;
  YouTube: number | null;
  accountSet: Record<"Total" | PlatformLabel, string>;
};

function timelinePoint(snapshot: RawSnapshot, rows: LiveAccount[]): MemberTimelinePoint {
  const aggregate = aggregateAccounts(rows);
  const isoDate = snapshot.date ?? "—";
  return {
    date: isoDate.slice(5),
    isoDate,
    Total: aggregate.audience.complete ? aggregate.audience.value : null,
    X: aggregate.platforms.X.complete ? aggregate.platforms.X.value : null,
    Instagram: aggregate.platforms.Instagram.complete ? aggregate.platforms.Instagram.value : null,
    TikTok: aggregate.platforms.TikTok.complete ? aggregate.platforms.TikTok.value : null,
    YouTube: aggregate.platforms.YouTube.complete ? aggregate.platforms.YouTube.value : null,
    accountSet: {
      Total: accountSetKey(rows),
      X: accountSetKey(rows, "X"),
      Instagram: accountSetKey(rows, "Instagram"),
      TikTok: accountSetKey(rows, "TikTok"),
      YouTube: accountSetKey(rows, "YouTube"),
    },
  };
}

export function getMemberTimeline(slug: string): MemberTimelinePoint[] {
  return historySnapshots.map((snapshot) => timelinePoint(snapshot, snapshotRows(snapshot, (account) => account.entitySlug === slug)));
}

export function getGroupTimeline(slug: string): MemberTimelinePoint[] {
  return historySnapshots.map((snapshot) => timelinePoint(snapshot, snapshotRows(snapshot, (account) => account.groupSlug === slug)));
}

function growthForRows(predicate: (account: LiveAccount) => boolean) {
  const points = historySnapshots.map((snapshot) => {
    const rows = snapshotRows(snapshot, predicate);
    return { date: snapshot.date ?? "", observation: aggregateAccounts(rows).audience, accountSet: accountSetKey(rows) };
  });
  const latest = points.at(-1) ?? null;
  const deltaAtDays = (days: number) => {
    if (!latest) return null;
    const from = [...points].reverse().find((point) => exactDayInterval(point.date, latest.date, days));
    if (!from || from.accountSet !== latest.accountSet) return null;
    return completeDelta(from.observation, latest.observation);
  };
  return {
    day: deltaAtDays(1),
    week: deltaAtDays(7),
    month: deltaAtDays(30),
  };
}

export function memberGrowth(slug: string) {
  return growthForRows((account) => account.entitySlug === slug);
}

export function groupGrowth(slug: string) {
  return growthForRows((account) => account.groupSlug === slug);
}

export function groupMembers(group: DirectoryGroup) {
  return group.members.map((member) => {
    const record = getMember(member.slug);
    const stats = getMemberStats(member.slug);
    const growth = memberGrowth(member.slug);
    return { member, record, stats, growth };
  });
}

export function currentMemberRanking() {
  return allMembers
    .map((member) => ({ member, stats: getMemberStats(member.slug), growth: memberGrowth(member.slug) }))
    .sort((a, b) => (b.stats.totalFollowers ?? -1) - (a.stats.totalFollowers ?? -1));
}
