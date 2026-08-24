import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const directoryPath = path.resolve(here, "../data/directory");

async function readJson(file) {
  return JSON.parse(await readFile(path.join(directoryPath, file), "utf8"));
}

const files = (await readdir(directoryPath)).filter((file) => file.endsWith(".json")).sort();
const errors = [];
const warnings = [];
const seen = new Map();
let officialContainers = 0;
let memberCount = 0;
let accountCount = 0;

for (const file of files) {
  const data = await readJson(file);
  const isSpecialUnits = file === "special-units.json";
  const containers = isSpecialUnits ? data.units ?? [] : [data];

  for (const container of containers) {
    if (container.type === "PROJECT" || container.type === "GROUP") {
      officialContainers += 1;
      if (!Array.isArray(container.accounts) || container.accounts.length === 0) {
        errors.push(`${file}:${container.slug} has no official social accounts`);
      }
    }

    for (const account of container.accounts ?? []) {
      accountCount += 1;
      const key = `${account.platform}:${String(account.handle).toLowerCase()}`;
      const previous = seen.get(key);
      if (previous && previous !== container.slug) {
        warnings.push(`${key} is referenced by both ${previous} and ${container.slug}; confirm canonical ownership`);
      } else {
        seen.set(key, container.slug);
      }
      if (!account.url) errors.push(`${file}:${container.slug}:${key} has no profile URL`);
    }

    for (const member of container.members ?? []) {
      memberCount += 1;
      for (const account of member.accounts ?? []) {
        accountCount += 1;
        const key = `${account.platform}:${String(account.handle).toLowerCase()}`;
        const previous = seen.get(key);
        if (previous && previous !== member.slug) {
          warnings.push(`${key} is referenced by both ${previous} and ${member.slug}; confirm canonical ownership`);
        } else {
          seen.set(key, member.slug);
        }
        if (!account.url) errors.push(`${file}:${member.slug}:${key} has no profile URL`);
      }
    }
  }
}

console.log(`Validated ${officialContainers} project/group/unit records, ${memberCount} member entries, ${accountCount} account references.`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length) process.exitCode = 1;
