import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = path.join(ROOT, "data", "live");
const HISTORY = path.join(LIVE, "history");
const DIRECTORY = path.join(ROOT, "data", "directory");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const TRUSTED_YOUTUBE_PARSER = "ABOUT_CHANNEL_VIEW_MODEL_V1";

const errors = [];
const warn = [];
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;

function jstDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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

async function canonicalKeys() {
  const files = (await readdir(DIRECTORY)).filter((file) => file.endsWith(".json")).sort();
  const keys = new Set();
  for (const file of files) {
    const data = await readJson(path.join(DIRECTORY, file));
    const add = (account) => {
      if (account?.platform && account?.handle && account?.url) keys.add(accountKey(account));
    };
    for (const account of data.accounts ?? []) add(account);
    for (const member of data.members ?? []) {
      if (member.relationOnly) continue;
      for (const account of member.accounts ?? []) add(account);
    }
  }
  return keys;
}

const historyFiles = (await readdir(HISTORY)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
if (!historyFiles.length) errors.push("No daily history snapshots exist.");

const snapshots = [];
for (const file of historyFiles) {
  const snapshot = await readJson(path.join(HISTORY, file));
  snapshots.push(snapshot);
  const expectedDate = file.slice(0, 10);
  if (snapshot.date !== expectedDate) errors.push(`${file}: snapshot.date=${snapshot.date} does not match filename.`);

  const collectionDate = jstDate(snapshot.collectedAt);
  if (!collectionDate) errors.push(`${file}: invalid collectedAt.`);
  else if (collectionDate !== expectedDate) errors.push(`${file}: collectedAt belongs to JST date ${collectionDate}.`);

  if (!Array.isArray(snapshot.accounts)) {
    errors.push(`${file}: accounts is not an array.`);
    continue;
  }

  const failedCount = snapshot.accounts.filter((account) => Boolean(account.error)).length;
  const successfulCount = snapshot.accounts.length - failedCount;
  if (snapshot.attempted != null && snapshot.attempted !== snapshot.accounts.length) errors.push(`${file}: attempted ${snapshot.attempted} != accounts ${snapshot.accounts.length}.`);
  if (snapshot.successful != null && snapshot.successful !== successfulCount) errors.push(`${file}: successful ${snapshot.successful} != observed successful rows ${successfulCount}.`);
  if (snapshot.failed != null && snapshot.failed !== failedCount) errors.push(`${file}: failed ${snapshot.failed} != observed failed rows ${failedCount}.`);
  if (Boolean(snapshot.complete) !== (failedCount === 0)) errors.push(`${file}: complete=${snapshot.complete} is inconsistent with failed=${failedCount}.`);

  const seen = new Set();
  for (const account of snapshot.accounts) {
    const key = accountKey(account);
    if (seen.has(key)) errors.push(`${file}: duplicate account ${key}.`);
    seen.add(key);
    if (!account.capturedAt || Number.isNaN(Date.parse(account.capturedAt))) errors.push(`${file}:${key}: invalid capturedAt.`);
    if (expectedDate >= "2026-08-25" && account.platform === "YOUTUBE" && !account.error && account.parserVersion !== TRUSTED_YOUTUBE_PARSER) {
      errors.push(`${file}:${key}: successful YouTube row is not from trusted parser.`);
    }
  }
}

const latest = await readJson(path.join(LIVE, "latest.json"));
const newestFile = historyFiles.at(-1);
if (newestFile && latest.date !== newestFile.slice(0, 10)) errors.push(`latest.json date ${latest.date} != newest history ${newestFile}.`);

if (newestFile) {
  const newest = snapshots.at(-1);
  const canonical = await canonicalKeys();
  const currentKeys = new Set(newest.accounts.map(accountKey));
  for (const key of canonical) if (!currentKeys.has(key)) errors.push(`latest snapshot missing canonical account ${key}.`);
  for (const key of currentKeys) if (!canonical.has(key)) errors.push(`latest snapshot contains non-canonical account ${key}.`);
}

const series = await readJson(path.join(LIVE, "series.json"));
const seriesDates = Array.isArray(series) ? series.map((point) => point.date) : [];
const historyDates = historyFiles.map((file) => file.slice(0, 10));
if (JSON.stringify(seriesDates) !== JSON.stringify(historyDates)) errors.push("series.json dates do not exactly match history files.");

try {
  const publicLatest = await readJson(path.join(PUBLIC_DATA, "latest.json"));
  if (publicLatest.date !== latest.date || publicLatest.collectedAt !== latest.collectedAt) errors.push("public/data/latest.json is not synchronized with data/live/latest.json.");
} catch {
  errors.push("public/data/latest.json is missing or unreadable.");
}

for (let index = 1; index < snapshots.length; index += 1) {
  const previous = snapshots[index - 1];
  const current = snapshots[index];
  const prevKeys = new Set(previous.accounts.map(accountKey));
  const curKeys = new Set(current.accounts.map(accountKey));
  if (prevKeys.size !== curKeys.size || [...prevKeys].some((key) => !curKeys.has(key))) {
    warn.push(`${previous.date} -> ${current.date}: canonical account set changed; growth across this boundary must remain unavailable.`);
  }
}

console.log(`Validated ${historyFiles.length} daily snapshots; latest=${latest.date}; accounts=${latest.accounts?.length ?? 0}; capture time unrestricted.`);
for (const message of warn) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);
if (errors.length) process.exitCode = 1;
