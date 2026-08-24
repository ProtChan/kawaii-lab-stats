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
- X API v2 follower collector
- generic JSON snapshot importer for Instagram/TikTok/manual/provider observations
- GitHub Pages static-demo workflow

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

`npm run demo` binds Next.js to `0.0.0.0`, so another device on the same LAN can also open the computer's local IP on port 3000.

## GitHub Pages demo

`.github/workflows/pages.yml` builds a static export from `main` and deploys it with GitHub Pages.

Once Pages is enabled with **GitHub Actions** as the source, the expected URLs are:

```text
https://protchan.github.io/kawaii-lab-stats/
https://protchan.github.io/kawaii-lab-stats/demo/
https://protchan.github.io/kawaii-lab-stats/directory/
```

Because the repository is currently private, Pages availability depends on the GitHub plan. The intended public fanmade release can later make the repository/site public if desired.

## Important: demo values are fictional

The follower counts and growth figures in `lib/demo-data.ts` are placeholders for interface development. They are intentionally labeled DEMO and **must not be treated as current statistics**.

The account mappings in `data/directory/` are a separate source-attributed dataset.

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

The seed reads JSON files in `data/directory/` and upserts project/group/unit/member/account records. Special-unit relations are processed after primary memberships so PiKi cannot overwrite a member's main group.

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

## Data-quality decisions already handled

- the KAWAII LAB. and MATES listings point to the same `@kawaiilab.mates` TikTok; it has one canonical owner (`KAWAII LAB. MATES`) rather than duplicate ownership
- KAWAII LAB. Instagram `@kawaii_lab.2022` is included from an official ASOBISYSTEM release
- PiKi is a concurrent unit, not a duplicate copy of its two members
- MORE STAR's 鈴木花梨 and 山本るしあ remain members but are marked `HIATUS` according to the current official notice
- the official MATES profile has a malformed/incorrect TikTok link for 嶋﨑結花, so no TikTok handle is guessed
- unknown data remains unknown; missing values are never fabricated

## Next milestones

1. verify the static build/deployment in GitHub Actions
2. connect a PostgreSQL host and run the directory seed
3. collect the first real X and YouTube snapshots
4. choose compliant Instagram and TikTok collection sources
5. replace the placeholder dashboard query layer with DB-backed statistics
6. add member/group detail pages and daily/7d/30d growth calculations
7. schedule collectors and account-directory change detection
8. publish methodology/source/data-freshness pages before public launch

## License / trademarks

Choose a source-code license before public contribution is enabled. Names, logos and trademarks remain the property of their respective owners.
