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

async function fetchBatch(batch) {
  const url = new URL("https://pulse.walls.sh/profile/batch");
  for (const account of batch) url.searchParams.append("url", account.profileUrl);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "kawaii-lab-stats/0.4 (+https://github.com/ProtChan/kawaii-lab-stats)",
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

function summarize(snapshot, primaryGroups) {
  const good = snapshot.accounts.filter((account) => !account.error && Number.isFinite(account.followers));
  const groups = {};

  for (const group of primaryGroups) {
    const rows = good.filter((account) => account.groupSlug === group.slug);
    const officialRows = rows.filter((account) => account.entityType === "GROUP" && account.entitySlug === group.slug);
    const memberRows = rows.filter((account) => account.entityType === "MEMBER");
    const sum = (items) => items.reduce((total, item) => total + item.followers, 0);
    const platforms = { X: 0, Instagram: 0, TikTok: 0, YouTube: 0 };
    for (const row of rows) platforms[normalizePlatform(row.platform)] += row.followers;

    groups[group.slug] = {
      name: group.name,
      official: sum(officialRows),
      members: sum(memberRows),
      ecosystem: sum(rows),
      platforms,
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

  console.log(`Daily public-profile collection: ${accounts.length} unique accounts for ${date} JST.`);

  for (let offset = 0; offset < accounts.length; offset += BATCH_SIZE) {
    const batch = accounts.slice(offset, offset + BATCH_SIZE);
    const batchNo = Math.floor(offset / BATCH_SIZE) + 1;
    const batchCount = Math.ceil(accounts.length / BATCH_SIZE);
    console.log(`Batch ${batchNo}/${batchCount}: ${batch.length} profiles`);

    try {
      const results = await fetchBatch(batch);
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
          verified: typeof result.verified === "boolean" ? result.verified : null,
          avatar: result.avatar ?? null,
          audienceMetric: account.platform === "YOUTUBE" ? "SUBSCRIBERS" : "FOLLOWERS",
          precision: account.platform === "YOUTUBE" ? "PUBLIC_ABBREVIATED" : "PUBLIC_PROFILE",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const account of batch) {
        observations.push({ ...account, capturedAt: collectedAt, sourceType: "PULSE_PUBLIC_PROFILE", error: "batch_failed", detail: message });
        errors.push(`${account.entityName} ${account.platform} @${account.handle}: ${message}`);
      }
    }

    if (offset + BATCH_SIZE < accounts.length) await sleep(BATCH_DELAY_MS);
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
      name: "Pulse",
      url: "https://pulse.walls.sh/docs",
      method: "public-profile-read",
      note: "One scheduled lookup per canonical account per JST day; no same-day retries.",
    },
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
