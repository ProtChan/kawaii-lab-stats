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
      verifiedByUrl: account.sourceUrl ?? sourceUrl,
      verifiedAt,
    },
    update: {
      entityId,
      profileUrl: account.url,
      platformId: account.platformId ?? undefined,
      active: true,
      verifiedByUrl: account.sourceUrl ?? sourceUrl,
      verifiedAt,
    },
  });
}

async function upsertGroup(projectId, data) {
  const verifiedAt = new Date(data.verifiedAt);
  return prisma.entity.upsert({
    where: { slug: data.slug },
    create: {
      slug: data.slug,
      name: data.name,
      type: "GROUP",
      status: "ACTIVE",
      parentId: projectId,
      officialSourceUrl: data.sourceUrl,
      verifiedAt,
      metadata: { category: data.category },
    },
    update: {
      name: data.name,
      type: "GROUP",
      status: "ACTIVE",
      parentId: projectId,
      officialSourceUrl: data.sourceUrl,
      verifiedAt,
      metadata: { category: data.category },
    },
  });
}

async function ensureMembership({ memberId, parentId, kind, verifiedAt, sourceUrl }) {
  const existing = await prisma.entityMembership.findFirst({
    where: { memberId, parentId, kind, validTo: null },
  });
  if (existing) return existing;

  return prisma.entityMembership.create({
    data: {
      memberId,
      parentId,
      kind,
      validFrom: verifiedAt,
      sourceUrl,
    },
  });
}

async function seedPrimaryGroup(projectId, data) {
  const verifiedAt = new Date(data.verifiedAt);
  const group = await upsertGroup(projectId, data);
  let accountCount = 0;
  const memberSlugs = [];

  for (const account of data.accounts ?? []) {
    await upsertAccount(group.id, account, data.sourceUrl, verifiedAt);
    accountCount += 1;
  }

  const membershipKind = data.category === "TRAINEE" ? "TRAINEE" : "PRIMARY";

  for (const memberData of data.members ?? []) {
    if (memberData.relationOnly) continue;

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
    memberSlugs.push(member.slug);

    const competingMemberships = await prisma.entityMembership.findMany({
      where: {
        memberId: member.id,
        kind: membershipKind,
        validTo: null,
        NOT: { parentId: group.id },
      },
    });
    for (const membership of competingMemberships) {
      await prisma.entityMembership.update({
        where: { id: membership.id },
        data: { validTo: verifiedAt },
      });
    }

    await ensureMembership({
      memberId: member.id,
      parentId: group.id,
      kind: membershipKind,
      verifiedAt,
      sourceUrl: data.sourceUrl,
    });

    for (const account of memberData.accounts ?? []) {
      await upsertAccount(member.id, account, data.sourceUrl, verifiedAt);
      accountCount += 1;
    }
  }

  return { accountCount, memberSlugs };
}

async function seedSpecialUnit(projectId, data) {
  const verifiedAt = new Date(data.verifiedAt);
  const group = await upsertGroup(projectId, data);
  let accountCount = 0;

  for (const account of data.accounts ?? []) {
    await upsertAccount(group.id, account, data.sourceUrl, verifiedAt);
    accountCount += 1;
  }

  for (const memberData of data.members ?? []) {
    const member = await prisma.entity.findUnique({ where: { slug: memberData.slug } });
    if (!member || member.type !== "MEMBER") {
      throw new Error(`Special-unit member must already exist as MEMBER: ${memberData.slug}`);
    }
    await ensureMembership({
      memberId: member.id,
      parentId: group.id,
      kind: "UNIT",
      verifiedAt,
      sourceUrl: data.sourceUrl,
    });
  }

  return { accountCount };
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
      metadata: { category: projectData.category, notes: projectData.notes ?? null },
    },
    update: {
      name: projectData.name,
      type: "PROJECT",
      status: "ACTIVE",
      officialSourceUrl: projectData.sourceUrl,
      verifiedAt: projectVerifiedAt,
      metadata: { category: projectData.category, notes: projectData.notes ?? null },
    },
  });

  let accountCount = 0;
  for (const account of projectData.accounts ?? []) {
    await upsertAccount(project.id, account, projectData.sourceUrl, projectVerifiedAt);
    accountCount += 1;
  }

  const files = (await readdir(directoryPath))
    .filter((file) => file.endsWith(".json") && file !== "project.json")
    .sort();
  const datasets = await Promise.all(files.map(readJson));
  const primaryGroups = datasets.filter((data) => data.category !== "SPECIAL_UNIT");
  const specialUnits = datasets.filter((data) => data.category === "SPECIAL_UNIT");
  const uniqueMembers = new Set();

  for (const data of primaryGroups) {
    const result = await seedPrimaryGroup(project.id, data);
    result.memberSlugs.forEach((slug) => uniqueMembers.add(slug));
    accountCount += result.accountCount;
  }

  for (const data of specialUnits) {
    const result = await seedSpecialUnit(project.id, data);
    accountCount += result.accountCount;
  }

  console.log(
    `Seeded ${datasets.length} groups/units, ${uniqueMembers.size} unique members, and ${accountCount} canonical official social accounts.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
