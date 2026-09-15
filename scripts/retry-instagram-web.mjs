import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

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

function cleanBase(row) {
  const {
    error,
    detail,
    capturedAt,
    sourceType,
    sourceUrl,
    providerPlatform,
    providerHandle,
    providerName,
    followers,
    following,
    posts,
    likes,
    views,
    viewsPrecision,
    verified,
    avatar,
    parserVersion,
    audienceMetric,
    precision,
    engagementMetric,
    imputed,
    imputationMethod,
    imputedFromDate,
    imputedFromCapturedAt,
    imputedAt,
    imputedSourceType,
    acquisitionError,
    ...base
  } = row;
  return base;
}

function instagramHeaders(username) {
  return {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "198387",
    Referer: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  };
}

async function readResponseJson(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}: ${text.slice(0, 180)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 180)}`);
  }
}

function mapInstagramUser(user, username, sourceUrl, sourceType) {
  if (!user || typeof user !== "object") throw new Error(`${sourceType} returned no user`);
  const followers = numericOrNull(user.edge_followed_by?.count ?? user.follower_count ?? user.followers_count);
  const following = numericOrNull(user.edge_follow?.count ?? user.following_count);
  const posts = numericOrNull(user.edge_owner_to_timeline_media?.count ?? user.media_count);
  if (followers == null) throw new Error(`${sourceType} returned no follower count`);
  return {
    username: user.username ?? username,
    name: user.full_name ?? username,
    followers,
    following,
    posts,
    verified: user.is_verified ?? null,
    avatar: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
    sourceUrl,
    sourceType,
  };
}

async function fetchInstagramWebProfile(row) {
  const username = String(row.handle).replace(/^@/, "");
  const headers = instagramHeaders(username);
  const errors = [];

  const webUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  try {
    const response = await fetch(webUrl, { redirect: "follow", headers });
    const payload = await readResponseJson(response, "Instagram web_profile_info");
    return mapInstagramUser(payload?.data?.user, username, webUrl, "INSTAGRAM_WEB_PROFILE_INFO");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const feedUrl = `https://www.instagram.com/api/v1/feed/user/${encodeURIComponent(username)}/username/?count=1`;
  try {
    const response = await fetch(feedUrl, { redirect: "follow", headers });
    const payload = await readResponseJson(response, "Instagram feed-by-username");
    const feedUser = payload?.user;
    if (numericOrNull(feedUser?.follower_count) != null) return mapInstagramUser(feedUser, username, feedUrl, "INSTAGRAM_FEED_USERNAME");

    const pk = String(feedUser?.pk ?? "").trim();
    if (!/^\d+$/.test(pk)) throw new Error("Instagram feed-by-username returned no valid profile id");
    const infoUrl = `https://www.instagram.com/api/v1/users/${pk}/info/`;
    const infoResponse = await fetch(infoUrl, { redirect: "follow", headers });
    const infoPayload = await readResponseJson(infoResponse, "Instagram users info");
    return mapInstagramUser(infoPayload?.user, username, infoUrl, "INSTAGRAM_USER_INFO");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(errors.join(" | "));
}

async function writeSnapshot(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const historyPath = path.join(LIVE_DIR, "history", `${snapshot.date}.json`);
  const publicHistoryPath = path.join(PUBLIC_DATA_DIR, "history", `${snapshot.date}.json`);
  await mkdir(path.dirname(publicHistoryPath), { recursive: true });
  await writeFile(historyPath, serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(publicHistoryPath, serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
}

async function main() {
  const latestPath = path.join(LIVE_DIR, "latest.json");
  const snapshot = await readJson(latestPath);
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; Instagram fallback skipped.`);
    return;
  }

  const targets = snapshot.accounts.filter((row) => row.platform === "INSTAGRAM" && (row.error || row.imputed === true));
  if (!targets.length) {
    console.log("No failed or imputed Instagram rows require web fallback.");
    return;
  }

  console.log(`Trying Instagram web/feed fallback for ${targets.length} row(s).`);
  const replacements = new Map();
  const failures = [];
  const capturedAt = new Date().toISOString();

  for (let index = 0; index < targets.length; index += 1) {
    const row = targets[index];
    try {
      const profile = await fetchInstagramWebProfile(row);
      replacements.set(accountKey(row), {
        ...cleanBase(row),
        capturedAt,
        sourceType: profile.sourceType,
        sourceUrl: profile.sourceUrl,
        providerPlatform: "instagram",
        providerHandle: profile.username,
        providerName: profile.name,
        followers: profile.followers,
        following: profile.following,
        posts: profile.posts,
        likes: null,
        views: null,
        verified: profile.verified,
        avatar: profile.avatar,
        audienceMetric: "FOLLOWERS",
        precision: "PUBLIC_PROFILE",
        engagementMetric: null,
      });
      console.log(`Recovered Instagram @${row.handle} via ${profile.sourceType}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${row.entitySlug}:${row.handle}: ${message}`);
      if (failures.length <= 5) console.warn(`Instagram fallback failed @${row.handle}: ${message}`);
    }
    if (index + 1 < targets.length) await sleep(650);
  }

  if (!replacements.size) {
    console.warn(`Instagram web/feed fallback recovered 0/${targets.length}; ${failures.length} still unavailable.`);
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
    lastAttemptAt: capturedAt,
    source: {
      ...(snapshot.source ?? {}),
      instagramFallback: "WEB_PROFILE_INFO_THEN_FEED_USERNAME",
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  await writeSnapshot(next);
  console.log(`Instagram fallback recovered ${replacements.size}/${targets.length}; observed=${observedRows.length}, imputed=${imputedRows.length}, failed=${failedRows.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
