import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const endpoint = process.env.SNAPSHOT_PROVIDER_URL;
const token = process.env.SNAPSHOT_PROVIDER_TOKEN;

if (!endpoint) {
  console.error("SNAPSHOT_PROVIDER_URL is required.");
  process.exit(1);
}

const allowedPlatforms = new Set(["X", "INSTAGRAM", "TIKTOK", "YOUTUBE"]);
const allowedMetrics = new Set(["FOLLOWERS", "SUBSCRIBERS", "LIKES", "VIEWS", "POSTS", "VIDEOS"]);

async function main() {
  const run = await prisma.collectionRun.create({
    data: { platform: "OTHER", collector: "snapshot-provider", status: "RUNNING" },
  });

  const response = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}: ${await response.text()}`);

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : payload.snapshots;
  if (!Array.isArray(items)) throw new Error("Provider must return an array or { snapshots: [] }.");

  const errors = [];
  let collected = 0;

  for (const item of items) {
    try {
      if (!allowedPlatforms.has(item.platform)) throw new Error(`unsupported platform ${item.platform}`);
      if (!allowedMetrics.has(item.metric)) throw new Error(`unsupported metric ${item.metric}`);
      if (!Number.isFinite(Number(item.value))) throw new Error("value must be numeric");

      const entity = await prisma.entity.findUnique({ where: { slug: item.entitySlug } });
      if (!entity) throw new Error(`unknown entity ${item.entitySlug}`);

      const account = await prisma.socialAccount.findFirst({
        where: {
          entityId: entity.id,
          platform: item.platform,
          active: true,
          ...(item.handle ? { handle: item.handle } : {}),
        },
      });
      if (!account) throw new Error(`active ${item.platform} account not found for ${item.entitySlug}`);

      await prisma.metricSnapshot.create({
        data: {
          accountId: account.id,
          collectionRunId: run.id,
          metric: item.metric,
          value: BigInt(String(item.value)),
          capturedAt: item.capturedAt ? new Date(item.capturedAt) : new Date(),
          sourceUrl: item.sourceUrl ?? account.profileUrl,
          sourceType: item.sourceType ?? "LICENSED_PROVIDER",
          raw: item.raw ?? item,
        },
      });
      collected += 1;
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

  console.log(`Imported ${collected}/${items.length} provider snapshots.`);
  if (errors.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
