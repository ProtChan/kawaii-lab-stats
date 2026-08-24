import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const accessToken = process.env.META_ACCESS_TOKEN;
const igUserId = process.env.META_IG_USER_ID;
const graphVersion = process.env.META_GRAPH_VERSION;

if (!accessToken || !igUserId || !graphVersion) {
  console.error("META_ACCESS_TOKEN, META_IG_USER_ID and META_GRAPH_VERSION are required.");
  process.exit(1);
}

async function collect() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "INSTAGRAM", active: true },
    include: { entity: true },
    orderBy: [{ entity: { name: "asc" } }, { handle: "asc" }],
  });

  const run = await prisma.collectionRun.create({
    data: { platform: "INSTAGRAM", collector: "meta-instagram-business-discovery", status: "RUNNING" },
  });

  const errors = [];
  let collected = 0;

  for (const account of accounts) {
    const username = account.handle.replace(/^@/, "");
    try {
      const fields = `business_discovery.username(${username}){id,username,followers_count,media_count}`;
      const params = new URLSearchParams({ fields, access_token: accessToken });
      const url = `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(igUserId)}?${params}`;
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }

      const discovered = payload.business_discovery;
      if (!discovered) throw new Error("business_discovery not returned (target may not be an eligible Professional account)");

      const capturedAt = new Date();
      const rows = [];
      if (discovered.followers_count != null) rows.push(["FOLLOWERS", discovered.followers_count]);
      if (discovered.media_count != null) rows.push(["POSTS", discovered.media_count]);

      for (const [metric, value] of rows) {
        await prisma.metricSnapshot.create({
          data: {
            accountId: account.id,
            collectionRunId: run.id,
            metric,
            value: BigInt(value),
            capturedAt,
            sourceUrl: account.profileUrl,
            sourceType: "META_INSTAGRAM_BUSINESS_DISCOVERY",
            raw: {
              id: discovered.id,
              username: discovered.username,
              followers_count: discovered.followers_count,
              media_count: discovered.media_count,
            },
          },
        });
      }

      if (discovered.id && discovered.id !== account.platformId) {
        await prisma.socialAccount.update({ where: { id: account.id }, data: { platformId: discovered.id } });
      }
      collected += 1;
      console.log(`✓ ${account.entity.name} (@${username})`);
    } catch (error) {
      const message = `${account.entity.name} (@${username}): ${error instanceof Error ? error.message : String(error)}`;
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

  console.log(`Collected ${collected}/${accounts.length} Instagram accounts.`);
  if (errors.length) process.exitCode = 2;
}

collect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
