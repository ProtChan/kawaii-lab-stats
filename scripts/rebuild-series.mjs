import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIRECTORY = path.join(ROOT, "data", "directory");
const HISTORY = path.join(ROOT, "data", "live", "history");
const LIVE = path.join(ROOT, "data", "live");
const PUBLIC = path.join(ROOT, "public", "data");
const YOUTUBE_PARSER = "ABOUT_CHANNEL_VIEW_MODEL_V1";
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const platformLabel = (platform) => platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : platform === "YOUTUBE" ? "YouTube" : "X";

async function primaryGroups() {
  const files = (await readdir(DIRECTORY)).filter((file) => file.endsWith(".json")).sort();
  const groups = [];
  for (const file of files) {
    const data = await readJson(path.join(DIRECTORY, file));
    if (data.category === "DEBUTED") groups.push({ slug: data.slug, name: data.name });
  }
  return groups;
}

function trusted(row) {
  return row.platform !== "YOUTUBE" || row.parserVersion === YOUTUBE_PARSER;
}

function eligibleForGroup(row) {
  return row.entityType !== "MEMBER" || row.entityStatus !== "INACTIVE";
}

function sum(items, key) {
  const values = items.map((row) => row[key]).filter(finite);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function summarize(snapshot, groups) {
  const result = {};
  for (const group of groups) {
    const canonical = snapshot.accounts.filter((row) => row.groupSlug === group.slug && eligibleForGroup(row));
    const rows = canonical.filter((row) => !row.error && trusted(row) && finite(row.followers));
    const metrics = canonical.filter((row) => !row.error && trusted(row));
    const officialRows = rows.filter((row) => row.entityType === "GROUP" && row.entitySlug === group.slug);
    const memberRows = rows.filter((row) => row.entityType === "MEMBER");
    const platforms = { X: 0, Instagram: 0, TikTok: 0, YouTube: 0 };
    for (const row of rows) platforms[platformLabel(row.platform)] += row.followers;
    const youtubeRows = metrics.filter((row) => row.platform === "YOUTUBE");
    const tiktokRows = metrics.filter((row) => row.platform === "TIKTOK");
    result[group.slug] = {
      name: group.name,
      official: sum(officialRows, "followers") ?? 0,
      members: sum(memberRows, "followers") ?? 0,
      ecosystem: sum(rows, "followers") ?? 0,
      platforms,
      youtubeViews: sum(youtubeRows, "views"),
      youtubeViewAccounts: youtubeRows.filter((row) => !row.imputed && finite(row.views)).length,
      tiktokLikes: sum(tiktokRows, "likes"),
      tiktokLikeAccounts: tiktokRows.filter((row) => !row.imputed && finite(row.likes)).length,
      observedAccounts: rows.filter((row) => !row.imputed).length,
      imputedAccounts: rows.filter((row) => row.imputed).length,
      expectedAccounts: canonical.length,
    };
  }
  return { date: snapshot.date, collectedAt: snapshot.collectedAt, groups: result };
}

async function main() {
  const groups = await primaryGroups();
  const files = (await readdir(HISTORY)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const series = [];
  for (const file of files) series.push(summarize(await readJson(path.join(HISTORY, file)), groups));
  const serialized = `${JSON.stringify(series, null, 2)}\n`;
  await writeFile(path.join(LIVE, "series.json"), serialized);
  await writeFile(path.join(PUBLIC, "series.json"), serialized);
  console.log(`Rebuilt series.json from ${files.length} daily snapshot(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
