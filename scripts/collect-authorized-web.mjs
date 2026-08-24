import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const config = JSON.parse(await readFile(new URL("../data/collectors/authorized-web.json", import.meta.url), "utf8"));
const directPlatformHosts = new Set([
  "x.com",
  "twitter.com",
  "www.instagram.com",
  "instagram.com",
  "www.tiktok.com",
  "tiktok.com",
  "www.youtube.com",
  "youtube.com",
]);

function robotsDisallows(text, pathname) {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim());
  let applies = false;
  for (const line of lines) {
    const [keyRaw, ...rest] = line.split(":");
    if (!keyRaw) continue;
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") applies = value === "*";
    if (applies && key === "disallow" && value && pathname.startsWith(value)) return true;
  }
  return false;
}

async function assertRobotsAllowed(url) {
  const parsed = new URL(url);
  const robotsUrl = `${parsed.origin}/robots.txt`;
  const response = await fetch(robotsUrl, { headers: { "User-Agent": "KawaiiLabStatsBot/0.1" } });
  if (!response.ok) return;
  const text = await response.text();
  if (robotsDisallows(text, parsed.pathname)) throw new Error(`robots.txt disallows ${parsed.pathname}`);
}

async function main() {
  if (!Array.isArray(config) || config.length === 0) {
    console.log("No authorized web collectors configured.");
    return;
  }

  const run = await prisma.collectionRun.create({
    data: { platform: "OTHER", collector: "authorized-web-fallback", status: "RUNNING" },
  });
  const errors = [];
  let collected = 0;

  for (const item of config.filter((entry) => entry.enabled !== false)) {
    try {
      if (item.termsConfirmed !== true || !item.permissionBasis) {
        throw new Error("termsConfirmed=true and permissionBasis are required");
      }
      const parsed = new URL(item.url);
      if (directPlatformHosts.has(parsed.hostname) && process.env.ALLOW_DIRECT_PLATFORM_SCRAPING !== "true") {
        throw new Error(`direct scraping of ${parsed.hostname} is disabled; use an approved API/provider or explicit written permission`);
      }
      await assertRobotsAllowed(item.url);

      const entity = await prisma.entity.findUnique({ where: { slug: item.entitySlug } });
      if (!entity) throw new Error(`unknown entity ${item.entitySlug}`);
      const account = await prisma.socialAccount.findFirst({
        where: { entityId: entity.id, platform: item.platform, active: true },
      });
      if (!account) throw new Error(`active ${item.platform} account not found for ${item.entitySlug}`);

      const response = await fetch(item.url, {
        headers: { "User-Agent": item.userAgent || "KawaiiLabStatsBot/0.1 (+fanmade analytics; contact via repository)" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const regex = new RegExp(item.pattern, item.flags || "i");
      const match = body.match(regex);
      if (!match) throw new Error("configured pattern did not match");
      const rawValue = match[item.captureGroup ?? 1];
      const normalized = String(rawValue).replace(/[^0-9]/g, "");
      if (!normalized) throw new Error("matched value was not numeric");

      await prisma.metricSnapshot.create({
        data: {
          accountId: account.id,
          collectionRunId: run.id,
          metric: item.metric,
          value: BigInt(normalized),
          capturedAt: new Date(),
          sourceUrl: item.url,
          sourceType: item.sourceType || "AUTHORIZED_WEB",
          raw: { permissionBasis: item.permissionBasis, matched: rawValue },
        },
      });
      collected += 1;
      console.log(`✓ ${item.entitySlug} ${item.platform} ${item.metric}`);
    } catch (error) {
      errors.push(`${item?.entitySlug ?? "unknown"}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await prisma.collectionRun.update({
    where: { id: run.id },
    data: {
      status: errors.length === 0 ? "SUCCESS" : collected > 0 ? "PARTIAL" : "FAILED",
      finishedAt: new Date(),
      error: errors.length ? errors.join("\n").slice(0, 10000) : null,
    },
  });

  console.log(`Collected ${collected} authorized web snapshots.`);
  if (errors.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
