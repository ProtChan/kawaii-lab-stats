import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const prisma = new PrismaClient();
const file = process.argv[2];

if (!file) {
  console.error("Usage: npm run import:snapshots -- path/to/snapshots.json");
  process.exit(1);
}

async function run() {
  const rows = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(rows)) throw new Error("Input must be a JSON array.");

  let imported = 0;
  for (const row of rows) {
    const entity = await prisma.entity.findUnique({ where: { slug: row.entitySlug } });
    if (!entity) throw new Error(`Unknown entitySlug: ${row.entitySlug}`);

    const account = await prisma.socialAccount.findFirst({
      where: {
        entityId: entity.id,
        platform: row.platform,
        ...(row.handle ? { handle: row.handle } : {}),
        active: true,
      },
    });
    if (!account) throw new Error(`No ${row.platform} account for ${row.entitySlug}`);

    await prisma.metricSnapshot.create({
      data: {
        accountId: account.id,
        metric: row.metric,
        value: BigInt(row.value),
        capturedAt: row.capturedAt ? new Date(row.capturedAt) : new Date(),
        sourceUrl: row.sourceUrl ?? account.profileUrl,
        sourceType: row.sourceType ?? "MANUAL_IMPORT",
        raw: row.raw ?? undefined,
      },
    });
    imported += 1;
  }

  console.log(`Imported ${imported} snapshots.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
