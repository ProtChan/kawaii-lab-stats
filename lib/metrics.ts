export const TRUSTED_YOUTUBE_PARSER = "ABOUT_CHANNEL_VIEW_MODEL_V1";

export const platformLabels = ["X", "Instagram", "TikTok", "YouTube"] as const;
export type PlatformLabel = (typeof platformLabels)[number];

export type MetricAccount = {
  platform: "X" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
  handle?: string;
  parserVersion?: string | null;
  followers?: number | null;
  likes?: number | null;
  views?: number | null;
  error?: string;
};

export type Observation = {
  value: number | null;
  observed: number;
  expected: number;
  complete: boolean;
};

export type AccountAggregate = {
  audience: Observation;
  platforms: Record<PlatformLabel, Observation>;
  tiktokLikes: Observation;
  youtubeViews: Observation;
};

export const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const trustedMetricAccount = (account: MetricAccount) =>
  account.platform !== "YOUTUBE" || account.parserVersion === TRUSTED_YOUTUBE_PARSER;

export const platformLabel = (platform: MetricAccount["platform"]): PlatformLabel =>
  platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : platform === "YOUTUBE" ? "YouTube" : "X";

export function accountSetKey(accounts: MetricAccount[], platform?: PlatformLabel) {
  return accounts
    .filter((account) => !platform || platformLabel(account.platform) === platform)
    .map((account) => `${account.platform}:${String(account.handle ?? "").toLowerCase()}`)
    .sort()
    .join("|");
}

function observation(accounts: MetricAccount[], read: (account: MetricAccount) => number | null | undefined): Observation {
  const values = accounts
    .filter((account) => trustedMetricAccount(account) && !account.error)
    .map(read)
    .filter(finiteNumber);
  const expected = accounts.length;
  const observed = values.length;
  return {
    value: observed ? values.reduce((total, value) => total + value, 0) : expected === 0 ? 0 : null,
    observed,
    expected,
    complete: observed === expected,
  };
}

export function aggregateAccounts(accounts: MetricAccount[]): AccountAggregate {
  const platforms = Object.fromEntries(
    platformLabels.map((label) => {
      const rows = accounts.filter((account) => platformLabel(account.platform) === label);
      return [label, observation(rows, (account) => account.followers)];
    }),
  ) as Record<PlatformLabel, Observation>;

  const tiktokRows = accounts.filter((account) => account.platform === "TIKTOK");
  const youtubeRows = accounts.filter((account) => account.platform === "YOUTUBE");

  return {
    audience: observation(accounts, (account) => account.followers),
    platforms,
    tiktokLikes: observation(tiktokRows, (account) => account.likes),
    youtubeViews: observation(youtubeRows, (account) => account.views),
  };
}

export function completeDelta(previous: Observation | null | undefined, current: Observation | null | undefined) {
  if (!previous?.complete || !current?.complete || previous.value == null || current.value == null) return null;
  return current.value - previous.value;
}
