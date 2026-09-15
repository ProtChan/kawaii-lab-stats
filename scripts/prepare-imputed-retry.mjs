import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE_DIR = path.join(ROOT, "data", "live");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

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

function clearImputation(row) {
  const {
    imputed,
    imputationMethod,
    imputedFromDate,
    imputedFromCapturedAt,
    imputedAt,
    imputedSourceType,
    acquisitionError,
    ...base
  } = row;
  return {
    ...base,
    followers: null,
    following: null,
    posts: null,
    likes: null,
    views: null,
    error: "imputed_refresh_pending",
    detail: "A previous fallback value is being retried as a real observation.",
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
    console.log(`Latest snapshot is ${snapshot.date}, not ${today}; imputed retry preparation skipped.`);
    return;
  }

  const imputedRows = snapshot.accounts.filter((row) => row.imputed === true && !row.error);
  if (!imputedRows.length) {
    console.log("No imputed rows need a fresh observation attempt.");
    return;
  }

  const keys = new Set(imputedRows.map((row) => `${row.platform}:${String(row.handle).toLowerCase()}`));
  const accounts = snapshot.accounts.map((row) => keys.has(`${row.platform}:${String(row.handle).toLowerCase()}`) ? clearImputation(row) : row);
  const failed = accounts.filter((row) => row.error).length;
  const observedSuccessful = accounts.filter((row) => !row.error && !row.imputed).length;
  const next = {
    ...snapshot,
    complete: failed === 0,
    observedComplete: failed === 0,
    successful: accounts.length - failed,
    observedSuccessful,
    failed,
    imputed: 0,
    accounts,
    errors: accounts.filter((row) => row.error).map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
  };

  await writeSnapshot(next);
  console.log(`Prepared ${imputedRows.length} imputed row(s) for a real observation retry.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
