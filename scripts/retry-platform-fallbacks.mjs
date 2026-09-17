import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN?.trim() || "";
const META_IG_USER_ID = process.env.META_IG_USER_ID?.trim() || "";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v24.0";
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN?.trim() || "";

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

function baseRow(row) {
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
    ...base
  } = row;
  return base;
}

function browserHeaders(extra = {}) {
  return {
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    ...extra,
  };
}

async function readText(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}: ${text.slice(0, 220)}`);
  return text;
}

async function readJsonResponse(response, label) {
  const text = await readText(response, label);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 180)}`);
  }
}

function instagramHeaders(username, cookie = "") {
  const headers = browserHeaders({
    Accept: "*/*",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "198387",
    Referer: `https://www.instagram.com/${encodeURIComponent(username)}/`,
  });
  if (cookie) headers.Cookie = cookie;
  const csrf = /(?:^|;\s*)csrftoken=([^;]+)/.exec(cookie)?.[1];
  if (csrf) headers["X-CSRFToken"] = csrf;
  return headers;
}

async function bootstrapInstagramCookie() {
  try {
    const response = await fetch("https://www.instagram.com/", {
      redirect: "follow",
      headers: browserHeaders(),
    });
    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
    return setCookies.map((value) => String(value).split(";", 1)[0]).join("; ");
  } catch {
    return "";
  }
}

function mapInstagramUser(row, user, sourceType, sourceUrl, capturedAt) {
  const followers = numericOrNull(user?.edge_followed_by?.count ?? user?.follower_count ?? user?.followers_count);
  if (followers == null) throw new Error(`${sourceType} returned no follower count`);
  return {
    ...baseRow(row),
    capturedAt,
    sourceType,
    sourceUrl,
    providerPlatform: "instagram",
    providerHandle: user?.username ?? row.handle,
    providerName: user?.full_name ?? row.entityName,
    followers,
    following: numericOrNull(user?.edge_follow?.count ?? user?.following_count),
    posts: numericOrNull(user?.edge_owner_to_timeline_media?.count ?? user?.media_count),
    likes: null,
    views: null,
    verified: user?.is_verified ?? null,
    avatar: user?.profile_pic_url_hd ?? user?.profile_pic_url ?? null,
    audienceMetric: "FOLLOWERS",
    precision: "PUBLIC_PROFILE",
    engagementMetric: null,
  };
}

async function fetchInstagramBusinessDiscovery(row, capturedAt) {
  if (!META_ACCESS_TOKEN || !META_IG_USER_ID) return null;
  const username = String(row.handle).replace(/^@/, "");
  const fields = `business_discovery.username(${username}){id,username,name,followers_count,media_count,profile_picture_url}`;
  const params = new URLSearchParams({ fields, access_token: META_ACCESS_TOKEN });
  const url = `https://graph.facebook.com/${encodeURIComponent(META_GRAPH_VERSION)}/${encodeURIComponent(META_IG_USER_ID)}?${params}`;
  const payload = await readJsonResponse(await fetch(url, { headers: { Accept: "application/json" } }), "Meta business_discovery");
  if (payload.error) throw new Error(payload.error.message ?? "Meta business_discovery failed");
  if (!payload.business_discovery) throw new Error("Meta business_discovery returned no target");
  return mapInstagramUser(row, {
    ...payload.business_discovery,
    follower_count: payload.business_discovery.followers_count,
    media_count: payload.business_discovery.media_count,
    profile_pic_url: payload.business_discovery.profile_picture_url,
  }, "INSTAGRAM_META_BUSINESS_DISCOVERY", url, capturedAt);
}

