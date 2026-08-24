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

function extractJsonText(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const simple = new RegExp(`"${escaped}":\\{"simpleText":"([^"]+)"`).exec(html)?.[1];
  if (simple) return simple;
  const runs = new RegExp(`"${escaped}":\\{"runs":\\[\\{"text":"([^"]+)"`).exec(html)?.[1];
  return runs ?? null;
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1]
    ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i").exec(html)?.[1]
    ?? null;
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

  if (!account.platformId) {
    sourceUrl.pathname = `${sourceUrl.pathname.replace(/\/$/, "")}/about`;
  }
  sourceUrl.search = "";
  sourceUrl.searchParams.set("hl", "en");
  sourceUrl.searchParams.set("persist_hl", "1");

  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 kawaii-lab-stats/0.5",
    },
  });

  if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
  const html = await response.text();

  const subscriberText = extractJsonText(html, "subscriberCountText")
    ?? html.match(/([0-9.,]+\s*[KMB]?)\s+subscribers/i)?.[1]
    ?? null;
  const viewText = extractJsonText(html, "viewCountText")
    ?? html.match(/([0-9.,]+\s*[KMB]?)\s+views/i)?.[1]
    ?? null;
  const videoText = extractJsonText(html, "videosCountText")
    ?? extractJsonText(html, "videoCountText")
    ?? html.match(/([0-9.,]+\s*[KMB]?)\s+videos/i)?.[1]
    ?? null;

  const followers = parseHumanCount(subscriberText);
  if (!Number.isFinite(followers)) throw new Error("YouTube subscriber count was not found on the public About page");

  return {
    platform: "youtube",
    handle: account.handle,
    name: extractMeta(html, "og:title") ?? account.entityName,
    followers,
    following: null,
    posts: parseHumanCount(videoText),
    likes: null,
    views: parseHumanCount(viewText),
    viewsPrecision: viewText && /[KMB]/i.test(viewText) ? "PUBLIC_ABBREVIATED" : viewText ? "PUBLIC_EXACT" : null,
    verified: null,
    avatar: extractMeta(html, "og:image"),
    sourceUrl: sourceUrl.toString(),
  };
}

