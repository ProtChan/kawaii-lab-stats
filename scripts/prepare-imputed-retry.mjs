import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

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

function defaultRetryMinutes(platform) {
  if (platform === "INSTAGRAM") return 360;
  if (platform === "X") return 60;
  if (platform === "TIKTOK") return 60;
  if (platform === "YOUTUBE") return 30;
  return 60;
}

function retryDue(row, now) {
  if (row.nextRetryAt && Number.isFinite(Date.parse(row.nextRetryAt))) return Date.parse(row.nextRetryAt) <= now;
  if (!row.imputedAt || !Number.isFinite(Date.parse(row.imputedAt))) return true;
  return Date.parse(row.imputedAt) + defaultRetryMinutes(row.platform) * 60_000 <= now;
}

function clearImputation(row) {
  const {
    imputed,
    imputationMethod,
    imputedFromDate,
    imputedFromCapturedAt,
    imputedAt,
    imputedSourceType,
    acquisitionError,
    nextRetryAt,
    retryBackoffMinutes,
    ...base
  } = row;
  return {
    ...base,
    followers: null,
    following: null,
    posts: null,
    likes: null,
    views: null,
    error: "imputed_refresh_pending",
    detail: "A previous fallback value is due for another real observation attempt.",
    refreshAttemptCount: (Number(row.refreshAttemptCount) || 0) + 1,
    previousAcquisitionError: acquisitionError ?? row.previousAcquisitionError ?? null,
  };
}

async function writeSnapshot(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(path.join(LIVE_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
}

async function main() {
  const snapshot = await readJson(path.join(LIVE_DIR, "latest.json"));
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; imputed retry preparation skipped.`);
    return;
  }

  const imputedRows = snapshot.accounts.filter((row) => row.imputed === true && !row.error);
  if (!imputedRows.length) {
    console.log("No imputed rows need a fresh observation attempt.");
    return;
  }

  const now = Date.now();
  const dueRows = imputedRows.filter((row) => retryDue(row, now));
  if (!dueRows.length) {
    const next = imputedRows
      .map((row) => row.nextRetryAt)
      .filter((value) => value && Number.isFinite(Date.parse(value)))
      .sort()[0] ?? null;
    console.log(`No imputed rows are due yet; retaining ${imputedRows.length} fallback value(s).${next ? ` Next retry ${next}.` : ""}`);
    return;
  }

  const keys = new Set(dueRows.map((row) => `${row.platform}:${String(row.handle).toLowerCase()}`));
  const accounts = snapshot.accounts.map((row) => keys.has(`${row.platform}:${String(row.handle).toLowerCase()}`) ? clearImputation(row) : row);
  const failed = accounts.filter((row) => row.error).length;
  const imputed = accounts.filter((row) => !row.error && row.imputed === true).length;
  const observedSuccessful = accounts.filter((row) => !row.error && !row.imputed).length;
  const next = {
    ...snapshot,
    complete: failed === 0,
    observedComplete: failed === 0 && imputed === 0,
    successful: accounts.length - failed,
    observedSuccessful,
    failed,
    imputed,
    accounts,
    errors: accounts.filter((row) => row.error).map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  await writeSnapshot(next);
  const byPlatform = Object.fromEntries(
    ["X", "INSTAGRAM", "TIKTOK", "YOUTUBE"].map((platform) => [platform, dueRows.filter((row) => row.platform === platform).length]),
  );
  console.log(`Prepared ${dueRows.length}/${imputedRows.length} imputed row(s) whose retry backoff has expired: ${JSON.stringify(byPlatform)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
