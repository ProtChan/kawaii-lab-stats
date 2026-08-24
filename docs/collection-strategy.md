# Collection strategy

## Principles

1. Official account identity and changing metric values are separate datasets.
2. Every metric snapshot must have a capture timestamp and source type.
3. Prefer official APIs. Do not silently fall back to brittle scraping.
4. Never fabricate a missing account or metric. Unknown stays unknown.
5. Preserve platform IDs once resolved so handle changes do not break history.
6. Keep collection runs auditable: success/partial/failure and errors are stored.
7. Primary-group, trainee and concurrent-unit memberships must remain distinguishable.

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

The KAWAII LAB. project account itself is also tracked. Source URLs are stored in the directory JSON files; the main profile source is `https://kawaiilab.asobisystem.com/news/2/`.

## Platform collectors

### YouTube — implemented

`scripts/collect-youtube.mjs`

Uses YouTube Data API v3 channel statistics and records:

- `SUBSCRIBERS`
- `VIEWS`
- `VIDEOS`

Required:

```text
YOUTUBE_API_KEY
```

Public subscriber counts returned by the YouTube Data API are rounded for channels above 1,000 subscribers. Store the API value as-is and do not imply greater precision.

### X — implemented

`scripts/collect-x.mjs`

Uses X API v2 user lookup with `user.fields=public_metrics` and records:

- `FOLLOWERS` from `followers_count`
- `POSTS` from `tweet_count`

Required:

```text
X_BEARER_TOKEN
```

The resolved stable X user ID is saved to `SocialAccount.platformId`.

### Instagram — implemented where Business Discovery is eligible

`scripts/collect-instagram.mjs`

Uses Meta's Instagram Business Discovery pattern to query target handles and records:

- `FOLLOWERS` from `followers_count`
- `POSTS` from `media_count`

Required:

```text
META_ACCESS_TOKEN
META_IG_USER_ID
META_GRAPH_VERSION
```

This path is intentionally partial-by-design: Business Discovery only works for accounts the API can discover (not every arbitrary/personal Instagram account). Failed handles remain failed in the `CollectionRun`; the collector does **not** silently switch to HTML scraping.

### TikTok — gated official path, generic import fallback

TikTok's Research API can return public user fields including `follower_count`, `likes_count` and `video_count` by username, but Research Tools require a separate eligibility/application/approval process. The normal user-authorized API exposes `user.info.stats` for the authorized user's own profile, so it is not a general cross-account collector for this use case.

Until approved Research API access or another compliant provider is available, use the generic snapshot importer rather than embedding a fragile scraper in the core project.

If Research API access is later approved, a TikTok collector should normalize:

- `FOLLOWERS` ← `follower_count`
- `LIKES` ← `likes_count`
- `VIDEOS` ← `video_count`

and store `sourceType=TIKTOK_RESEARCH_API` plus the raw returned statistics.

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
- high-momentum periods: hourly only if provider terms, quotas, and costs allow it;
- account-directory re-verification: daily automated diff or at least weekly;
- persist raw API response fragments needed for audit/debugging, but never secrets.

## Aggregation rules

A person's total social following is the sum of the latest comparable follower/subscriber snapshot for each chosen platform. The UI must expose which platforms are included.

Group-level member totals and group-account totals are different metrics and must not be mixed without an explicit label:

- `group official`: official group account only;
- `members sum`: sum of member accounts;
- `ecosystem total`: group official + member accounts.

For PiKi, member accounts must not be double-counted into a KAWAII LAB.-wide unique entity rollup merely because the same people also hold `UNIT` memberships.

When comparing growth, prefer absolute growth, percentage growth, and a normalized momentum metric side-by-side rather than collapsing everything into one opaque score.
