import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanBase(row) {
  const {
    error,
    detail,
    imputed,
    imputationMethod,
    imputedFromDate,
    imputedFromCapturedAt,
    imputedAt,
    imputedSourceType,
    acquisitionError,
    nextRetryAt,
    retryBackoffMinutes,
    fallbackErrors,
    ...base
  } = row;
  return base;
}

async function fetchProfile(row, capturedAt) {
  const username = String(row.handle).replace(/^@/, "");
  const url = `https://api.fxtwitter.com/2/profile/${encodeURIComponent(username)}`;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json",
      "User-Agent": "kawaii-lab-stats/0.7 (+https://github.com/ProtChan/kawaii-lab-stats)",
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`FxTwitter invalid JSON HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!response.ok || Number(payload?.code) >= 400) {
    throw new Error(`FxTwitter HTTP ${response.status} code=${payload?.code ?? "?"}: ${payload?.message ?? text.slice(0, 140)}`);
  }
  const user = payload?.user;
  const followers = numericOrNull(user?.followers);
  if (!user || followers == null) throw new Error("FxTwitter returned no user/followers");
  if (user.screen_name && String(user.screen_name).toLowerCase() !== username.toLowerCase()) {
    throw new Error(`FxTwitter returned different handle ${user.screen_name}`);
  }
  return {
    ...cleanBase(row),
    capturedAt,
    sourceType: "X_FXTWITTER_V2_PROFILE",
    sourceUrl: url,
    providerPlatform: "x",
    providerHandle: user.screen_name ?? username,
    providerName: user.name ?? row.entityName,
    followers,
    following: numericOrNull(user.following),
    posts: numericOrNull(user.statuses),
    likes: numericOrNull(user.likes),
    views: null,
    verified: user.verification?.verified ?? null,
    avatar: user.avatar_url ?? null,
    audienceMetric: "FOLLOWERS",
    precision: "PUBLIC_EXACT",
    engagementMetric: null,
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
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; FxTwitter fallback skipped.`);
    return;
  }

  const targets = snapshot.accounts.filter((row) => row.platform === "X" && row.error);
  if (!targets.length) {
    console.log("No failed X rows require FxTwitter fallback.");
    return;
  }

  const replacements = new Map();
  const capturedAt = new Date().toISOString();
  const errors = [];
  for (let index = 0; index < targets.length; index += 1) {
    const row = targets[index];
    try {
      replacements.set(accountKey(row), await fetchProfile(row, capturedAt));
    } catch (error) {
      errors.push(`${row.handle}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (index + 1 < targets.length) await sleep(90);
  }

  if (!replacements.size) {
    console.warn(`FxTwitter fallback recovered 0/${targets.length}. ${errors.slice(0, 3).join(" | ")}`);
    return;
  }

  const accounts = snapshot.accounts.map((row) => replacements.get(accountKey(row)) ?? row);
  const failedRows = accounts.filter((row) => row.error);
  const imputedRows = accounts.filter((row) => !row.error && row.imputed === true);
  const observedRows = accounts.filter((row) => !row.error && !row.imputed);
  const next = {
    ...snapshot,
    complete: failedRows.length === 0,
    observedComplete: failedRows.length === 0 && imputedRows.length === 0,
    successful: accounts.length - failedRows.length,
    observedSuccessful: observedRows.length,
    failed: failedRows.length,
    imputed: imputedRows.length,
    lastFxTwitterFallbackAt: capturedAt,
    xFxTwitterHealth: {
      attempted: targets.length,
      success: replacements.size,
      failed: targets.length - replacements.size,
      lastErrors: errors.slice(-3),
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };
  await writeSnapshot(next);
  console.log(`FxTwitter fallback recovered ${replacements.size}/${targets.length}; ${failedRows.length} total row(s) still unavailable.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
