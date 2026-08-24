import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  console.error("YOUTUBE_API_KEY is required.");
  process.exit(1);
}

function youtubeLookup(account) {
  if (account.platformId) return `id=${encodeURIComponent(account.platformId)}`;
  const handle = account.handle.startsWith("@") ? account.handle : `@${account.handle}`;
  return `forHandle=${encodeURIComponent(handle)}`;
}

async function collect() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "YOUTUBE", active: true },
    include: { entity: true },
    orderBy: [{ entity: { name: "asc" } }, { handle: "asc" }],
  });

  const run = await prisma.collectionRun.create({
    data: { platform: "YOUTUBE", collector: "youtube-data-api-v3", status: "RUNNING" },
  });

  const errors = [];
  let collected = 0;

  for (const account of accounts) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&${youtubeLookup(account)}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const channel = payload.items?.[0];
      if (!channel) throw new Error("channel not found");

      const capturedAt = new Date();
      const statistics = channel.statistics ?? {};
      const rows = [];
      if (!statistics.hiddenSubscriberCount && statistics.subscriberCount != null) {
        rows.push(["SUBSCRIBERS", statistics.subscriberCount]);
      }
      if (statistics.viewCount != null) rows.push(["VIEWS", statistics.viewCount]);
      if (statistics.videoCount != null) rows.push(["VIDEOS", statistics.videoCount]);

      for (const [metric, value] of rows) {
        await prisma.metricSnapshot.create({
          data: {
            accountId: account.id,
            collectionRunId: run.id,
            metric,
            value: BigInt(value),
            capturedAt,
            sourceUrl: account.profileUrl,
            sourceType: "YOUTUBE_DATA_API_V3",
            raw: { channelId: channel.id, statistics },
          },
        });
      }

      if (channel.id !== account.platformId) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: { platformId: channel.id },
        });
      }
      collected += 1;
      console.log(`✓ ${account.entity.name} (${account.handle})`);
    } catch (error) {
      const message = `${account.entity.name} (${account.handle}): ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      console.error(`✗ ${message}`);
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

  console.log(`Collected ${collected}/${accounts.length} YouTube accounts.`);
  if (errors.length) process.exitCode = 2;
}

collect()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
