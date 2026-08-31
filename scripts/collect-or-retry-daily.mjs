import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePlatform(platform) {
  return platform === "YOUTUBE" ? "YouTube" : platform === "INSTAGRAM" ? "Instagram" : platform === "TIKTOK" ? "TikTok" : "X";
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
        accounts.push({ entitySlug: data.slug, entityName: data.name, entityType: "PROJECT", groupSlug: null, groupName: null, platform: account.platform, handle: account.handle, platformId: account.platformId ?? null, profileUrl: account.url });
      }
      continue;
    }
    if (data.category === "DEBUTED") primaryGroups.push({ slug: data.slug, name: data.name });
    for (const account of data.accounts ?? []) {
      if (!SUPPORTED.has(account.platform) || !account.url) continue;
      accounts.push({ entitySlug: data.slug, entityName: data.name, entityType: "GROUP", groupSlug: data.slug, groupName: data.name, category: data.category, platform: account.platform, handle: account.handle, platformId: account.platformId ?? null, profileUrl: account.url });
    }
    for (const member of data.members ?? []) {
      if (member.relationOnly) continue;
      for (const account of member.accounts ?? []) {
        if (!SUPPORTED.has(account.platform) || !account.url) continue;
        accounts.push({ entitySlug: member.slug, entityName: member.name, entityType: "MEMBER", entityStatus: member.status ?? "ACTIVE", groupSlug: data.slug, groupName: data.name, category: data.category, platform: account.platform, handle: account.handle, platformId: account.platformId ?? null, profileUrl: account.url });
      }
    }
  }
  const unique = new Map();
  for (const account of accounts) if (!unique.has(accountKey(account))) unique.set(accountKey(account), account);
  return { accounts: [...unique.values()], primaryGroups };
}

async function fetchPulseBatch(batch) {
  const url = new URL("https://pulse.walls.sh/profile/batch");
  for (const account of batch) url.searchParams.append("url", account.profileUrl);
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "kawaii-lab-stats/0.6 (+https://github.com/ProtChan/kawaii-lab-stats)" } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pulse HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error("Pulse response did not contain results[]");
  return payload.results;
}

async function fetchYouTubeProfile(account) {
  const sourceUrl = account.platformId ? new URL(`https://www.youtube.com/channel/${account.platformId}/about`) : new URL(account.profileUrl);
  if (!account.platformId) sourceUrl.pathname = `${sourceUrl.pathname.replace(/\/$/, "")}/about`;
  sourceUrl.search = "";
  sourceUrl.searchParams.set("hl", "en");
  sourceUrl.searchParams.set("persist_hl", "1");
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 kawaii-lab-stats/0.6" },
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
  return { handle: account.handle, name: extractMeta(html, "og:title") ?? account.entityName, followers, posts, views, viewsPrecision: viewText && /[KMB]/i.test(viewText) ? "PUBLIC_ABBREVIATED" : "PUBLIC_EXACT", avatar: extractMeta(html, "og:image"), sourceUrl: sourceUrl.toString(), parserVersion: YOUTUBE_PARSER_VERSION };
}

