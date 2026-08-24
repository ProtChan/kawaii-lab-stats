# Collection strategy

## Principles

1. Official account identity and changing metric values are separate datasets.
2. Every metric snapshot has a capture timestamp and source type.
3. Prefer official APIs, then approved/licensed providers, then explicitly authorized web collection.
4. Never silently fall back to unapproved scraping.
5. Never fabricate a missing account or metric. Unknown stays unknown.
6. Preserve platform IDs once resolved so handle changes do not break history.
7. Keep collection runs auditable: success/partial/failure and errors are stored.
8. Primary-group, trainee and concurrent-unit memberships remain distinguishable.
9. Project/group/unit official accounts are first-class collection targets, not just directory metadata.

## Current directory coverage

Verified 2026-08-24 JST.

Primary groups:

- FRUITS ZIPPER
- CANDY TUNE
- SWEET STEADY
- CUTIE STREET
- MORE STAR

Concurrent unit:

- PiKi — 松本かれん + 桜庭遥花, represented as `UNIT` memberships rather than duplicate member entities

Trainee units:

- KAWAII LAB. MATES
- KAWAII LAB. SOUTH

The KAWAII LAB. project account itself is also tracked. Source URLs are stored in `data/directory/`.

## Collection precedence

For each account/metric, choose the first usable source:

1. official platform API;
2. approved/licensed provider;
3. explicitly authorized web source whose automated collection terms have been checked;
4. timestamped manual/imported observation;
5. missing observation.

A failure in one source does not justify inventing a value or automatically changing to a prohibited source.

## Scheduled execution

`.github/workflows/collect-social-stats.yml` runs every 6 hours and also supports `workflow_dispatch`.

The runner executes only collectors whose credentials/configuration are present. A `PARTIAL` platform run keeps all successful observations and does not fail the entire schedule. A full collector failure does fail the unified run.

Before collecting, CI runs `npm run directory:validate` so project/group/unit official accounts cannot silently disappear from the canonical directory.

## Unified runner

`scripts/collect-all.mjs` orchestrates:

- YouTube API
- X API
- Instagram Business Discovery
- licensed/approved snapshot provider
- permission-gated authorized web fallback

All platform-specific collectors query every active `SocialAccount` of that platform. That includes member accounts and project/group/unit official accounts.

## YouTube

`scripts/collect-youtube.mjs`

Uses YouTube Data API v3 and records:

- `SUBSCRIBERS`
- `VIEWS`
- `VIDEOS`

Required:

```text
YOUTUBE_API_KEY
```

Public subscriber counts can be rounded by YouTube. Store the API value as returned.

## X

`scripts/collect-x.mjs`

Uses X API v2 user lookup with `user.fields=public_metrics` and records:

- `FOLLOWERS`
- `POSTS`

Required:

```text
X_BEARER_TOKEN
```

The stable X user ID is saved to `SocialAccount.platformId`.

Direct automated scraping of X is not a default fallback; use the API or another explicitly authorized source.

## Instagram

`scripts/collect-instagram.mjs`

Uses Meta Business Discovery where the target account is eligible and records:

- `FOLLOWERS`
- `POSTS`

Required:

```text
META_ACCESS_TOKEN
META_IG_USER_ID
META_GRAPH_VERSION
```

Business Discovery is intentionally partial. Ineligible targets remain unavailable for that run instead of silently switching to HTML scraping.

## TikTok

The normal TikTok developer flow is user-authorization oriented and does not provide a simple arbitrary-public-profile tracker for this use case. Research Tools can expose public account statistics but require separate approval and eligibility.

Automated TikTok scraping without approval is not used as the default fallback. Until approved Research access is available, use an approved/licensed provider or an imported observation.

If approved Research access is later added, normalize:

- `FOLLOWERS` ← follower count
- `LIKES` ← likes count
- `VIDEOS` ← video count

and preserve the raw API fragment and source type.

## Approved/licensed provider

`scripts/collect-provider.mjs`

Configure:

```text
SNAPSHOT_PROVIDER_URL
SNAPSHOT_PROVIDER_TOKEN
```

The endpoint returns an array (or `{ "snapshots": [] }`) containing normalized observations such as:

```json
{
  "entitySlug": "fruits-zipper",
  "platform": "TIKTOK",
  "metric": "FOLLOWERS",
  "value": 1234567,
  "capturedAt": "2026-08-24T18:00:00+09:00",
  "sourceUrl": "provider-or-source-url",
  "sourceType": "LICENSED_PROVIDER"
}
```

The collector maps those observations back to canonical `SocialAccount` rows and writes ordinary `MetricSnapshot` records.

## Authorized web fallback

`scripts/collect-authorized-web.mjs` reads `data/collectors/authorized-web.json`.

It is disabled unless:

```text
ENABLE_AUTHORIZED_WEB_SCRAPING=true
```

Every enabled target must explicitly contain:

- entity slug
- platform
- metric
- target URL
- extraction regex/pattern
- `termsConfirmed: true`
- a non-empty `permissionBasis`

The collector checks `robots.txt` before requesting the target. Direct X / Instagram / TikTok / YouTube domains are separately disabled by default. Only turn on `ALLOW_DIRECT_PLATFORM_SCRAPING=true` when explicit permission for that automated collection actually exists and is documented in `permissionBasis`.

## Manual/import fallback

`scripts/import-snapshots.mjs` remains available for one-off or manually verified observations.

```bash
npm run import:snapshots -- ./snapshots.json
```

Manual values must still include provenance and capture time.

## Cadence

Initial schedule: every 6 hours for the unified collector.

This gives four observations/day when a source is available. Later, cadence can be platform-specific:

- stable follower counts: 6–24 hours;
- high-momentum periods: hourly only when API/provider quotas and terms allow it;
- official account directory verification: at least weekly, ideally automated daily diff;
- never increase polling frequency merely to bypass rate limits.

## Aggregation rules

A person's total social following is the sum of the latest comparable follower/subscriber snapshot for each selected platform. The UI must expose which platforms are included.

Group-related totals are distinct:

- `group official`: official group account(s) only;
- `members sum`: member accounts only;
- `ecosystem total`: group official + member accounts.

Do not present those three as interchangeable.

For PiKi, member accounts must not be double-counted into a KAWAII LAB.-wide unique entity rollup merely because the same people also hold `UNIT` memberships.

When comparing growth, show absolute growth, percentage growth and normalized momentum side-by-side rather than collapsing everything into one opaque score.
