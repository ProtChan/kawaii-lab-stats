# KAWAII LAB. Stats

Fanmade / unofficial social-media statistics project for KAWAII LAB. groups and members.

> This project is not affiliated with KAWAII LAB. or its management. Published statistics must include source attribution and collection timestamps.

## What is implemented

- Next.js demo analytics dashboard
- verified official-account directory sourced from the KAWAII LAB. official profile
- 5 debuted groups: FRUITS ZIPPER / CANDY TUNE / SWEET STEADY / CUTIE STREET / MORE STAR
- trainee units: KAWAII LAB. MATES / KAWAII LAB. SOUTH
- 59 member entities
- 206 canonical official social accounts in the source directory
- PostgreSQL + Prisma historical snapshot model
- membership history model for future promotions/transfers
- collection-run audit trail
- YouTube Data API collector
- X API v2 follower collector
- generic JSON snapshot importer for temporary/manual/provider data
- GitHub Pages static-demo workflow

The account directory is verified against:

- https://kawaiilab.asobisystem.com/news/2/
- verification date: 2026-08-24 JST

## View the placeholder dashboard locally

The demo does **not** require PostgreSQL.

```bash
npm install
npm run demo
```

Then open:

```text
http://localhost:3000/
http://localhost:3000/demo/
```

Verified account directory:

```text
http://localhost:3000/directory/
```

`npm run demo` binds Next.js to `0.0.0.0`, so the development server can also be reached from another device on the same LAN using the computer's local IP and port 3000.

## GitHub Pages demo

`.github/workflows/pages.yml` builds a static export from `main` and deploys it with GitHub Pages.

Expected project URL after Pages is enabled successfully:

```text
https://protchan.github.io/kawaii-lab-stats/
```

Expected explicit demo URL:

```text
https://protchan.github.io/kawaii-lab-stats/demo/
```

Expected directory URL:

```text
https://protchan.github.io/kawaii-lab-stats/directory/
```

Repository Settings → Pages should use **GitHub Actions**. GitHub Pages availability for a private repository depends on the GitHub plan; making the repository public later also fits the intended public fanmade-site use case.

## Important: demo values are fictional

The follower counts and growth figures in `lib/demo-data.ts` are placeholders for interface development. They are intentionally labeled DEMO and **must not be treated as current statistics**.

The account mappings in `data/directory/` are a separate verified dataset.

## Data model

```text
Entity
  ├─ PROJECT
  ├─ GROUP
  └─ MEMBER
       ├─ EntityMembership      historical/current affiliation
       └─ SocialAccount
            └─ MetricSnapshot   timestamped observations
                  └─ CollectionRun
```

Important fields retained for auditability include:

- stable platform ID when available
- handle and profile URL
- directory verification URL/time
- metric capture time
- collector/source type
- optional raw API fragment
- collector success/partial/failure state

## Database setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

The seed reads the JSON files in `data/directory/` and upserts project/group/member/account records.

## YouTube collection

Add to `.env`:

```text
YOUTUBE_API_KEY=...
```

Then:

```bash
npm run collect:youtube
```

Collected metrics:

- subscribers
- channel views
- video count

The YouTube Data API publicly rounds subscriber counts for channels above 1,000 subscribers, so values are stored exactly as returned instead of pretending to have more precision.

## X collection

Add to `.env`:

```text
X_BEARER_TOKEN=...
```

Then:

```bash
npm run collect:x
```

Collected metrics:

- followers
- post count

The collector also resolves and stores the stable X user ID.

## Instagram / TikTok

These are deliberately not backed by an unaudited HTML scraper in the core project. Until compliant API/provider access is selected, snapshots can be imported with provenance.

See `docs/collection-strategy.md`.

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

Import:

```bash
npm run import:snapshots -- ./snapshots.json
```

## Data-quality rules

- unknown data remains unknown; never invent missing account mappings
- one platform account has one canonical owner in the database
- changing handles should retain a stable platform ID when possible
- source and capture time travel with every published metric
- group official-account totals and member-account sums are separate concepts
- cross-platform follower sums are not called unique audience/reach
- estimates or inferred values must be labeled explicitly

## Next milestones

1. verify/build the deployment in CI
2. connect a PostgreSQL host and run the official-directory seed
3. collect the first real X and YouTube snapshots
4. choose compliant Instagram and TikTok collection sources
5. replace the demo dashboard query layer with DB-backed statistics
6. add member/group detail pages and daily/7d/30d growth calculations
7. schedule collectors and account-directory change detection
8. publish methodology/source/data-freshness pages before public launch

## License / trademarks

Choose a source-code license before public contribution is enabled. Names, logos and trademarks remain the property of their respective owners.