function summarize(snapshot, primaryGroups) {
  const followerRows = snapshot.accounts.filter((account) => !account.error && Number.isFinite(account.followers));
  const metricRows = snapshot.accounts.filter((account) => !account.error);
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

  const date = jstDateKey();
  const historyFile = path.join(HISTORY_DIR, `${date}.json`);

  if (await exists(historyFile)) {
    const previous = await readJson(historyFile);
    if (previous.complete) {
      console.log(`Daily collection already completed for ${date} JST; no profile URLs will be accessed again.`);
      return;
    }
  }

  const { accounts, primaryGroups } = await loadDirectory();
  const collectedAt = new Date().toISOString();
  const observations = [];
  const errors = [];
  const pulseAccounts = accounts.filter((account) => account.platform !== "YOUTUBE");
  const youtubeAccounts = accounts.filter((account) => account.platform === "YOUTUBE");

  console.log(`Daily public-profile collection: ${accounts.length} unique accounts for ${date} JST.`);
  console.log(`Pulse profiles: ${pulseAccounts.length}; direct YouTube About pages: ${youtubeAccounts.length}.`);

  for (let offset = 0; offset < pulseAccounts.length; offset += BATCH_SIZE) {
    const batch = pulseAccounts.slice(offset, offset + BATCH_SIZE);
    const batchNo = Math.floor(offset / BATCH_SIZE) + 1;
    const batchCount = Math.ceil(pulseAccounts.length / BATCH_SIZE);
    console.log(`Pulse batch ${batchNo}/${batchCount}: ${batch.length} profiles`);

    try {
      const results = await fetchPulseBatch(batch);
      for (let index = 0; index < batch.length; index += 1) {
        const account = batch[index];
        const result = results[index] ?? { error: "missing_result" };
        const base = { ...account, capturedAt: collectedAt, sourceType: "PULSE_PUBLIC_PROFILE" };

        if (result.error) {
          const error = String(result.error);
          observations.push({ ...base, error, detail: result.detail ?? null });
          errors.push(`${account.entityName} ${account.platform} @${account.handle}: ${error}`);
          continue;
        }

        observations.push({
          ...base,
          providerPlatform: result.platform ?? null,
          providerHandle: result.handle ?? null,
          providerName: result.name ?? null,
          followers: numericOrNull(result.followers),
          following: numericOrNull(result.following),
          posts: numericOrNull(result.posts),
          likes: numericOrNull(result.likes),
          views: numericOrNull(result.views),
          verified: typeof result.verified === "boolean" ? result.verified : null,
          avatar: result.avatar ?? null,
          audienceMetric: "FOLLOWERS",
          precision: "PUBLIC_PROFILE",
          engagementMetric: account.platform === "TIKTOK" ? "TOTAL_LIKES" : null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const account of batch) {
        observations.push({ ...account, capturedAt: collectedAt, sourceType: "PULSE_PUBLIC_PROFILE", error: "batch_failed", detail: message });
        errors.push(`${account.entityName} ${account.platform} @${account.handle}: ${message}`);
      }
    }

    if (offset + BATCH_SIZE < pulseAccounts.length) await sleep(BATCH_DELAY_MS);
  }

  for (let index = 0; index < youtubeAccounts.length; index += 1) {
    const account = youtubeAccounts[index];
    const base = { ...account, capturedAt: collectedAt, sourceType: "YOUTUBE_PUBLIC_ABOUT" };
    console.log(`YouTube ${index + 1}/${youtubeAccounts.length}: ${account.entityName} ${account.handle}`);

    try {
      const result = await fetchYouTubeProfile(account);
      observations.push({
        ...base,
        sourceUrl: result.sourceUrl,
        providerPlatform: result.platform,
        providerHandle: result.handle,
        providerName: result.name,
        followers: result.followers,
        following: null,
        posts: result.posts,
        likes: null,
        views: result.views,
        viewsPrecision: result.viewsPrecision,
        verified: null,
        avatar: result.avatar,
        audienceMetric: "SUBSCRIBERS",
        precision: "PUBLIC_ABBREVIATED",
        engagementMetric: "TOTAL_CHANNEL_VIEWS",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      observations.push({ ...base, error: "youtube_public_about_failed", detail: message });
      errors.push(`${account.entityName} ${account.platform} @${account.handle}: youtube_public_about_failed`);
    }

    if (index + 1 < youtubeAccounts.length) await sleep(YOUTUBE_DELAY_MS);
  }

  const successful = observations.filter((row) => !row.error && Number.isFinite(row.followers)).length;
  const snapshot = {
    date,
    collectedAt,
    complete: true,
    attempted: accounts.length,
    successful,
    failed: accounts.length - successful,
    source: {
      method: "one-public-profile-read-per-account-per-jst-day",
      note: "X/Instagram/TikTok use Pulse profile reads; YouTube uses one public channel About-page read so subscriber/video/view totals are captured without a second channel access.",
    },
    sources: [
      { name: "Pulse", url: "https://pulse.walls.sh/docs", platforms: ["X", "INSTAGRAM", "TIKTOK"] },
      { name: "YouTube public About page", url: "https://www.youtube.com/", platforms: ["YOUTUBE"] },
    ],
    accounts: observations,
    errors,
  };

  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(historyFile, serialized);
  await writeFile(path.join(LIVE_DIR, "latest.json"), serialized);
  await writeFile(path.join(PUBLIC_DATA_DIR, "latest.json"), serialized);
  await mkdir(path.join(PUBLIC_DATA_DIR, "history"), { recursive: true });
  await writeFile(path.join(PUBLIC_DATA_DIR, "history", `${date}.json`), serialized);
  await rebuildSeries(primaryGroups);

  console.log(`Saved ${successful}/${accounts.length} follower/subscriber observations for ${date} JST.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
