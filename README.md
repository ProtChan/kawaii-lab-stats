# KAWAII LAB. Stats

Fanmade / unofficial social-media statistics project for KAWAII LAB. groups, units and members.

> This project is not affiliated with KAWAII LAB. or its management. Published statistics must include source attribution and collection timestamps.

## Current coverage — verified 2026-08-24 JST

The directory currently models:

- 5 primary groups: FRUITS ZIPPER / CANDY TUNE / SWEET STEADY / CUTIE STREET / MORE STAR
- 1 concurrent special unit: PiKi
- 2 trainee units: KAWAII LAB. MATES / KAWAII LAB. SOUTH
- 59 unique member entities
- 211 canonical official social accounts across project/group/unit/member records
- current activity state, including `HIATUS` where officially announced

Group/unit/project official accounts are first-class `SocialAccount` records. They are collected by the same scheduled collectors as member accounts; they are not just metadata for the directory page.

PiKi does not duplicate 松本かれん or 桜庭遥花. They remain members of FRUITS ZIPPER / CUTIE STREET and receive an additional `UNIT` membership.

The main KAWAII LAB. directory source is:

- https://kawaiilab.asobisystem.com/news/2/

Additional current official sources are stored where needed, including PiKi's official site and MORE STAR's hiatus notice.

## What is implemented

- Next.js static demo analytics dashboard
- verified/source-attributed official-account directory
- PostgreSQL + Prisma historical snapshot model
- primary / trainee / concurrent-unit membership history
- entity activity status (`ACTIVE`, `HIATUS`, `INACTIVE`)
- collection-run audit trail
- YouTube Data API collector
- X API v2 follower/post collector
- Instagram Business Discovery collector for eligible Professional accounts
- provider-backed collector for unsupported platforms/accounts
- permission-gated web fallback collector for explicitly authorized sources
- generic JSON snapshot importer
- GitHub Actions collection schedule every 6 hours
- GitHub Pages static-demo workflow

## Public demo

The repository is public. The Pages workflow builds a static export from `main`.

Expected URLs after GitHub Pages is enabled with **GitHub Actions** as the source:

```text
https://protchan.github.io/kawaii-lab-stats/
https://protchan.github.io/kawaii-lab-stats/demo/
https://protchan.github.io/kawaii-lab-stats/directory/
```

The dashboard still uses fictional placeholder statistics until the DB-backed query layer is connected.

## Local demo

The placeholder dashboard does **not** require PostgreSQL.

```bash
npm install
npm run demo
```

Open:

```text
http://localhost:3000/
http://localhost:3000/demo/
http://localhost:3000/directory/
```

## Important: demo values are fictional

The follower counts and growth figures in `lib/demo-data.ts` are placeholders for interface development. They are intentionally labeled DEMO and **must not be treated as current statistics**.

The official account mappings in `data/directory/` are a separate source-attributed dataset.

## Data model

```text
Entity
  ├─ PROJECT
  ├─ GROUP
  └─ MEMBER
       ├─ EntityMembership
       │    ├─ PRIMARY
       │    ├─ TRAINEE
       │    └─ UNIT
       └─ SocialAccount
            └─ MetricSnapshot
                  └─ CollectionRun
```

Important audit fields include:

- stable platform ID when available
- handle and profile URL
- directory verification URL/time
- entity/member activity state
- metric capture time
- collector/source type
- optional raw API/provider fragment
- collection success/partial/failure state

## Database setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

The seed reads JSON files in `data/directory/` and upserts project/group/unit/member/account records. Special-unit relations are processed after primary memberships so PiKi cannot overwrite a member's main group.

## Collection precedence

Use the most stable compliant source available:

1. official platform API;
2. approved/licensed provider;
3. explicitly authorized web collection with provenance recorded;
4. manual/imported observation;
5. missing observation.

Do not fabricate a value and do not silently replace a failed API call with an unapproved scraper.

## Unified collection

Run every configured collector:

```bash
npm run collect:all
```

Collectors automatically query all active `SocialAccount` rows for the relevant platform, including project, group and unit official accounts.

A platform collector may return `PARTIAL` when some accounts are unavailable. Usable snapshots are still persisted; only a full collector failure makes `collect:all` fail.

