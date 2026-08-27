import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIRECTORY_DIR = path.join(ROOT, "data", "directory");
const LIVE_DIR = path.join(ROOT, "data", "live");
const HISTORY_DIR = path.join(LIVE_DIR, "history");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const SUPPORTED = new Set(["X", "INSTAGRAM", "TIKTOK", "YOUTUBE"]);
const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 25_000;
const YOUTUBE_DELAY_MS = 750;
const YOUTUBE_PARSER_VERSION = "ABOUT_CHANNEL_VIEW_MODEL_V1";
const COLLECTION_WINDOW_START_MINUTE = 0;
const COLLECTION_WINDOW_END_MINUTE = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function jstParts(date = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function jstDateKey(date = new Date()) {
  const parts = jstParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function jstMinuteOfDay(date = new Date()) {
  const parts = jstParts(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function withinCollectionWindow(date = new Date()) {
  const minute = jstMinuteOfDay(date);
  return minute >= COLLECTION_WINDOW_START_MINUTE && minute <= COLLECTION_WINDOW_END_MINUTE;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function normalizePlatform(platform) {
  return platform === "YOUTUBE" ? "YouTube" : platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : "X";
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseHumanCount(text) {
  if (!text) return null;
  const normalized = String(text).replace(/,/g, "").trim();
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const multiplier = match[2]?.toUpperCase() === "K" ? 1_000 : match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "B" ? 1_000_000_000 : 1;
  return Math.round(value * multiplier);
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1]
    ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i").exec(html)?.[1]
    ?? null;
}

function extractJsonObjectAfterKey(text, key) {
  const needle = `"${key}":`;
  let from = 0;

  while (from < text.length) {
    const keyIndex = text.indexOf(needle, from);
    if (keyIndex < 0) return null;
    let start = keyIndex + needle.length;
    while (/\s/.test(text[start] ?? "")) start += 1;
    if (text[start] !== "{") {
      from = start + 1;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
    from = start + 1;
  }
  return null;
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.runs)) {
    const combined = value.runs.map((run) => run?.text).filter((text) => typeof text === "string").join("");
    return combined || null;
  }
  return null;
}

async function loadDirectory() {
  const files = (await readdir(DIRECTORY_DIR)).filter((file) => file.endsWith(".json")).sort();
  const accounts = [];
  const primaryGroups = [];

  for (const file of files) {
    const data = await readJson(path.join(DIRECTORY_DIR, file));
    if (data.type === "PROJECT") {
      for (const account of data.accounts ?? []) {
        if (!SUPPORTED.has(account.platform) || !account.url) continue;
        accounts.push({
          entitySlug: data.slug,
          entityName: data.name,
          entityType: "PROJECT",
          groupSlug: null,
          groupName: null,
          platform: account.platform,
          handle: account.handle,
          platformId: account.platformId ?? null,
          profileUrl: account.url,
        });
      }
      continue;
    }

    if (data.category === "DEBUTED") primaryGroups.push({ slug: data.slug, name: data.name });

    for (const account of data.accounts ?? []) {
      if (!SUPPORTED.has(account.platform) || !account.url) continue;
      accounts.push({
        entitySlug: data.slug,
        entityName: data.name,
        entityType: "GROUP",
        groupSlug: data.slug,
        groupName: data.name,
        category: data.category,
        platform: account.platform,
        handle: account.handle,
        platformId: account.platformId ?? null,
        profileUrl: account.url,
      });
    }

    for (const member of data.members ?? []) {
      if (member.relationOnly) continue;
      for (const account of member.accounts ?? []) {
        if (!SUPPORTED.has(account.platform) || !account.url) continue;
        accounts.push({
          entitySlug: member.slug,
          entityName: member.name,
          entityType: "MEMBER",
          entityStatus: member.status ?? "ACTIVE",
          groupSlug: data.slug,
          groupName: data.name,
          category: data.category,
          platform: account.platform,
          handle: account.handle,
          platformId: account.platformId ?? null,
          profileUrl: account.url,
        });
      }
    }
  }

  const unique = new Map();
  for (const account of accounts) {
    const key = `${account.platform}:${String(account.handle).toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, account);
  }

  return { accounts: [...unique.values()], primaryGroups };
}

async function fetchPulseBatch(batch) {
  const url = new URL("https://pulse.walls.sh/profile/batch");
  for (const account of batch) url.searchParams.append("url", account.profileUrl);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "kawaii-lab-stats/0.5 (+https://github.com/ProtChan/kawaii-lab-stats)",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pulse HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error("Pulse response did not contain results[]");
  return payload.results;
}

async function fetchYouTubeProfile(account) {
  const sourceUrl = account.platformId
    ? new URL(`https://www.youtube.com/channel/${account.platformId}/about`)
    : new URL(account.profileUrl);

  if (!account.platformId) sourceUrl.pathname = `${sourceUrl.pathname.replace(/\/$/, "")}/about`;
  sourceUrl.search = "";
  sourceUrl.searchParams.set("hl", "en");
  sourceUrl.searchParams.set("persist_hl", "1");

  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 kawaii-lab-stats/0.6",
    },
  });

  if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
  const html = await response.text();
  const about = extractJsonObjectAfterKey(html, "aboutChannelViewModel");
  if (!about) throw new Error("YouTube aboutChannelViewModel was not found");

  const subscriberText = textValue(about.subscriberCountText);
  const viewText = textValue(about.viewCountText);
  const videoText = textValue(about.videoCountText) ?? textValue(about.videosCountText);
  const followers = parseHumanCount(subscriberText);
  const views = parseHumanCount(viewText);
  const posts = parseHumanCount(videoText);

  if (!Number.isFinite(followers)) throw new Error("YouTube subscriber count was not found in aboutChannelViewModel");
  if (!Number.isFinite(views)) throw new Error("YouTube channel view count was not found in aboutChannelViewModel");

  return {
    platform: "youtube",
    handle: account.handle,
    name: extractMeta(html, "og:title") ?? account.entityName,
    followers,
    following: null,
    posts,
    likes: null,
    views,
    viewsPrecision: viewText && /[KMB]/i.test(viewText) ? "PUBLIC_ABBREVIATED" : "PUBLIC_EXACT",
    verified: null,
    avatar: extractMeta(html, "og:image"),
    sourceUrl: sourceUrl.toString(),
    parserVersion: YOUTUBE_PARSER_VERSION,
  };
}

function summarize(snapshot, primaryGroups) {
  const trusted = (account) => account.platform !== "YOUTUBE" || account.parserVersion === YOUTUBE_PARSER_VERSION;
  const followerRows = snapshot.accounts.filter((account) => !account.error && trusted(account) && Number.isFinite(account.followers));
  const metricRows = snapshot.accounts.filter((account) => !account.error && trusted(account));
  const groups = {};

  const sumMetric = (items, key) => {
    const values = items.map((item) => item[key]).filter((value) => Number.isFinite(value));
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

    groups[group.slug] = {
      name: group.name,
      official: sum(officialRows),
      members: sum(memberRows),
      ecosystem: sum(rows),
      platforms,
      youtubeViews: sumMetric(youtubeRows, "views"),
      youtubeViewAccounts: youtubeRows.filter((row) => Number.isFinite(row.views)).length,
      tiktokLikes: sumMetric(tiktokRows, "likes"),
      tiktokLikeAccounts: tiktokRows.filter((row) => Number.isFinite(row.likes)).length,
      observedAccounts: rows.length,
      expectedAccounts: snapshot.accounts.filter((account) => account.groupSlug === group.slug).length,
    };
  }

  return { date: snapshot.date, collectedAt: snapshot.collectedAt, groups };
}

async function rebuildSeries(primaryGroups) {
  const files = (await readdir(HISTORY_DIR)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const series = [];
  for (const file of files) {
    const snapshot = await readJson(path.join(HISTORY_DIR, file));
    series.push(summarize(snapshot, primaryGroups));
  }
  await writeFile(path.join(LIVE_DIR, "series.json"), `${JSON.stringify(series, null, 2)}\n`);
  await writeFile(path.join(PUBLIC_DATA_DIR, "series.json"), `${JSON.stringify(series, null, 2)}\n`);
}

async function main() {
  await mkdir(HISTORY_DIR, { recursive: true });
  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  const now = new Date();
  const date = jstDateKey(now);
  const historyPath = path.join(HISTORY_DIR, `${date}.json`);
  const publicHistoryPath = path.join(PUBLIC_DATA_DIR, "history", `${date}.json`);
  await mkdir(path.dirname(publicHistoryPath), { recursive: true });

  if (await exists(historyPath)) {
    const existing = await readJson(historyPath);
    if (existing.complete) {
      console.log(`Daily snapshot ${date} already exists; no public profile requests will be made.`);
      return;
    }
  }

  if (!withinCollectionWindow(now)) {
    const parts = jstParts(now);
    throw new Error(`Refusing public profile collection at ${parts.hour}:${parts.minute} JST. Production window is 00:00-02:00 JST.`);
  }

  const { accounts, primaryGroups } = await loadDirectory();
  const capturedAt = now.toISOString();
  const results = [];
  const errors = [];

  const pulseAccounts = accounts.filter((account) => account.platform !== "YOUTUBE");
  for (let offset = 0; offset < pulseAccounts.length; offset += BATCH_SIZE) {
    const batch = pulseAccounts.slice(offset, offset + BATCH_SIZE);
    try {
      const responseRows = await fetchPulseBatch(batch);
      for (let index = 0; index < batch.length; index += 1) {
        const account = batch[index];
        const row = responseRows[index] ?? {};
        const error = row.error ? String(row.error) : null;
        results.push({
          ...account,
          capturedAt,
          sourceType: "PULSE_PUBLIC_PROFILE",
          providerPlatform: row.platform ?? null,
          providerHandle: row.handle ?? null,
          providerName: row.name ?? null,
          followers: error ? null : numericOrNull(row.followers),
          following: error ? null : numericOrNull(row.following),
          posts: error ? null : numericOrNull(row.posts),
          likes: error ? null : numericOrNull(row.likes),
          views: null,
          verified: error ? null : row.verified ?? null,
          avatar: error ? null : row.avatar ?? null,
          audienceMetric: account.platform === "YOUTUBE" ? "SUBSCRIBERS" : "FOLLOWERS",
          precision: "PUBLIC_PROFILE",
          engagementMetric: account.platform === "TIKTOK" && !error ? "TOTAL_LIKES" : null,
          ...(error ? { error, detail: row.detail ?? null } : {}),
        });
        if (error) errors.push(`${account.entitySlug}:${account.platform}:${account.handle}: ${error}`);
      }
    } catch (error) {
      for (const account of batch) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ...account, capturedAt, sourceType: "PULSE_PUBLIC_PROFILE", followers: null, following: null, posts: null, likes: null, views: null, error: "batch_failed", detail: message });
        errors.push(`${account.entitySlug}:${account.platform}:${account.handle}: ${message}`);
      }
    }
    if (offset + BATCH_SIZE < pulseAccounts.length) await sleep(BATCH_DELAY_MS);
  }

  const youtubeAccounts = accounts.filter((account) => account.platform === "YOUTUBE");
  for (let index = 0; index < youtubeAccounts.length; index += 1) {
    const account = youtubeAccounts[index];
    try {
      const row = await fetchYouTubeProfile(account);
      results.push({
        ...account,
        capturedAt,
        sourceType: "YOUTUBE_PUBLIC_ABOUT",
        sourceUrl: row.sourceUrl,
        providerPlatform: "youtube",
        providerHandle: row.handle,
        providerName: row.name,
        followers: numericOrNull(row.followers),
        following: null,
        posts: numericOrNull(row.posts),
        likes: null,
        views: numericOrNull(row.views),
        viewsPrecision: row.viewsPrecision,
        verified: null,
        avatar: row.avatar,
        parserVersion: row.parserVersion,
        audienceMetric: "SUBSCRIBERS",
        precision: "PUBLIC_ABBREVIATED",
        engagementMetric: "TOTAL_CHANNEL_VIEWS",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...account, capturedAt, sourceType: "YOUTUBE_PUBLIC_ABOUT", followers: null, following: null, posts: null, likes: null, views: null, parserVersion: YOUTUBE_PARSER_VERSION, error: "youtube_about_failed", detail: message });
      errors.push(`${account.entitySlug}:${account.platform}:${account.handle}: ${message}`);
    }
    if (index + 1 < youtubeAccounts.length) await sleep(YOUTUBE_DELAY_MS);
  }

  const snapshot = {
    date,
    collectedAt: capturedAt,
    complete: true,
    attempted: accounts.length,
    successful: results.filter((row) => !row.error).length,
    failed: results.filter((row) => row.error).length,
    source: {
      method: "one-public-profile-read-per-account-per-jst-day",
      note: "X/Instagram/TikTok use Pulse profile reads; YouTube uses aboutChannelViewModel from one public channel About-page read. Production observations are accepted only from 00:00-02:00 JST.",
    },
    sources: [
      { name: "Pulse", url: "https://pulse.walls.sh/docs", platforms: ["X", "INSTAGRAM", "TIKTOK"] },
      { name: "YouTube public About page", url: "https://www.youtube.com/", platforms: ["YOUTUBE"], parserVersion: YOUTUBE_PARSER_VERSION },
    ],
    accounts: results,
    errors,
  };

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(historyPath, serialized);
  await writeFile(publicHistoryPath, serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
  await rebuildSeries(primaryGroups);

  console.log(`Daily snapshot ${date}: ${snapshot.successful}/${snapshot.attempted} profiles captured.`);
  if (errors.length) console.warn(`${errors.length} profile(s) unavailable; stored as missing.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});