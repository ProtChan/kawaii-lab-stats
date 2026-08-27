import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = path.join(ROOT, "data", "live");
const HISTORY = path.join(LIVE, "history");
const PUBLIC_DATA = path.join(ROOT, "public", "data");
const PUBLIC_HISTORY = path.join(PUBLIC_DATA, "history");
const WINDOW_START_MINUTE = 0;
const WINDOW_END_MINUTE = 120;

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

function jstInfo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
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
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    valid: minute >= WINDOW_START_MINUTE && minute <= WINDOW_END_MINUTE,
  };
}

const files = (await readdir(HISTORY)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort();
const removedDates = [];
const keptDates = [];

for (const file of files) {
  const expectedDate = file.slice(0, 10);
  const snapshot = await readJson(path.join(HISTORY, file));
  const info = jstInfo(snapshot.collectedAt);
  const keep = info && info.date === expectedDate && info.valid;
  if (keep) {
    keptDates.push(expectedDate);
    console.log(`KEEP ${expectedDate} ${info.time} JST`);
    continue;
  }

  removedDates.push(expectedDate);
  console.log(`REMOVE ${expectedDate} ${info?.time ?? "invalid"} JST`);
  await unlink(path.join(HISTORY, file));
  try { await unlink(path.join(PUBLIC_HISTORY, file)); } catch {}
}

if (!keptDates.length) throw new Error("Refusing to prune every history snapshot.");

const keepSet = new Set(keptDates);
const currentSeries = await readJson(path.join(LIVE, "series.json"));
const series = currentSeries.filter((point) => keepSet.has(point.date));
const seriesText = `${JSON.stringify(series, null, 2)}\n`;
await writeFile(path.join(LIVE, "series.json"), seriesText);
await writeFile(path.join(PUBLIC_DATA, "series.json"), seriesText);

const latestDate = keptDates.at(-1);
const latestText = await readFile(path.join(HISTORY, `${latestDate}.json`), "utf8");
await writeFile(path.join(LIVE, "latest.json"), latestText);
await writeFile(path.join(PUBLIC_DATA, "latest.json"), latestText);

console.log(`Kept ${keptDates.length} snapshots: ${keptDates.join(", ")}`);
console.log(`Removed ${removedDates.length} snapshots: ${removedDates.join(", ") || "none"}`);