import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { officialGroups, type DirectoryGroup, type DirectoryMember } from "@/lib/official-directory";
import { liveSnapshot, liveSeries, trustedAccount, type LiveAccount } from "@/lib/live-stats";

type RawSnapshot = typeof liveSnapshot;

const platformLabel = (platform: LiveAccount["platform"]) =>
  platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : platform === "YOUTUBE" ? "YouTube" : "X";

const goodFollower = (account: LiveAccount) => trustedAccount(account) && !account.error && typeof account.followers === "number" && Number.isFinite(account.followers);
const goodMetric = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

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
  const trusted = accounts.filter(trustedAccount);
  const observed = trusted.filter(goodFollower);
  const platformFollowers = { X: 0, Instagram: 0, TikTok: 0, YouTube: 0 };
  for (const account of observed) platformFollowers[platformLabel(account.platform)] += account.followers ?? 0;

  const tiktokLikes = sum(trusted.filter((account) => account.platform === "TIKTOK" && goodMetric(account.likes)).map((account) => account.likes as number));
  const youtubeViews = sum(trusted.filter((account) => account.platform === "YOUTUBE" && goodMetric(account.views)).map((account) => account.views as number));

  return {
    totalFollowers: sum(observed.map((account) => account.followers ?? 0)),
    platformFollowers,
    tiktokLikes: tiktokLikes || null,
    youtubeViews: youtubeViews || null,
    observed: observed.length,
    expected: accounts.length,
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

function snapshotMemberTotal(snapshot: RawSnapshot, slug: string) {
  return accountStats(snapshot.accounts.filter((account) => account.entitySlug === slug));
}

export type MemberTimelinePoint = {
  date: string;
  Total: number | null;
  X: number | null;
  Instagram: number | null;
  TikTok: number | null;
  YouTube: number | null;
};

export function getMemberTimeline(slug: string): MemberTimelinePoint[] {
  return historySnapshots.map((snapshot) => {
    const rows = snapshot.accounts.filter((account) => account.entitySlug === slug);
    const stats = accountStats(rows);
    const platformValue = (label: "X" | "Instagram" | "TikTok" | "YouTube") => {
      const platformRows = rows.filter((account) => platformLabel(account.platform) === label);
      if (!platformRows.length) return null;
      const observed = platformRows.filter(goodFollower);
      return observed.length === platformRows.length ? sum(observed.map((account) => account.followers ?? 0)) : null;
    };
    return {
      date: snapshot.date?.slice(5) ?? "—",
      Total: stats.expected > 0 && stats.observed === stats.expected ? stats.totalFollowers : null,
      X: platformValue("X"),
      Instagram: platformValue("Instagram"),
      TikTok: platformValue("TikTok"),
      YouTube: platformValue("YouTube"),
    };
  });
}

export function getGroupTimeline(slug: string) {
  const fromSeries = liveSeries
    .filter((point) => point.groups[slug])
    .map((point) => ({ date: point.date.slice(5), Total: point.groups[slug].ecosystem }));
  if (fromSeries.length > 1) return fromSeries;

  return historySnapshots.map((snapshot) => ({
    date: snapshot.date?.slice(5) ?? "—",
    Total: accountStats(snapshot.accounts.filter((account) => account.groupSlug === slug)).totalFollowers,
  }));
}

export function memberGrowth(slug: string) {
  const timeline = historySnapshots.map((snapshot) => ({ date: snapshot.date, value: snapshotMemberTotal(snapshot, slug).totalFollowers }));
  const latest = timeline.at(-1)?.value ?? 0;
  const previous = timeline.at(-2)?.value ?? null;
  const first7 = timeline.length >= 8 ? timeline.at(-8)?.value ?? null : null;
  const first30 = timeline.length >= 31 ? timeline.at(-31)?.value ?? null : null;
  return {
    day: previous == null ? null : latest - previous,
    week: first7 == null ? null : latest - first7,
    month: first30 == null ? null : latest - first30,
  };
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
    .sort((a, b) => b.stats.totalFollowers - a.stats.totalFollowers);
}
