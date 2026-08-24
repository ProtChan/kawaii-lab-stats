# KAWAII LAB. Stats

Fanmade / unofficial social media statistics dashboard for KAWAII LAB. groups and members.

> This project is not affiliated with KAWAII LAB. or its management. Published statistics should always include source attribution and collection timestamps.

## Goals

- Track groups and individual members across multiple social platforms.
- Store historical snapshots instead of only the latest value.
- Compare follower/subscriber counts, absolute gains, growth rates and momentum.
- Build group/member rankings and interactive time-series charts.
- Keep collectors independent from the public web application so collection methods can change safely.
- Preserve source URL, timestamp and optional raw response for auditability.

## Stack

- Next.js 15
- React 19
- TypeScript
- Recharts
- PostgreSQL
- Prisma

## Data model

The core model is deliberately generic:

```text
Entity
  ├─ PROJECT
  ├─ GROUP
  └─ MEMBER
       │
       └─ SocialAccount
            │
            └─ MetricSnapshot
                 ├─ metric
                 ├─ value
                 ├─ capturedAt
                 ├─ sourceUrl
                 ├─ sourceType
                 └─ raw
```

This avoids creating separate tables for every SNS and makes new platforms and metrics easy to add.

## Local development

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

A PostgreSQL database is only required once database-backed pages/collectors are enabled. The current homepage uses placeholder demo data so the UI can be developed immediately.

## Important: demo values

The values in `lib/demo-data.ts` are placeholders for interface development and **must not be treated as real current statistics**. Replace them with source-attributed collected snapshots before public release.

## Planned architecture

```text
app/                  Next.js routes and pages
components/           charts and reusable UI
lib/                   queries, calculations, normalization
prisma/                database schema
collectors/            platform-specific data collectors (next phase)
  x/
  instagram/
  tiktok/
  youtube/
```

Collector output should be normalized before writing to `MetricSnapshot`. Public pages should read normalized snapshots rather than platform-specific payloads.

## Recommended next milestones

1. Register official group/member social accounts in seed data.
2. Add a collector interface and collection-run audit table.
3. Implement the first reliable platform collector.
4. Add daily/weekly/monthly delta calculation.
5. Add group pages and member pages.
6. Add rankings by platform and combined followers.
7. Add scheduled collection and data-quality checks.
8. Add public methodology and source pages before launch.

## Metrics to support

- followers / subscribers
- views
- likes
- posts / videos
- daily gain
- 7d / 30d gain
- growth rate
- moving averages
- acceleration / momentum scores
- combined cross-platform audience (shown separately from deduplicated reach)

## Data quality principles

- Never silently interpolate missing observations as measured values.
- Store collection time separately from the statistic's effective time when necessary.
- Preserve raw source evidence where legally and technically appropriate.
- Mark estimates and inferred values explicitly.
- Keep account renames and member/group history auditable.
- Avoid calling cross-platform follower sums "unique people" because audiences overlap.

## License / trademarks

Choose a source-code license before public contribution is enabled. Names, logos and trademarks remain the property of their respective owners.
