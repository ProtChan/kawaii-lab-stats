import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;
const REFETCHER_API_KEY = process.env.REFETCHER_API_KEY?.trim() || "";
const FORCE = process.env.FORCE_INSTAGRAM_PROVIDER === "1";
const PROVIDER_RETRY_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 40;

function jstDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function profileFromResult(result) {
  return result?.profile ?? result?.data?.profile ?? result?.account ?? result?.data?.account ?? null;
}

function resultHandle(result) {
  const profile = profileFromResult(result);
  return String(
    profile?.handle ??
    profile?.username ??
    result?.handle ??
    result?.username ??
    "",
  ).replace(/^@/, "").toLowerCase();
}

function mapProviderRow(row, result, capturedAt) {
  const profile = profileFromResult(result);
  if (!profile) throw new Error("Refetcher result did not contain profile data");
  const followers = finite(
    profile.followers ??
    profile.followersCount ??
    profile.followerCount ??
    profile.metrics?.followers ??
    profile.metrics?.followerCount,
  );
  if (followers == null) throw new Error("Refetcher profile did not contain follower count");

  const following = finite(
    profile.following ??
    profile.followingCount ??
    profile.metrics?.following ??
    profile.metrics?.followingCount,
  );
  const posts = finite(
    profile.posts ??
    profile.postsCount ??
    profile.mediaCount ??
    profile.metrics?.posts ??
    profile.metrics?.postsCount,
  );
  const {
    error, detail, imputed, imputationMethod, imputedFromDate, imputedFromCapturedAt,
    imputedAt, imputedSourceType, acquisitionError, nextRetryAt, retryBackoffMinutes,
    fallbackErrors, ...base
  } = row;

  return {
    ...base,
    capturedAt,
    sourceType: "INSTAGRAM_REFETCHER_PROFILE_API",
    sourceUrl: result?.url ?? result?.profileUrl ?? row.profileUrl,
    providerPlatform: "instagram",
    providerHandle: profile.handle ?? profile.username ?? row.handle,
    providerName: profile.name ?? profile.displayName ?? row.entityName,
    followers,
    following,
    posts,
    likes: null,
    views: null,
    verified: profile.verified ?? profile.isVerified ?? null,
    avatar: profile.avatar ?? profile.profilePicture ?? profile.profilePictureUrl ?? null,
    audienceMetric: "FOLLOWERS",
    precision: "PUBLIC_PROVIDER_EXACT",
    engagementMetric: null,
    providerObservedAt: result?.scrapedAt ?? capturedAt,
  };
}

async function refetcherRequest(body) {
  const response = await fetch("https://api.refetcher.com/", {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
    headers: {
      "X-API-Key": REFETCHER_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "kawaii-lab-stats/1.0 (+https://github.com/ProtChan/kawaii-lab-stats)",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`Refetcher HTTP ${response.status}: ${text.slice(0, 240)}`);
  return payload;
}

async function fetchBatch(rows, capturedAt) {
  const usernames = rows.map((row) => String(row.handle).replace(/^@/, ""));
  const payload = await refetcherRequest({
    platform: "instagram",
    usernames,
    includeRecentPosts: false,
  });
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const mapped = new Map();

  for (const result of results) {
    if (result?.success === false) continue;
    const handle = resultHandle(result);
    if (!handle) continue;
    const row = rows.find((candidate) => String(candidate.handle).replace(/^@/, "").toLowerCase() === handle);
    if (!row) continue;
    try { mapped.set(accountKey(row), mapProviderRow(row, result, capturedAt)); } catch {}
  }
  return mapped;
}

async function fetchSingle(row, capturedAt) {
  const payload = await refetcherRequest({
    platform: "instagram",
    username: String(row.handle).replace(/^@/, ""),
    includeRecentPosts: false,
  });
  const result = Array.isArray(payload?.results) ? payload.results[0] : payload;
  if (!result || result?.success === false) throw new Error(result?.error?.message ?? "Refetcher profile lookup failed");
  return mapProviderRow(row, result, capturedAt);
}

async function writeSnapshot(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await mkdir(path.join(PUBLIC_DIR, "history"), { recursive: true });
  await writeFile(path.join(LIVE_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(PUBLIC_DIR, "latest.json"), serialized);
}

async function main() {
  if (!REFETCHER_API_KEY) {
    console.log("REFETCHER_API_KEY is not configured; exact Instagram provider fallback skipped.");
    return;
  }

  const snapshot = await readJson(path.join(LIVE_DIR, "latest.json"));
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; provider fallback skipped.`);
    return;
  }

  const targets = snapshot.accounts.filter((row) =>
    row.platform === "INSTAGRAM" && (row.error || row.imputed === true),
  );
  if (!targets.length) {
    console.log("Instagram is already fully observed; provider fallback skipped.");
    return;
  }

  const previousAttempt = Date.parse(snapshot.instagramProviderAttemptAt ?? "");
  if (!FORCE && Number.isFinite(previousAttempt) && Date.now() - previousAttempt < PROVIDER_RETRY_MS) {
    console.log(`Instagram provider lookup is inside 6h backoff; retaining ${targets.length} unresolved/fallback row(s).`);
    return;
  }

  const capturedAt = new Date().toISOString();
  const replacements = new Map();
  let batchAttempts = 0;
  let batchRecovered = 0;
  let singleAttempts = 0;
  const errors = [];

  for (let start = 0; start < targets.length; start += BATCH_SIZE) {
    const batch = targets.slice(start, start + BATCH_SIZE);
    batchAttempts += batch.length;
    try {
      const recovered = await fetchBatch(batch, capturedAt);
      for (const [key, value] of recovered) replacements.set(key, value);
      batchRecovered += recovered.size;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const unresolved = targets.filter((row) => !replacements.has(accountKey(row)));
  // Batch response formats can change. Individual retry doubles as a compatibility
  // path and only runs for rows the batch did not successfully map.
  for (const row of unresolved) {
    singleAttempts += 1;
    try {
      replacements.set(accountKey(row), await fetchSingle(row, capturedAt));
    } catch (error) {
      errors.push(`@${row.handle}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const accounts = snapshot.accounts.map((row) => replacements.get(accountKey(row)) ?? row);
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
    instagramProviderAttemptAt: capturedAt,
    instagramProviderRouteHealth: {
      attemptedAt: capturedAt,
      provider: "REFETCHER",
      targets: targets.length,
      batchAttempts,
      batchRecovered,
      singleAttempts,
      recovered: replacements.size,
      lastErrors: errors.slice(-8),
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  await writeSnapshot(next);
  console.log(`Refetcher Instagram fallback recovered ${replacements.size}/${targets.length}; observed=${observedRows.length}, imputed=${imputedRows.length}, hard-failed=${failedRows.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
