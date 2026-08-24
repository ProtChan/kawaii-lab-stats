import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));
const directoryPath = path.resolve(here, "../data/directory");

async function readJson(file) {
  return JSON.parse(await readFile(path.join(directoryPath, file), "utf8"));
}

async function upsertAccount(entityId, account, sourceUrl, verifiedAt) {
  return prisma.socialAccount.upsert({
    where: { platform_handle: { platform: account.platform, handle: account.handle } },
    create: {
      entityId,
      platform: account.platform,
      handle: account.handle,
      profileUrl: account.url,
      platformId: account.platformId ?? null,
      verifiedByUrl: sourceUrl,
      verifiedAt,
    },
    update: {
      entityId,
      profileUrl: account.url,
      platformId: account.platformId ?? undefined,
      active: true,
      verifiedByUrl: sourceUrl,
      verifiedAt,
    },
  });
}

async function seed() {
  const projectData = await readJson("project.json");
  const projectVerifiedAt = new Date(projectData.verifiedAt);
  const project = await prisma.entity.upsert({
    where: { slug: projectData.slug },
    create: {
      slug: projectData.slug,
      name: projectData.name,
      type: "PROJECT",
      status: "ACTIVE",
      officialSourceUrl: projectData.sourceUrl,
      verifiedAt: projectVerifiedAt,
      metadata: { category: projectData.category },
    },
    update: {
      name: projectData.name,
      type: "PROJECT",
      status: "ACTIVE",
      officialSourceUrl: projectData.sourceUrl,
      verifiedAt: projectVerifiedAt,
      metadata: { category: projectData.category },
    },
  });

  for (const account of projectData.accounts ?? []) {
    await upsertAccount(project.id, account, projectData.sourceUrl, projectVerifiedAt);
  }

  const files = (await readdir(directoryPath))
    .filter((file) => file.endsWith(".json") && file !== "project.json")
    .sort();

  let groupCount = 0;
  let memberCount = 0;
  let accountCount = projectData.accounts?.length ?? 0;

  for (const file of files) {
    const data = await readJson(file);
    const verifiedAt = new Date(data.verifiedAt);
    const group = await prisma.entity.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        name: data.name,
        type: "GROUP",
        status: "ACTIVE",
        parentId: project.id,
        officialSourceUrl: data.sourceUrl,
        verifiedAt,
        metadata: { category: data.category },
      },
      update: {
        name: data.name,
        type: "GROUP",
        status: "ACTIVE",
        parentId: project.id,
        officialSourceUrl: data.sourceUrl,
        verifiedAt,
        metadata: { category: data.category },
      },
    });
    groupCount += 1;

    for (const account of data.accounts ?? []) {
      await upsertAccount(group.id, account, data.sourceUrl, verifiedAt);
      accountCount += 1;
    }

    for (const memberData of data.members ?? []) {
      const member = await prisma.entity.upsert({
        where: { slug: memberData.slug },
        create: {
          slug: memberData.slug,
          name: memberData.name,
          type: "MEMBER",
          status: "ACTIVE",
          parentId: group.id,
          officialSourceUrl: data.sourceUrl,
          verifiedAt,
          metadata: memberData.notes ? { notes: memberData.notes } : undefined,
        },
        update: {
          name: memberData.name,
          type: "MEMBER",
          status: "ACTIVE",
          parentId: group.id,
          officialSourceUrl: data.sourceUrl,
          verifiedAt,
          metadata: memberData.notes ? { notes: memberData.notes } : undefined,
        },
      });
      memberCount += 1;

      const activeMemberships = await prisma.entityMembership.findMany({
        where: { memberId: member.id, validTo: null },
      });
      for (const membership of activeMemberships) {
        if (membership.parentId !== group.id) {
          await prisma.entityMembership.update({
            where: { id: membership.id },
            data: { validTo: verifiedAt },
          });
        }
      }
      if (!activeMemberships.some((membership) => membership.parentId === group.id)) {
        await prisma.entityMembership.create({
          data: {
            memberId: member.id,
            parentId: group.id,
            validFrom: verifiedAt,
            sourceUrl: data.sourceUrl,
          },
        });
      }

      for (const account of memberData.accounts ?? []) {
        await upsertAccount(member.id, account, data.sourceUrl, verifiedAt);
        accountCount += 1;
      }
    }
  }

  console.log(`Seeded ${groupCount} groups, ${memberCount} members, and ${accountCount} official social accounts.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
