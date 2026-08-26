# Collection and data architecture

## Current production path

The production site uses a file-backed, once-per-JST-day public snapshot pipeline.

```text
data/directory/*.json
        ↓ canonical identities
scripts/collect-daily-public.mjs
        ↓ one observation/account/JST day
data/live/history/YYYY-MM-DD.json
        ↓
latest.json + series.json
        ↓
lib/metrics.ts
        ↓ canonical aggregation/completeness rules
lib/live-stats.ts + lib/analytics.ts + lib/compare-data.ts
        ↓
Next.js static export → GitHub Pages
```

`.github/workflows/collect-daily-public.yml` is the only automatic social-profile collection workflow.

## Cadence and duplicate prevention

- primary cron: 00:00 JST (`15:00 UTC`)
- fallback cron: 00:30 JST (`15:30 UTC`)
- manual dispatch is allowed
- before making any profile request, the collector checks `data/live/history/YYYY-MM-DD.json`
- if that JST day's snapshot already exists with `complete: true`, the collector exits

The fallback exists to survive delayed/missed GitHub cron starts; it is not a second daily observation.

## Canonical identity layer

`data/directory/` is the source of truth for:

- project/group/unit/member identity
- group category
- membership/relation links
- canonical social accounts
- profile URLs and stable platform IDs when known
- status such as `HIATUS`
- source attribution and verification dates

Identity changes must not be inferred from follower data.

## Observation layer

Every daily account row preserves:

- entity/group identity at capture time
- platform + handle + profile URL
- `capturedAt`
- source type
- parser version where relevant
- followers/subscribers
- following/posts where available
- TikTok profile total likes
- YouTube lifetime channel views
- explicit error/detail fields

Unknown values remain unknown.

## Sources

### X / Instagram / TikTok

The daily public path uses the configured public-profile provider in batches. Provider errors are stored as missing observations rather than retried on the same JST day.

### YouTube

YouTube uses one public channel About-page read per channel/day. The production parser reads `aboutChannelViewModel` only and is versioned as:

```text
ABOUT_CHANNEL_VIEW_MODEL_V1
```

Successful YouTube observations from other parser versions are not trusted by the analytics layer.

## Metric semantics

`lib/metrics.ts` is the canonical implementation of:

- trusted-account rules
- platform normalization
- observed vs expected counts
- audience aggregation
- TikTok total-like aggregation
- YouTube total-view aggregation
- completeness
- canonical account-set identity

Pages should not reimplement these rules independently.

## Missing data

A missing observation is never converted to zero.

Current-value screens may show an observed partial sum with coverage when appropriate, while historical lines and Growth calculations require complete observations. Platform values distinguish:

- no canonical account for that platform: structurally zero / not applicable
- canonical account exists but observation is missing: unknown

## Growth comparability

A Growth value is valid only when:

1. both endpoints are complete for the requested metric; and
2. the canonical account set is identical at both endpoints.

This prevents a newly added social account, handle migration, or directory correction from being misreported as organic growth.

## Group semantics

Primary-group ecosystem totals are:

```text
group official accounts + canonical member accounts
```

Concurrent units such as PiKi keep member relations without duplicating ownership of the same personal accounts. Therefore special units and trainee units are displayed separately from directly comparable primary-group ecosystem rankings.

## Integrity checks

`scripts/validate-snapshots.mjs` verifies before publication:

- history filenames and snapshot dates agree
- latest points to the newest history date
- no duplicate platform/handle rows
- latest canonical account set matches the directory
- trusted YouTube parser use on current-era observations
- `series.json` dates match history files
- public and internal latest files are synchronized

CI additionally typechecks and builds the static export.

## Legacy DB/API path

The Prisma/PostgreSQL schema and platform API collectors remain a **manual-only legacy/future path** through `.github/workflows/collect-social-stats.yml`. They are not part of the production daily schedule.

If a higher-fidelity API/provider architecture replaces the file-backed path later, it should preserve the same identity/observation/metric semantics rather than creating a second definition of the data.
