import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { officialGroups, type DirectoryGroup, type DirectoryMember } from "@/lib/official-directory";
import { liveSnapshot, type LiveAccount, type Snapshot } from "@/lib/live-stats";
import { accountSetKey, aggregateAccounts, exactDayInterval, platformLabel, platformLabels, trustedMetricAccount, type PlatformLabel } from "@/lib/metrics";

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

type TimelineSeriesKey = "Total" | PlatformLabel;

export type MemberTimelinePoint = {
  date: string;
  isoDate: string;
  Total: number | null;
  X: number | null;
  Instagram: number | null;
  TikTok: number | null;
  YouTube: number | null;
  accountSet: Record<TimelineSeriesKey, string>;
  observedValues: Record<TimelineSeriesKey, Record<string, number>>;
};

function observationUsable(observation: { value: number | null; observed: number; imputed: number; expected: number }) {
  return observation.value != null && observation.observed + observation.imputed === observation.expected;
}

function observedFollowerValues(rows: LiveAccount[], platform?: PlatformLabel) {
  return Object.fromEntries(
    rows
      .filter((account) =>
        trustedMetricAccount(account) &&
        !account.error &&
        !account.imputed &&
        typeof account.followers === "number" &&
        Number.isFinite(account.followers) &&
        (!platform || platformLabel(account.platform) === platform)
      )
      .map((account) => [`${account.platform}:${String(account.handle).toLowerCase()}`, account.followers as number]),
  );
}

function timelinePoint(snapshot: RawSnapshot, rows: LiveAccount[]): MemberTimelinePoint {
  const aggregate = aggregateAccounts(rows);
  const isoDate = snapshot.date ?? "—";
  return {
    date: isoDate.slice(5),
    isoDate,
    Total: observationUsable(aggregate.audience) ? aggregate.audience.value : null,
    X: observationUsable(aggregate.platforms.X) ? aggregate.platforms.X.value : null,
    Instagram: observationUsable(aggregate.platforms.Instagram) ? aggregate.platforms.Instagram.value : null,
    TikTok: observationUsable(aggregate.platforms.TikTok) ? aggregate.platforms.TikTok.value : null,
    YouTube: observationUsable(aggregate.platforms.YouTube) ? aggregate.platforms.YouTube.value : null,
    accountSet: {
      Total: accountSetKey(rows),
      X: accountSetKey(rows, "X"),
      Instagram: accountSetKey(rows, "Instagram"),
      TikTok: accountSetKey(rows, "TikTok"),
      YouTube: accountSetKey(rows, "YouTube"),
    },
    observedValues: {
      Total: observedFollowerValues(rows),
      X: observedFollowerValues(rows, "X"),
      Instagram: observedFollowerValues(rows, "Instagram"),
      TikTok: observedFollowerValues(rows, "TikTok"),
      YouTube: observedFollowerValues(rows, "YouTube"),
    },
  };
}

export function getMemberTimeline(slug: string): MemberTimelinePoint[] {
  return historySnapshots.map((snapshot) => timelinePoint(snapshot, snapshotRows(snapshot, (account) => account.entitySlug === slug)));
}

export function getGroupTimeline(slug: string): MemberTimelinePoint[] {
  return historySnapshots.map((snapshot) => timelinePoint(snapshot, snapshotRows(snapshot, (account) => account.groupSlug === slug)));
}

function matchedObservedChange(
  previous: Record<string, number>,
  current: Record<string, number>,
) {
  const keys = Object.keys(current).filter((key) => key in previous);
  if (!keys.length) return null;
  const before = keys.reduce((sum, key) => sum + previous[key], 0);
  const after = keys.reduce((sum, key) => sum + current[key], 0);
  return {
    delta: after - before,
    rate: before > 0 ? ((after - before) / before) * 100 : null,
    matched: keys.length,
  };
}

function growthForRows(predicate: (account: LiveAccount) => boolean) {
  const points = historySnapshots.map((snapshot) => {
    const rows = snapshotRows(snapshot, predicate);
    return {
      date: snapshot.date ?? "",
      accountSet: accountSetKey(rows),
      observedValues: observedFollowerValues(rows),
    };
  });
  const latest = points.at(-1) ?? null;
  const changeAtDays = (days: number) => {
    if (!latest) return null;
    const from = [...points].reverse().find((point) => exactDayInterval(point.date, latest.date, days));
    if (!from || from.accountSet !== latest.accountSet) return null;
    return matchedObservedChange(from.observedValues, latest.observedValues);
  };
  const day = changeAtDays(1);
  const week = changeAtDays(7);
  const month = changeAtDays(30);
  return {
    day: day?.delta ?? null,
    week: week?.delta ?? null,
    month: month?.delta ?? null,
    dayRate: day?.rate ?? null,
    weekRate: week?.rate ?? null,
    monthRate: month?.rate ?? null,
    dayMatched: day?.matched ?? 0,
    weekMatched: week?.matched ?? 0,
    monthMatched: month?.matched ?? 0,
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