## Scheduled collection

`.github/workflows/collect-social-stats.yml` runs every 6 hours and can also be started manually. It additionally validates collector changes pushed to `main`.

Repository **Secrets** used when configured:

```text
DATABASE_URL
YOUTUBE_API_KEY
X_BEARER_TOKEN
META_ACCESS_TOKEN
META_IG_USER_ID
SNAPSHOT_PROVIDER_URL
SNAPSHOT_PROVIDER_TOKEN
```

Repository **Variables**:

```text
META_GRAPH_VERSION
ENABLE_AUTHORIZED_WEB_SCRAPING=false
ALLOW_DIRECT_PLATFORM_SCRAPING=false
```

If `DATABASE_URL` is absent, the scheduled workflow skips collection instead of writing anywhere accidentally.

## YouTube

```bash
npm run collect:youtube
```

Uses YouTube Data API v3 and stores:

- `SUBSCRIBERS`
- `VIEWS`
- `VIDEOS`

Public subscriber counts returned by the YouTube Data API can be rounded; the project stores the API value as returned.

## X

```bash
npm run collect:x
```

Uses X API v2 user lookup with `public_metrics` and stores:

- `FOLLOWERS`
- `POSTS`

The stable X user ID is persisted to survive handle changes.

## Instagram

```bash
npm run collect:instagram
```

Uses Meta Business Discovery where the target account is eligible and stores:

- `FOLLOWERS`
- `POSTS`

Targets that Meta cannot discover are recorded as unavailable for that run rather than silently HTML-scraped.

## TikTok and other unsupported observations

TikTok's general developer APIs do not provide a simple arbitrary-public-account statistics endpoint for this fan tracker, and Research Tools require separate approval. Automated scraping of TikTok without approval is not used as a default collection path.

For a licensed/approved provider, configure:

```text
SNAPSHOT_PROVIDER_URL
SNAPSHOT_PROVIDER_TOKEN
```

and run:

```bash
npm run collect:provider
```

The provider can return X / Instagram / TikTok / YouTube snapshots and they are normalized into the same `MetricSnapshot` table.

## Authorized web fallback

`scripts/collect-authorized-web.mjs` is deliberately permission-gated. It reads `data/collectors/authorized-web.json` and requires each target to declare:

- entity/platform/metric
- URL and extraction pattern
- `termsConfirmed: true`
- a non-empty `permissionBasis`

It checks `robots.txt` before collection. Direct X / Instagram / TikTok / YouTube domains remain disabled by default and require an explicit repository variable plus recorded authorization.

Enable only when the source permits automated collection:

```text
ENABLE_AUTHORIZED_WEB_SCRAPING=true
```

Then:

```bash
npm run collect:web
```

## Generic snapshot import

Example `snapshots.json`:

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

```bash
npm run import:snapshots -- ./snapshots.json
```

## Data-quality decisions already handled

- project/group/unit official accounts are tracked independently from member-account totals
- KAWAII LAB. and MATES listings that point to the same `@kawaiilab.mates` TikTok have one canonical owner
- KAWAII LAB. Instagram `@kawaii_lab.2022` is included from an official ASOBISYSTEM source
- PiKi is a concurrent unit, not duplicate copies of its two members
- MORE STAR's 鈴木花梨 and 山本るしあ remain members but are marked `HIATUS` according to the current official notice
- the official MATES profile has a malformed/incorrect TikTok link for 嶋﨑結花, so no TikTok handle is guessed
- unknown data remains unknown; missing values are never fabricated

## Next milestones

1. add `DATABASE_URL` and run the seed against the persistent PostgreSQL database
2. add API/provider credentials as GitHub Actions secrets
3. collect the first real scheduled snapshots
4. replace placeholder dashboard data with DB-backed latest/24h/7d/30d statistics
5. add member/group detail pages and growth charts
6. add directory-change detection and stale-account alerts
7. publish methodology/source/data-freshness pages

See `docs/collection-strategy.md` for collection and aggregation rules.

## License / trademarks

Choose a source-code license before public contribution is enabled. Names, logos and trademarks remain the property of their respective owners.
