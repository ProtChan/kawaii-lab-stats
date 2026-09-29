import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const HISTORY = path.join(ROOT, "data", "live", "history");
const PUBLIC_HISTORY = path.join(ROOT, "public", "data", "history");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const keyOf = (row) => `${row.platform}:${String(row.handle).toLowerCase()}`;
const finite = (value) => typeof value === "number" && Number.isFinite(value);

function fallbackRow(current, source, sourceDate, repairedAt) {
  const { error, detail, ...base } = current;
  return {
    ...base,
    capturedAt: source.capturedAt,
    sourceType: "IMPUTED_LAST_OBSERVED",
    sourceUrl: source.sourceUrl ?? current.profileUrl,
    providerPlatform: source.providerPlatform ?? null,
    providerHandle: source.providerHandle ?? source.handle ?? current.handle,
    providerName: source.providerName ?? source.entityName ?? current.entityName,
    followers: source.followers ?? null,
    following: source.following ?? null,
    posts: source.posts ?? null,
    likes: source.likes ?? null,
    views: source.views ?? null,
    viewsPrecision: source.viewsPrecision ?? null,
    verified: source.verified ?? null,
    avatar: source.avatar ?? null,
    parserVersion: source.parserVersion ?? null,
    audienceMetric: source.audienceMetric ?? (current.platform === "YOUTUBE" ? "SUBSCRIBERS" : "FOLLOWERS"),
    precision: source.precision ?? "PUBLIC_PROFILE",
    engagementMetric: source.engagementMetric ?? null,
    imputed: true,
    imputationMethod: "LAST_OBSERVED_VALUE",
    imputedFromDate: sourceDate,
    imputedFromCapturedAt: source.capturedAt,
    imputedAt: repairedAt,
    imputedSourceType: source.sourceType ?? null,
    acquisitionError: { error: error ?? "missing", detail: detail ?? null },
  };
}

async function main() {
  const files = (await readdir(HISTORY)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
  const latestReal = new Map();
  let repairedRows = 0;
  let repairedFiles = 0;
  const repairedAt = new Date().toISOString();

  for (const file of files) {
    const filePath = path.join(HISTORY, file);
    const snapshot = await readJson(filePath);
    let changed = false;
    const accounts = snapshot.accounts.map((row) => {
      const key = keyOf(row);
      if (row.error) {
        const source = latestReal.get(key);
        if (source && finite(source.row.followers)) {
          changed = true;
          repairedRows += 1;
          return fallbackRow(row, source.row, source.date, repairedAt);
        }
      }
      return row;
    });

    for (const row of snapshot.accounts) {
      if (!row.error && !row.imputed && finite(row.followers)) latestReal.set(keyOf(row), { row, date: snapshot.date });
    }

    if (!changed) continue;
    repairedFiles += 1;
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
      accounts,
      errors: failedRows.map((row) => `${row.entitySlug}:${row.platform}:${row.handle}: ${row.detail ?? row.error}`),
      source: {
        ...(snapshot.source ?? {}),
        historicalGapRepair: "LAST_OBSERVED_VALUE",
        note: "Historical hard failures are filled with tagged last-observed values for level-series continuity. Imputed values remain excluded from growth calculations.",
      },
    };
    const serialized = `${JSON.stringify(next, null, 2)}\n`;
    await writeFile(filePath, serialized);
    await writeFile(path.join(PUBLIC_HISTORY, file), serialized);
  }

  console.log(`Historical gap repair: ${repairedRows} row(s) across ${repairedFiles} snapshot(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