async function fetchInstagramAnonymous(row, capturedAt, cookie) {
  const username = String(row.handle).replace(/^@/, "");
  const headers = instagramHeaders(username, cookie);
  const errors = [];
  const hosts = ["i.instagram.com", "www.instagram.com"];

  for (const host of hosts) {
    const url = `https://${host}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    try {
      const payload = await readJsonResponse(await fetch(url, { redirect: "follow", headers }), `${host} web_profile_info`);
      const user = payload?.data?.user;
      if (!user) throw new Error(`${host} web_profile_info returned no user`);
      return mapInstagramUser(row, user, host === "i.instagram.com" ? "INSTAGRAM_I_WEB_PROFILE_INFO" : "INSTAGRAM_WEB_PROFILE_INFO", url, capturedAt);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const feedUrl = `https://i.instagram.com/api/v1/feed/user/${encodeURIComponent(username)}/username/?count=1`;
  try {
    const feed = await readJsonResponse(await fetch(feedUrl, { redirect: "follow", headers }), "Instagram feed-by-username");
    if (numericOrNull(feed?.user?.follower_count) != null) return mapInstagramUser(row, feed.user, "INSTAGRAM_I_FEED_USERNAME", feedUrl, capturedAt);
    const pk = String(feed?.user?.pk ?? "").trim();
    if (!/^\d+$/.test(pk)) throw new Error("Instagram feed-by-username returned no profile id");
    const infoUrl = `https://i.instagram.com/api/v1/users/${pk}/info/`;
    const info = await readJsonResponse(await fetch(infoUrl, { redirect: "follow", headers }), "Instagram users info");
    return mapInstagramUser(row, info?.user, "INSTAGRAM_I_USER_INFO", infoUrl, capturedAt);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  throw new Error(errors.join(" | "));
}

function htmlDecodeJson(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchTikTokDirect(row, capturedAt) {
  const username = String(row.handle).replace(/^@/, "");
  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const html = await readText(await fetch(url, { redirect: "follow", headers: browserHeaders() }), "TikTok public profile");
  const script = /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!script) throw new Error("TikTok hydration JSON not found");
  let data;
  try {
    data = JSON.parse(htmlDecodeJson(script.trim()));
  } catch {
    throw new Error("TikTok hydration JSON could not be parsed");
  }
  const detail = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
  const userInfo = detail?.userInfo;
  const user = userInfo?.user;
  const stats = userInfo?.statsV2 ?? userInfo?.stats;
  const followers = numericOrNull(stats?.followerCount);
  if (!user || followers == null) throw new Error("TikTok userInfo/statsV2 followerCount missing");
  if (user.uniqueId && String(user.uniqueId).toLowerCase() !== username.toLowerCase()) throw new Error("TikTok returned a different profile");
  return {
    ...baseRow(row),
    capturedAt,
    sourceType: userInfo?.statsV2 ? "TIKTOK_PUBLIC_HYDRATION_STATSV2" : "TIKTOK_PUBLIC_HYDRATION_STATS",
    sourceUrl: url,
    providerPlatform: "tiktok",
    providerHandle: user.uniqueId ?? username,
    providerName: user.nickname ?? row.entityName,
    followers,
    following: numericOrNull(stats?.followingCount),
    posts: numericOrNull(stats?.videoCount),
    likes: numericOrNull(stats?.heartCount ?? stats?.heart),
    views: null,
    verified: user.verified ?? null,
    avatar: user.avatarLarger ?? user.avatarMedium ?? user.avatarThumb ?? null,
    audienceMetric: "FOLLOWERS",
    precision: userInfo?.statsV2 ? "PUBLIC_EXACT" : "PUBLIC_PROFILE",
    engagementMetric: "TOTAL_LIKES",
  };
}

async function fetchXOfficial(row, capturedAt) {
  if (!X_BEARER_TOKEN) return null;
  const username = String(row.handle).replace(/^@/, "");
  const url = `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,verified,profile_image_url,name,username`;
  const payload = await readJsonResponse(await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${X_BEARER_TOKEN}` },
  }), "X API v2");
  const user = payload?.data;
  const followers = numericOrNull(user?.public_metrics?.followers_count);
  if (!user || followers == null) throw new Error(payload?.detail ?? "X API returned no user/public_metrics");
  return {
    ...baseRow(row),
    capturedAt,
    sourceType: "X_API_V2_PUBLIC_METRICS",
    sourceUrl: url,
    providerPlatform: "x",
    providerHandle: user.username ?? username,
    providerName: user.name ?? row.entityName,
    followers,
    following: numericOrNull(user.public_metrics?.following_count),
    posts: numericOrNull(user.public_metrics?.tweet_count),
    likes: null,
    views: null,
    verified: user.verified ?? null,
    avatar: user.profile_image_url ?? null,
    audienceMetric: "FOLLOWERS",
    precision: "PUBLIC_EXACT",
    engagementMetric: null,
  };
}

async function fetchXSyndication(row, capturedAt) {
  const username = String(row.handle).replace(/^@/, "");
  const url = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(username)}`;
  const payload = await readJsonResponse(await fetch(url, { headers: browserHeaders({ Accept: "application/json,*/*" }) }), "X syndication");
  const user = Array.isArray(payload) ? payload[0] : null;
  const followers = numericOrNull(user?.followers_count);
  if (!user || followers == null) throw new Error("X syndication returned no follower count");
  if (user.screen_name && String(user.screen_name).toLowerCase() !== username.toLowerCase()) throw new Error("X syndication returned a different profile");
  return {
    ...baseRow(row),
    capturedAt,
    sourceType: "X_PUBLIC_SYNDICATION",
    sourceUrl: url,
    providerPlatform: "x",
    providerHandle: user.screen_name ?? username,
    providerName: user.name ?? row.entityName,
    followers,
    following: null,
    posts: null,
    likes: null,
    views: null,
    verified: null,
    avatar: null,
    audienceMetric: "FOLLOWERS",
    precision: "PUBLIC_EXACT",
    engagementMetric: null,
  };
}

async function writeSnapshot(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await mkdir(path.join(PUBLIC_DATA_DIR, "history"), { recursive: true });
  await writeFile(path.join(LIVE_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "history", `${snapshot.date}.json`), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
}

async function main() {
  const snapshot = await readJson(path.join(LIVE_DIR, "latest.json"));
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; platform fallbacks skipped.`);
    return;
  }

  const targets = snapshot.accounts.filter((row) => row.error);
  if (!targets.length) {
    console.log("No failed rows require platform fallbacks.");
    return;
  }

  const capturedAt = new Date().toISOString();
  const replacements = new Map();
  const routeStats = {};
  const instagramCookie = targets.some((row) => row.platform === "INSTAGRAM") ? await bootstrapInstagramCookie() : "";
  let instagramAnonymousCircuitOpen = false;
  let instagramBlockedStreak = 0;

  const record = (route, ok, detail = null) => {
    const current = routeStats[route] ?? { attempts: 0, success: 0, failed: 0, lastError: null };
    current.attempts += 1;
    if (ok) current.success += 1;
    else {
      current.failed += 1;
      current.lastError = detail;
    }
    routeStats[route] = current;
  };

  for (const row of targets) {
    const key = accountKey(row);
    const errors = [];
    try {
      if (row.platform === "INSTAGRAM") {
        let replacement = null;
        if (META_ACCESS_TOKEN && META_IG_USER_ID) {
          try {
            replacement = await fetchInstagramBusinessDiscovery(row, capturedAt);
            record("INSTAGRAM_META_BUSINESS_DISCOVERY", true);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            record("INSTAGRAM_META_BUSINESS_DISCOVERY", false, message);
          }
        }
        if (!replacement && !instagramAnonymousCircuitOpen) {
          try {
            replacement = await fetchInstagramAnonymous(row, capturedAt, instagramCookie);
            instagramBlockedStreak = 0;
            record("INSTAGRAM_ANONYMOUS_MULTIHOST", true);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            record("INSTAGRAM_ANONYMOUS_MULTIHOST", false, message);
            if (/HTTP (401|429)|require_login|Please wait a few minutes/i.test(message)) instagramBlockedStreak += 1;
            else instagramBlockedStreak = 0;
            if (instagramBlockedStreak >= 2) {
              instagramAnonymousCircuitOpen = true;
              console.warn("Instagram anonymous fallback circuit opened after repeated blocking responses.");
            }
          }
        }
        if (replacement) replacements.set(key, replacement);
      } else if (row.platform === "TIKTOK") {
        try {
          replacements.set(key, await fetchTikTokDirect(row, capturedAt));
          record("TIKTOK_PUBLIC_HYDRATION", true);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(message);
          record("TIKTOK_PUBLIC_HYDRATION", false, message);
        }
      } else if (row.platform === "X") {
        let replacement = null;
        if (X_BEARER_TOKEN) {
          try {
            replacement = await fetchXOfficial(row, capturedAt);
            record("X_API_V2_PUBLIC_METRICS", true);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            record("X_API_V2_PUBLIC_METRICS", false, message);
          }
        }
        if (!replacement) {
          try {
            replacement = await fetchXSyndication(row, capturedAt);
            record("X_PUBLIC_SYNDICATION", true);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            record("X_PUBLIC_SYNDICATION", false, message);
          }
        }
        if (replacement) replacements.set(key, replacement);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    if (!replacements.has(key) && errors.length) {
      row.fallbackErrors = errors.slice(-4);
    }
  }

  if (!replacements.size && !Object.keys(routeStats).length) {
    console.log("No applicable platform fallback routes were attempted.");
    return;
  }

  const accounts = snapshot.accounts.map((row) => replacements.get(accountKey(row)) ?? row);
  const failedRows = accounts.filter((row) => row.error);
  const imputedRows = accounts.filter((row) => !row.error && row.imputed);
  const observedRows = accounts.filter((row) => !row.error && !row.imputed);
  const next = {
    ...snapshot,
    complete: failedRows.length === 0,
    observedComplete: failedRows.length === 0 && imputedRows.length === 0,
    successful: accounts.length - failedRows.length,
    observedSuccessful: observedRows.length,
    failed: failedRows.length,
    imputed: imputedRows.length,
    lastFallbackAt: capturedAt,
    fallbackRouteHealth: {
      attemptedAt: capturedAt,
      routes: routeStats,
    },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };
  await writeSnapshot(next);

  console.log(`Platform fallbacks recovered ${replacements.size}/${targets.length}; ${failedRows.length} row(s) still unavailable.`);
  for (const [route, stats] of Object.entries(routeStats)) console.log(`${route}: ${stats.success}/${stats.attempts} success.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
