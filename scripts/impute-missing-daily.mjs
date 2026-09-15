import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIRECTORY_DIR = path.join(ROOT, "data", "directory");
const LIVE_DIR = path.join(ROOT, "data", "live");
const HISTORY_DIR = path.join(LIVE_DIR, "history");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const TRUSTED_YOUTUBE_PARSER = "ABOUT_CHANNEL_VIEW_MODEL_V1";

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;

function jstDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizePlatform(platform) {
  return platform === "YOUTUBE" ? "YouTube" : platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : "X";
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

async function loadPrimaryGroups() {
  const files = (await readdir(DIRECTORY_DIR)).filter((file) => file.endsWith(".json")).sort();
  const groups = [];
  for (const file of files) {
    const data = await readJson(path.join(DIRECTORY_DIR, file));
    if (data.category === "DEBUTED") groups.push({ slug: data.slug, name: data.name });
  }
  return groups;
}

function summarize(snapshot, primaryGroups) {
  const trusted = (account) => account.platform !== "YOUTUBE" || account.parserVersion === TRUSTED_YOUTUBE_PARSER;
  const followerRows = snapshot.accounts.filter((account) => !account.error && trusted(account) && finite(account.followers));
  const metricRows = snapshot.accounts.filter((account) => !account.error && trusted(account));
  const groups = {};
  const sumMetric = (items, key) => {
    const values = items.map((item) => item[key]).filter(finite);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };

  for (const group of primaryGroups) {
    const rows = followerRows.filter((account) => account.groupSlug === group.slug);
    const metrics = metricRows.filter((account) => account.groupSlug === group.slug);
    const officialRows = rows.filter((account) => account.entityType === "GROUP" && account.entitySlug === group.slug);
    const memberRows = rows.filter((account) => account.entityType === "MEMBER");
    const sum = (items) => items.reduce((total, item) => total + item.followers, 0);
    const platforms = { X: 0, Instagram: 0, TikTok: 0, YouTube: 0 };
    for (const row of rows) platforms[normalizePlatform(row.platform)] += row.followers;
    const youtubeRows = metrics.filter((account) => account.platform === "YOUTUBE");
    const tiktokRows = metrics.filter((account) => account.platform === "TIKTOK");
    const expectedAccounts = snapshot.accounts.filter((account) => account.groupSlug === group.slug).length;
    const observedAccounts = rows.filter((row) => !row.imputed).length;
    const imputedAccounts = rows.filter((row) => row.imputed).length;

    groups[group.slug] = {
      name: group.name,
      official: sum(officialRows),
      members: sum(memberRows),
      ecosystem: sum(rows),
      platforms,
      youtubeViews: sumMetric(youtubeRows, "views"),
      youtubeViewAccounts: youtubeRows.filter((row) => !row.imputed && finite(row.views)).length,
      tiktokLikes: sumMetric(tiktokRows, "likes"),
      tiktokLikeAccounts: tiktokRows.filter((row) => !row.imputed && finite(row.likes)).length,
      observedAccounts,
      imputedAccounts,
      expectedAccounts,
    };
  }

  return { date: snapshot.date, collectedAt: snapshot.collectedAt, groups };
}

async function rebuildSeries(primaryGroups) {
  const files = (await readdir(HISTORY_DIR)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const series = [];
  for (const file of files) series.push(summarize(await readJson(path.join(HISTORY_DIR, file)), primaryGroups));
  const serialized = `${JSON.stringify(series, null, 2)}\n`;
  await writeFile(path.join(LIVE_DIR, "series.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "series.json"), serialized);
}

async function writeSnapshot(snapshot, primaryGroups) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const historyPath = path.join(HISTORY_DIR, `${snapshot.date}.json`);
  const publicHistoryPath = path.join(PUBLIC_DATA_DIR, "history", `${snapshot.date}.json`);
  await mkdir(path.dirname(publicHistoryPath), { recursive: true });
  await writeFile(historyPath, serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(publicHistoryPath, serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
  await rebuildSeries(primaryGroups);
}

function imputedRow(current, source, sourceDate, imputedAt) {
  const { error, detail, ...base } = current;
  return {
    ...base,
    capturedAt: source.capturedAt,
    sourceType: "IMPUTED_LAST_OBSERVED",
    sourceUrl: source.sourceUrl ?? current.profileUrl,
    providerPlatform: source.providerPlatform ?? null,
    providerHandle: source.providerHandle ?? source.handle ?? current.handle,
    providerName: source.providerName ?? source.entityName ?? current.entityName,
    followers: source.followers ?? null,
    following: source.following ?? null,
    posts: source.posts ?? null,
    likes: source.likes ?? null,
    views: source.views ?? null,
    viewsPrecision: source.viewsPrecision ?? null,
    verified: source.verified ?? null,
    avatar: source.avatar ?? null,
    parserVersion: source.parserVersion ?? null,
    audienceMetric: source.audienceMetric ?? (current.platform === "YOUTUBE" ? "SUBSCRIBERS" : "FOLLOWERS"),
    precision: source.precision ?? "PUBLIC_PROFILE",
    engagementMetric: source.engagementMetric ?? null,
    imputed: true,
    imputationMethod: "LAST_OBSERVED_VALUE",
    imputedFromDate: sourceDate,
    imputedFromCapturedAt: source.capturedAt,
    imputedAt,
    imputedSourceType: source.sourceType ?? null,
    acquisitionError: { error: error ?? "missing", detail: detail ?? null },
  };
}

async function main() {
  const snapshot = await readJson(path.join(LIVE_DIR, "latest.json"));
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; daily imputation skipped.`);
    return;
  }

  const targets = snapshot.accounts.filter((row) => row.error);
  if (!targets.length) {
    console.log("No failed rows require fallback imputation.");
    return;
  }

  const targetKeys = new Set(targets.map(accountKey));
  const sourceByKey = new Map();
  const historyFiles = (await readdir(HISTORY_DIR))
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file) && file.slice(0, 10) < snapshot.date)
    .sort()
    .reverse();

  for (const file of historyFiles) {
    if (sourceByKey.size === targetKeys.size) break;
    const sourceSnapshot = await readJson(path.join(HISTORY_DIR, file));
    for (const row of sourceSnapshot.accounts ?? []) {
      const key = accountKey(row);
      if (!targetKeys.has(key) || sourceByKey.has(key)) continue;
      if (row.error || row.imputed || !finite(row.followers)) continue;
      sourceByKey.set(key, { row, date: sourceSnapshot.date });
    }
  }

  const imputedAt = new Date().toISOString();
  let filled = 0;
  const accounts = snapshot.accounts.map((row) => {
    if (!row.error) return row;
    const source = sourceByKey.get(accountKey(row));
    if (!source) return row;
    filled += 1;
    return imputedRow(row, source.row, source.date, imputedAt);
  });

  if (!filled) {
    console.warn(`No historical observed values were available for ${targets.length} failed row(s).`);
    return;
  }

  const failedRows = accounts.filter((row) => row.error);
  const imputedRows = accounts.filter((row) => !row.error && row.imputed === true);
  const observedRows = accounts.filter((row) => !row.error && !row.imputed);
  const next = {
    ...snapshot,
    complete: failedRows.length === 0,
    observedComplete: failedRows.length === 0 && imputedRows.length === 0,
    attempted: accounts.length,
    successful: accounts.length - failedRows.length,
    observedSuccessful: observedRows.length,
    failed: failedRows.length,
    imputed: imputedRows.length,
    imputedAt,
    source: {
      ...(snapshot.source ?? {}),
      imputation: "LAST_OBSERVED_VALUE",
      note: "Acquisition is retried first. Remaining gaps are filled from the most recent real observation, tagged imputed=true, excluded from growth calculations, and retried as real observations by later Actions.",
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  const primaryGroups = await loadPrimaryGroups();
  await writeSnapshot(next, primaryGroups);
  console.log(`Imputed ${filled}/${targets.length} unresolved row(s); observed=${observedRows.length}, imputed=${imputedRows.length}, hard-failed=${failedRows.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
