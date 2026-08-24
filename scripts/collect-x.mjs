import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const bearerToken = process.env.X_BEARER_TOKEN;

if (!bearerToken) {
  console.error("X_BEARER_TOKEN is required.");
  process.exit(1);
}

async function collect() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "X", active: true },
    include: { entity: true },
    orderBy: [{ entity: { name: "asc" } }, { handle: "asc" }],
  });

  const run = await prisma.collectionRun.create({
    data: { platform: "X", collector: "x-api-v2-user-lookup", status: "RUNNING" },
  });

  const errors = [];
  let collected = 0;

  for (let offset = 0; offset < accounts.length; offset += 100) {
    const batch = accounts.slice(offset, offset + 100);
    const usernames = batch.map((account) => account.handle.replace(/^@/, "")).join(",");

    try {
      const response = await fetch(
        `https://api.x.com/2/users/by?usernames=${encodeURIComponent(usernames)}&user.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${bearerToken}` } },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      const users = new Map((payload.data ?? []).map((user) => [user.username.toLowerCase(), user]));

      for (const account of batch) {
        const username = account.handle.replace(/^@/, "");
        const user = users.get(username.toLowerCase());
        if (!user) {
          errors.push(`${account.entity.name} (@${username}): user not returned by API`);
          continue;
        }

        const capturedAt = new Date();
        const metrics = user.public_metrics ?? {};
        const rows = [];
        if (metrics.followers_count != null) rows.push(["FOLLOWERS", metrics.followers_count]);
        if (metrics.tweet_count != null) rows.push(["POSTS", metrics.tweet_count]);

        for (const [metric, value] of rows) {
          await prisma.metricSnapshot.create({
            data: {
              accountId: account.id,
              collectionRunId: run.id,
              metric,
              value: BigInt(value),
              capturedAt,
              sourceUrl: account.profileUrl,
              sourceType: "X_API_V2",
              raw: { userId: user.id, username: user.username, public_metrics: metrics },
            },
          });
        }

        if (user.id !== account.platformId) {
          await prisma.socialAccount.update({ where: { id: account.id }, data: { platformId: user.id } });
        }
        collected += 1;
        console.log(`✓ ${account.entity.name} (@${username})`);
      }

      for (const apiError of payload.errors ?? []) {
        errors.push(`X API: ${apiError.detail ?? apiError.title ?? JSON.stringify(apiError)}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
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

  console.log(`Collected ${collected}/${accounts.length} X accounts.`);
  if (errors.length) process.exitCode = 2;
}

collect()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
