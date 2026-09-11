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
    verified,
    avatar,
    audienceMetric,
    precision,
    engagementMetric,
    ...base
  } = row;
  return base;
}

async function fetchInstagramWebProfile(row) {
  const username = String(row.handle).replace(/^@/, "");
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-IG-App-ID": "936619743392459",
      "X-ASBD-ID": "198387",
      Referer: `https://www.instagram.com/${encodeURIComponent(username)}/`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Instagram web_profile_info HTTP ${response.status}: ${body.slice(0, 180)}`);
  }

  const payload = await response.json();
  const user = payload?.data?.user;
  if (!user) throw new Error("Instagram web_profile_info returned no user");

  const followers = numericOrNull(user.edge_followed_by?.count ?? user.follower_count ?? user.followers_count);
  const following = numericOrNull(user.edge_follow?.count ?? user.following_count);
  const posts = numericOrNull(user.edge_owner_to_timeline_media?.count ?? user.media_count);
  if (followers == null) throw new Error("Instagram follower count was not present");

  return {
    username: user.username ?? username,
    name: user.full_name ?? row.entityName,
    followers,
    following,
    posts,
    verified: user.is_verified ?? null,
    avatar: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
    sourceUrl: url,
  };
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

  const targets = snapshot.accounts.filter((row) => row.platform === "INSTAGRAM" && row.error);
  if (!targets.length) {
    console.log("No failed Instagram rows require web fallback.");
    return;
  }

  console.log(`Trying Instagram web fallback for ${targets.length} row(s).`);
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
        sourceType: "INSTAGRAM_WEB_PROFILE_INFO",
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${row.entitySlug}:${row.handle}: ${message}`);
    }
    if (index + 1 < targets.length) await sleep(500);
  }

  if (!replacements.size) {
    console.warn(`Instagram web fallback recovered 0/${targets.length}; ${failures.length} still failed.`);
    return;
  }

  const accounts = snapshot.accounts.map((row) => replacements.get(accountKey(row)) ?? row);
  const failedRows = accounts.filter((row) => row.error);
  const next = {
    ...snapshot,
    complete: false,
    successful: accounts.length - failedRows.length,
    failed: failedRows.length,
    lastAttemptAt: capturedAt,
    source: {
      ...(snapshot.source ?? {}),
      instagramFallback: "INSTAGRAM_WEB_PROFILE_INFO",
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  await writeSnapshot(next);
  console.log(`Instagram web fallback recovered ${replacements.size}/${targets.length}; ${next.failed} total row(s) still missing.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
