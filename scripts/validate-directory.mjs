import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const directoryPath = path.resolve(here, "../data/directory");
const SUPPORTED = new Set(["X", "INSTAGRAM", "TIKTOK", "YOUTUBE"]);
const GROUP_CATEGORIES = new Set(["DEBUTED", "SPECIAL_UNIT", "TRAINEE"]);

async function readJson(file) {
  return JSON.parse(await readFile(path.join(directoryPath, file), "utf8"));
}

const files = (await readdir(directoryPath)).filter((file) => file.endsWith(".json")).sort();
const errors = [];
const warnings = [];
const accountOwners = new Map();
const slugs = new Map();
const memberOwners = new Map();
let officialContainers = 0;
let memberRelations = 0;
let accountCount = 0;

function registerSlug(slug, location) {
  if (!slug) {
    errors.push(`${location}: missing slug`);
    return;
  }
  const previous = slugs.get(slug);
  if (previous && previous !== location) errors.push(`${location}: duplicate entity slug ${slug}; first seen at ${previous}`);
  else slugs.set(slug, location);
}

function validateAccount(account, owner, location) {
  accountCount += 1;
  if (!SUPPORTED.has(account.platform)) errors.push(`${location}: unsupported platform ${account.platform}`);
  if (!account.handle) errors.push(`${location}: missing handle`);
  if (!account.url) errors.push(`${location}: missing profile URL`);
  if (!account.platform || !account.handle) return;
  const key = `${account.platform}:${String(account.handle).toLowerCase()}`;
  const previous = accountOwners.get(key);
  if (previous && previous !== owner) errors.push(`${location}: canonical account ${key} is owned by both ${previous} and ${owner}`);
  else accountOwners.set(key, owner);
}

for (const file of files) {
  const data = await readJson(file);
  if (data.type !== "PROJECT" && data.type !== "GROUP") errors.push(`${file}: type must be PROJECT or GROUP`);
  registerSlug(data.slug, file);
  if (!data.sourceUrl) errors.push(`${file}:${data.slug}: missing sourceUrl`);
  if (!data.verifiedAt) errors.push(`${file}:${data.slug}: missing verifiedAt`);
  if (data.type === "GROUP" && !GROUP_CATEGORIES.has(data.category)) errors.push(`${file}:${data.slug}: unknown category ${data.category}`);

  officialContainers += 1;
  if (!Array.isArray(data.accounts) || data.accounts.length === 0) errors.push(`${file}:${data.slug}: has no official social accounts`);
  for (const account of data.accounts ?? []) validateAccount(account, data.slug, `${file}:${data.slug}`);

  const localMemberSlugs = new Set();
  for (const member of data.members ?? []) {
    memberRelations += 1;
    if (!member.slug || !member.name) errors.push(`${file}: member missing slug/name`);
    if (localMemberSlugs.has(member.slug)) errors.push(`${file}:${data.slug}: duplicate member relation ${member.slug}`);
    localMemberSlugs.add(member.slug);

    if (member.relationOnly) {
      if ((member.accounts ?? []).length) errors.push(`${file}:${member.slug}: relationOnly member must not own duplicate accounts`);
    } else {
      const primaryOwner = memberOwners.get(member.slug);
      if (primaryOwner && primaryOwner !== data.slug) errors.push(`${file}:${member.slug}: canonical member accounts owned by both ${primaryOwner} and ${data.slug}`);
      else memberOwners.set(member.slug, data.slug);
      if (!Array.isArray(member.accounts) || member.accounts.length === 0) warnings.push(`${file}:${member.slug}: canonical member has no tracked social accounts`);
    }

    if (member.status && !["ACTIVE", "HIATUS", "INACTIVE"].includes(member.status)) errors.push(`${file}:${member.slug}: unknown status ${member.status}`);
    for (const account of member.accounts ?? []) validateAccount(account, member.slug, `${file}:${member.slug}`);
  }
}

for (const [slug] of memberOwners) {
  const relationFiles = files.length;
  if (!slug) warnings.push(`unreachable member slug across ${relationFiles} files`);
}

console.log(`Validated ${officialContainers} project/group/unit records, ${memberRelations} membership relations, ${memberOwners.size} canonical members, ${accountCount} account references.`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exitCode = 1;