function cleanBase(account) {
  const { error, detail, capturedAt, sourceType, sourceUrl, providerPlatform, providerHandle, providerName, followers, following, posts, likes, views, viewsPrecision, verified, avatar, parserVersion, audienceMetric, precision, engagementMetric, ...base } = account;
  return base;
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
    groups[group.slug] = { name: group.name, official: sum(officialRows), members: sum(memberRows), ecosystem: sum(rows), platforms, youtubeViews: sumMetric(youtubeRows, "views"), youtubeViewAccounts: youtubeRows.filter((row) => Number.isFinite(row.views)).length, tiktokLikes: sumMetric(tiktokRows, "likes"), tiktokLikeAccounts: tiktokRows.filter((row) => Number.isFinite(row.likes)).length, observedAccounts: rows.length, expectedAccounts: snapshot.accounts.filter((account) => account.groupSlug === group.slug).length };
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
  const historyPath = path.join(HISTORY_DIR, `${snapshot.date}.json`);
  const publicHistoryPath = path.join(PUBLIC_DATA_DIR, "history", `${snapshot.date}.json`);
  await mkdir(path.dirname(publicHistoryPath), { recursive: true });
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(historyPath, serialized);
  await writeFile(publicHistoryPath, serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
  await rebuildSeries(primaryGroups);
}

async function runInitialCollector() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "collect-daily-public.mjs")], { cwd: ROOT, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Initial collector exited with code ${code}`)));
  });
}

async function retryExisting(snapshot, canonicalAccounts, primaryGroups) {
  const retryAt = new Date().toISOString();
  const existing = new Map(snapshot.accounts.map((row) => [accountKey(row), row]));
  const targets = canonicalAccounts.filter((account) => {
    const row = existing.get(accountKey(account));
    return !row || Boolean(row.error);
  });

  if (!targets.length) {
    const shouldNormalize = snapshot.complete !== true || snapshot.failed !== 0 || snapshot.successful !== canonicalAccounts.length || snapshot.attempted !== canonicalAccounts.length;
    if (!shouldNormalize) {
      console.log(`Daily snapshot ${snapshot.date} is complete; no public profile requests will be made.`);
      return false;
    }
    const normalized = { ...snapshot, complete: true, attempted: canonicalAccounts.length, successful: canonicalAccounts.length, failed: 0, errors: [] };
    await writeSnapshot(normalized, primaryGroups);
    return true;
  }

  console.log(`Retrying ${targets.length} failed or missing profile(s) for ${snapshot.date}.`);
  const replacements = new Map();
  const pulseTargets = targets.filter((account) => account.platform !== "YOUTUBE");
  for (let offset = 0; offset < pulseTargets.length; offset += BATCH_SIZE) {
    const batch = pulseTargets.slice(offset, offset + BATCH_SIZE);
    try {
      const responseRows = await fetchPulseBatch(batch);
      for (let index = 0; index < batch.length; index += 1) {
        const account = batch[index];
        const row = responseRows[index] ?? {};
        const error = row.error ? String(row.error) : null;
        replacements.set(accountKey(account), error
          ? { ...account, capturedAt: retryAt, sourceType: "PULSE_PUBLIC_PROFILE", followers: null, following: null, posts: null, likes: null, views: null, error, detail: row.detail ?? null }
          : { ...account, capturedAt: retryAt, sourceType: "PULSE_PUBLIC_PROFILE", providerPlatform: row.platform ?? null, providerHandle: row.handle ?? null, providerName: row.name ?? null, followers: numericOrNull(row.followers), following: numericOrNull(row.following), posts: numericOrNull(row.posts), likes: numericOrNull(row.likes), views: null, verified: row.verified ?? null, avatar: row.avatar ?? null, audienceMetric: "FOLLOWERS", precision: "PUBLIC_PROFILE", engagementMetric: account.platform === "TIKTOK" ? "TOTAL_LIKES" : null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const account of batch) replacements.set(accountKey(account), { ...account, capturedAt: retryAt, sourceType: "PULSE_PUBLIC_PROFILE", followers: null, following: null, posts: null, likes: null, views: null, error: "batch_failed", detail: message });
    }
    if (offset + BATCH_SIZE < pulseTargets.length) await sleep(BATCH_DELAY_MS);
  }

  const youtubeTargets = targets.filter((account) => account.platform === "YOUTUBE");
  for (let index = 0; index < youtubeTargets.length; index += 1) {
    const account = youtubeTargets[index];
    try {
      const row = await fetchYouTubeProfile(account);
      replacements.set(accountKey(account), { ...account, capturedAt: retryAt, sourceType: "YOUTUBE_PUBLIC_ABOUT", sourceUrl: row.sourceUrl, providerPlatform: "youtube", providerHandle: row.handle, providerName: row.name, followers: numericOrNull(row.followers), following: null, posts: numericOrNull(row.posts), likes: null, views: numericOrNull(row.views), viewsPrecision: row.viewsPrecision, verified: null, avatar: row.avatar, parserVersion: row.parserVersion, audienceMetric: "SUBSCRIBERS", precision: "PUBLIC_ABBREVIATED", engagementMetric: "TOTAL_CHANNEL_VIEWS" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      replacements.set(accountKey(account), { ...account, capturedAt: retryAt, sourceType: "YOUTUBE_PUBLIC_ABOUT", followers: null, following: null, posts: null, likes: null, views: null, parserVersion: YOUTUBE_PARSER_VERSION, error: "youtube_about_failed", detail: message });
    }
    if (index + 1 < youtubeTargets.length) await sleep(YOUTUBE_DELAY_MS);
  }

  const mergedAccounts = canonicalAccounts.map((canonical) => replacements.get(accountKey(canonical)) ?? existing.get(accountKey(canonical)) ?? { ...canonical, capturedAt: retryAt, sourceType: "RETRY_MISSING", followers: null, following: null, posts: null, likes: null, views: null, error: "retry_missing", detail: "No result was produced for this canonical account." });
  const failedRows = mergedAccounts.filter((row) => row.error);
  const errors = failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`);
  const next = {
    ...snapshot,
    complete: failedRows.length === 0,
    attempted: canonicalAccounts.length,
    successful: canonicalAccounts.length - failedRows.length,
    failed: failedRows.length,
    lastAttemptAt: retryAt,
    retryAttempts: (Number(snapshot.retryAttempts) || 0) + 1,
    source: {
      ...(snapshot.source ?? {}),
      method: "daily-public-profile-read-with-failed-row-retries",
      note: "Successful rows are retained. Only failed or newly missing canonical accounts are retried by later Actions until the JST-day snapshot is complete.",
    },
    accounts: mergedAccounts,
    errors,
  };
  await writeSnapshot(next, primaryGroups);
  console.log(`Retry result ${snapshot.date}: ${next.successful}/${next.attempted} captured; ${next.failed} still missing.`);
  return true;
}

async function normalizeInitialSnapshot(date, primaryGroups) {
  const historyPath = path.join(HISTORY_DIR, `${date}.json`);
  const snapshot = await readJson(historyPath);
  const failedRows = snapshot.accounts.filter((row) => row.error);
  const normalized = {
    ...snapshot,
    complete: failedRows.length === 0,
    successful: snapshot.accounts.length - failedRows.length,
    failed: failedRows.length,
    lastAttemptAt: snapshot.collectedAt,
    retryAttempts: 0,
    source: {
      ...(snapshot.source ?? {}),
      method: "daily-public-profile-read-with-failed-row-retries",
      note: "Successful rows are retained. Only failed or newly missing canonical accounts are retried by later Actions until the JST-day snapshot is complete.",
    },
  };
  await writeSnapshot(normalized, primaryGroups);
  console.log(`Initial snapshot ${date}: ${normalized.successful}/${normalized.attempted}; complete=${normalized.complete}.`);
}

async function main() {
  await mkdir(HISTORY_DIR, { recursive: true });
  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  const date = jstDateKey();
  const historyPath = path.join(HISTORY_DIR, `${date}.json`);
  const { accounts, primaryGroups } = await loadDirectory();

  if (!(await exists(historyPath))) {
    await runInitialCollector();
    await normalizeInitialSnapshot(date, primaryGroups);
    return;
  }

  const snapshot = await readJson(historyPath);
  await retryExisting(snapshot, accounts, primaryGroups);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
