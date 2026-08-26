# KAWAII LAB. Stats

Fanmade / unofficial social-media analytics for KAWAII LAB. groups, units and members.

> Not affiliated with KAWAII LAB. or its management. Statistics are public-profile observations with source and capture timestamps.

## What the site is for

The product separates four questions:

- **Scale** — how large is the current observed SNS footprint?
- **Growth** — how much did it change over a comparable period?
- **Activity** — how are cumulative TikTok likes / YouTube views changing?
- **Data quality** — was the metric completely and comparably observed?

Rankings are for discovery, Compare is for selected time-series analysis, Groups/Members are entity detail views, and the Data menu contains Coverage / Directory / Methodology.

## Current directory

Verified from official sources starting 2026-08-24 JST:

- 5 primary groups: FRUITS ZIPPER / CANDY TUNE / SWEET STEADY / CUTIE STREET / MORE STAR
- concurrent unit: PiKi
- trainee units: KAWAII LAB. MATES / KAWAII LAB. SOUTH
- 59 unique member entities
- 211 canonical project/group/unit/member social accounts at the initial directory revision

Concurrent-unit membership is represented as a relation; personal accounts are not duplicated simply because a member belongs to multiple structures.

## Main routes

```text
/                     overview + latest movers
/rankings/             discovery: scale + daily movers + content scale
/compare/              selected entities + metrics + total/daily history
/groups/               category-aware group/unit directory
/groups/[slug]/        group analytics
/members/              searchable/filterable member explorer
/members/[slug]/       member analytics
/coverage/             data-quality dashboard
/directory/            canonical official-account directory
/methodology/          public metric definitions
/data/latest.json      latest raw public snapshot
/data/series.json      public group series
```

Compare state is shareable through query parameters such as:

```text
/compare/?scope=members&metric=tiktokLikes&group=cutie-street
/compare/?scope=members&metric=audience&view=daily&selected=haruka-sakuraba
```

## Production collection

`.github/workflows/collect-daily-public.yml` is the only automatic social-profile collection workflow.

Nominal schedule:

```text
00:00 JST  primary
00:30 JST  fallback
```

The fallback is only a scheduling safety net. Before any public-profile request, the collector checks the current JST history file; a completed daily snapshot causes an immediate exit, so the second cron does not produce a second observation.

The collection job intentionally uses Node built-ins and does not depend on the web app's npm dependency installation.

## Publication flow

```text
data/directory validation
        ↓
one public observation / canonical account / JST day
        ↓
data/live/history/YYYY-MM-DD.json
public/data/history/YYYY-MM-DD.json
        ↓
latest.json + series.json
        ↓
snapshot integrity validation
        ↓
commit to main
        ↓
typecheck + static Next.js build
        ↓
GitHub Pages deploy in the same daily workflow
```

A separate Pages workflow also deploys normal code changes on `main`.

## Canonical metric engine

`lib/metrics.ts` is the single source of truth for:

- trusted YouTube parser rules
- platform normalization
- observed vs expected counts
- followers/subscribers aggregation
- TikTok total likes
- YouTube total channel views
- completeness
- canonical account-set identity used for Growth comparability

`lib/live-stats.ts`, `lib/analytics.ts`, and `lib/compare-data.ts` consume that layer rather than defining independent metric semantics.

## Missing data and Growth

Missing is not zero.

A Growth interval is published only if:

1. both endpoints are complete for the requested metric; and
2. the canonical account set is identical at both endpoints.

This prevents a new SNS account, account migration, directory correction, or missing observation from appearing as fake organic growth.

## Per-platform metrics

### X

- followers
- following
- posts
- verification state when exposed

### Instagram

- followers
- following
- posts

### TikTok

- followers
- following
- videos/posts
- cumulative profile total likes

### YouTube

One public About-page read per channel/JST day captures:

- subscribers
- video count
- lifetime total channel views

Production analytics trust the versioned `ABOUT_CHANNEL_VIEW_MODEL_V1` parser. Publicly abbreviated values remain marked with their precision rather than being fabricated into exact counts.

## Group semantics

For directly comparable primary groups:

- `official` = group official SNS audience
- `members` = canonical member SNS audience
- `ecosystem` = official + members

Special/concurrent units and trainee units are displayed separately from primary-group rankings because membership/account ownership semantics differ.

SNS audience sums are **not deduplicated unique people**.

## Integrity validation

Run locally:

```bash
npm install
npm run directory:validate
npm run data:validate
npm run typecheck
npm run build
```

`scripts/validate-snapshots.mjs` checks latest/history/series synchronization, duplicate accounts, canonical-account coverage, capture timestamps and current YouTube parser trust before publication.

Direct dependencies are pinned to exact versions. A committed full npm lockfile is the next reproducibility step; until then transitive resolution is still controlled less strictly than ideal.

## Legacy DB/API path

The Prisma/PostgreSQL schema and official API/provider collectors remain in the repository as a manual-only legacy/future path. `.github/workflows/collect-social-stats.yml` has no schedule and is not part of the production daily collection.

The goal of any future migration is to preserve the current canonical identity / observation / metric semantics, not create a second competing definition.

## Architecture notes

See `docs/collection-strategy.md` for the current production data architecture.

## License / trademarks

Choose a source-code license before accepting public contributions. Names, logos and trademarks remain the property of their respective owners.
