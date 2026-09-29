import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const accountKey = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;
const MIRROR_RETRY_MS = 6 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function decodeHtml(text) {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function plainText(html) {
  return decodeHtml(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function parseInteger(value) {
  const normalized = String(value ?? "").replace(/[,\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function parseCompact(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMB])?$/i);
  if (!match) return null;
  const scale = !match[2] ? 1 : match[2].toUpperCase() === "K" ? 1e3 : match[2].toUpperCase() === "M" ? 1e6 : 1e9;
  return Math.round(Number(match[1]) * scale);
}

async function fetchText(url, label) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}: ${body.slice(0, 160)}`);
  return body;
}

async function fetchWoomy(username) {
  const url = `https://item.woomy.me/analysis/instagrammer_info.php?instagrammer_user_id=${encodeURIComponent(username)}&map_date=week`;
  const text = plainText(await fetchText(url, "Woomy"));
  const idMatch = text.match(/インスタグラムID\s*[|：:]?\s*([A-Za-z0-9._]+)/i);
  if (!idMatch || idMatch[1].toLowerCase() !== username.toLowerCase()) throw new Error("Woomy profile identity did not match");
  const metrics = text.match(/投稿数\s*([\d,]+)\s*フォロワー\s*([\d,]+)\s*フォロー中\s*([\d,]+)/);
  if (!metrics) throw new Error("Woomy follower metrics not found");
  const posts = parseInteger(metrics[1]);
  const followers = parseInteger(metrics[2]);
  const following = parseInteger(metrics[3]);
  if (followers == null) throw new Error("Woomy follower count invalid");
  return { followers, following, posts, sourceUrl: url, sourceType: "INSTAGRAM_WOOMY_PUBLIC_MIRROR", precision: "PUBLIC_MIRROR_EXACT" };
}

async function fetchImginnFrom(url, username, label) {
  const text = plainText(await fetchText(url, label));
  const escaped = username.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const profile = new RegExp(`@${escaped}\\s+([\\d.,]+\\s*[KMB]?)\\s+followers\\s+([\\d.,]+\\s*[KMB]?)\\s+following`, "i").exec(text);
  if (!profile) throw new Error(`${label} profile metrics not found`);
  const followers = parseCompact(profile[1]);
  const following = parseCompact(profile[2]);
  if (followers == null) throw new Error(`${label} follower count invalid`);
  return { followers, following, posts: null, sourceUrl: `https://imginn.com/${encodeURIComponent(username)}/`, sourceType: "INSTAGRAM_IMGINN_PUBLIC_MIRROR", precision: "PUBLIC_MIRROR_ABBREVIATED" };
}

async function fetchImginn(username) {
  const target = `https://imginn.com/${encodeURIComponent(username)}/`;
  try {
    return await fetchImginnFrom(target, username, "Imginn");
  } catch (directError) {
    const proxy = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`;
    try {
      return await fetchImginnFrom(proxy, username, "Imginn via CodeTabs");
    } catch (proxyError) {
      throw new Error(`${directError instanceof Error ? directError.message : directError} | ${proxyError instanceof Error ? proxyError.message : proxyError}`);
    }
  }
}

function mirrorRow(row, mirror, snapshotDate, capturedAt) {
  const {
    error, detail, imputed, imputationMethod, imputedFromDate, imputedFromCapturedAt,
    imputedAt, imputedSourceType, acquisitionError, nextRetryAt, retryBackoffMinutes, ...base
  } = row;
  return {
    ...base,
    capturedAt,
    sourceType: mirror.sourceType,
    sourceUrl: mirror.sourceUrl,
    providerPlatform: "instagram",
    providerHandle: String(row.handle).replace(/^@/, ""),
    providerName: row.providerName ?? row.entityName,
    followers: mirror.followers,
    following: mirror.following,
    posts: mirror.posts,
    likes: null,
    views: null,
    verified: null,
    avatar: row.avatar ?? null,
    audienceMetric: "FOLLOWERS",
    precision: mirror.precision,
    engagementMetric: null,
    imputed: true,
    imputationMethod: "PUBLIC_MIRROR",
    imputedFromDate: snapshotDate,
    imputedFromCapturedAt: capturedAt,
    imputedAt: capturedAt,
    imputedSourceType: mirror.sourceType,
    acquisitionError: acquisitionError ?? (error ? { error, detail: detail ?? null } : null),
    retryBackoffMinutes: 360,
    nextRetryAt: new Date(Date.parse(capturedAt) + MIRROR_RETRY_MS).toISOString(),
  };
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
  const snapshot = await readJson(path.join(LIVE_DIR, "latest.json"));
  const today = jstDateKey();
  if (snapshot.date !== today) {
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; Instagram mirror fallback skipped.`);
    return;
  }

  const previousAttempt = Date.parse(snapshot.instagramMirrorAttemptAt ?? "");
  const targets = snapshot.accounts.filter((row) => row.platform === "INSTAGRAM" && (row.error || row.imputed === true));
  if (!targets.length) {
    console.log("No Instagram gaps/fallback rows require mirror lookup.");
    return;
  }
  if (Number.isFinite(previousAttempt) && Date.now() - previousAttempt < MIRROR_RETRY_MS) {
    console.log(`Instagram mirror lookup is inside 6h backoff; retaining ${targets.length} fallback row(s).`);
    return;
  }

  const capturedAt = new Date().toISOString();
  const replacements = new Map();
  const routeStats = {
    INSTAGRAM_WOOMY_PUBLIC_MIRROR: { attempts: 0, success: 0, failed: 0, lastError: null },
    INSTAGRAM_IMGINN_PUBLIC_MIRROR: { attempts: 0, success: 0, failed: 0, lastError: null },
  };

  for (const row of targets) {
    const username = String(row.handle).replace(/^@/, "");
    let mirror = null;
    if (!woomyCircuitOpen) {
      try {
        routeStats.INSTAGRAM_WOOMY_PUBLIC_MIRROR.attempts += 1;
        mirror = await fetchWoomy(username);
        woomyBlockedStreak = 0;
        routeStats.INSTAGRAM_WOOMY_PUBLIC_MIRROR.success += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        routeStats.INSTAGRAM_WOOMY_PUBLIC_MIRROR.failed += 1;
        routeStats.INSTAGRAM_WOOMY_PUBLIC_MIRROR.lastError = message;
        woomyBlockedStreak = systemicBlock(message) ? woomyBlockedStreak + 1 : 0;
        if (woomyBlockedStreak >= 2) {
          woomyCircuitOpen = true;
          console.warn("Woomy circuit opened after repeated systemic failures.");
        }
      }
    }

    if (!mirror && !imginnCircuitOpen) {
      try {
        routeStats.INSTAGRAM_IMGINN_PUBLIC_MIRROR.attempts += 1;
        mirror = await fetchImginn(username);
        imginnBlockedStreak = 0;
        routeStats.INSTAGRAM_IMGINN_PUBLIC_MIRROR.success += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        routeStats.INSTAGRAM_IMGINN_PUBLIC_MIRROR.failed += 1;
        routeStats.INSTAGRAM_IMGINN_PUBLIC_MIRROR.lastError = message;
        imginnBlockedStreak = systemicBlock(message) ? imginnBlockedStreak + 1 : 0;
        if (imginnBlockedStreak >= 2) {
          imginnCircuitOpen = true;
          console.warn("Imginn circuit opened after repeated systemic failures.");
        }
      }
    }

    if (mirror) replacements.set(accountKey(row), mirrorRow(row, mirror, snapshot.date, capturedAt));
    await sleep(250);
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
    instagramMirrorAttemptAt: capturedAt,
    instagramMirrorRouteHealth: { attemptedAt: capturedAt, routes: routeStats },
    accounts,
    errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };
  await writeSnapshot(next);
  console.log(`Instagram public mirrors recovered ${replacements.size}/${targets.length}; observed=${observedRows.length}, fallback=${imputedRows.length}, hard-failed=${failedRows.length}.`);
  for (const [route, stats] of Object.entries(routeStats)) console.log(`${route}: ${stats.success}/${stats.attempts} success.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
