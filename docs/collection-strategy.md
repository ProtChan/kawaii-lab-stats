# Collection strategy

## Principles

1. Official account identity and changing metric values are separate datasets.
2. Every metric snapshot must have a capture timestamp and source type.
3. Prefer official APIs. Do not silently fall back to brittle scraping.
4. Never fabricate a missing account or metric. Unknown stays unknown.
5. Preserve platform IDs once resolved so handle changes do not break history.
6. Keep collection runs auditable: success/partial/failure and errors are stored.

## Current directory source

The initial account directory is verified against the KAWAII LAB. official profile page:

- https://kawaiilab.asobisystem.com/news/2/
- verified: 2026-08-24 JST

Tracked organizational units:

- FRUITS ZIPPER
- CANDY TUNE
- SWEET STEADY
- CUTIE STREET
- MORE STAR
- KAWAII LAB. MATES
- KAWAII LAB. SOUTH

The KAWAII LAB. project account itself is also tracked.

## Platform collectors

### YouTube — implemented

`scripts/collect-youtube.mjs`

Uses YouTube Data API v3 channel statistics and records:

- `SUBSCRIBERS`
- `VIEWS`
- `VIDEOS`

Required environment variable:

```text
YOUTUBE_API_KEY
```

Important: public subscriber counts returned by the YouTube Data API are rounded for channels above 1,000 subscribers. Store the API value as-is and do not imply greater precision.

### X — implemented

`scripts/collect-x.mjs`

Uses X API v2 user lookup with `user.fields=public_metrics` and records:

- `FOLLOWERS` from `followers_count`
- `POSTS` from `tweet_count`

Required environment variable:

```text
X_BEARER_TOKEN
```

The resolved stable X user ID is saved to `SocialAccount.platformId`.

### Instagram — provider pending

Do not ship an unaudited HTML scraper as the default collector. The preferred order is:

1. official Meta/Instagram API access suitable for the target public professional accounts;
2. a licensed data provider with clear provenance;
3. timestamped manual/imported observations as a temporary fallback.

All fallbacks must identify `sourceType` and `sourceUrl`.

### TikTok — provider pending

Public-profile collection capabilities depend on the API product and access granted to the application. Until a compliant source is configured, use the generic snapshot import path rather than embedding a fragile scraper in the core collector.

## Manual/import fallback

`scripts/import-snapshots.mjs` accepts a JSON array. Example:

```json
[
  {
    "entitySlug": "fruits-zipper",
    "platform": "INSTAGRAM",
    "metric": "FOLLOWERS",
    "value": 1234567,
    "capturedAt": "2026-08-24T18:00:00+09:00",
    "sourceUrl": "https://www.instagram.com/fruits_zipper/",
    "sourceType": "MANUAL_PUBLIC_PROFILE"
  }
]
```

Run:

```bash
npm run import:snapshots -- ./snapshots.json
```

## Recommended cadence

- follower/subscriber counts: 1–4 snapshots/day initially;
- high-momentum periods: hourly only if the provider terms, quotas, and costs allow it;
- account directory re-verification: daily automated diff or at least weekly;
- persist raw API response fragments needed for audit/debugging, but do not store secrets.

## Aggregation rules

A person's total social following is the sum of the latest comparable follower/subscriber snapshot for each chosen platform. The UI must expose which platforms are included.

Group-level member totals and group-account totals are different metrics and must not be mixed without an explicit label. A useful convention is:

- `group official`: official group account only;
- `members sum`: sum of member accounts;
- `ecosystem total`: group official + member accounts.

When comparing growth, prefer absolute growth, percentage growth, and a normalized momentum metric side-by-side rather than collapsing everything into one opaque score.
