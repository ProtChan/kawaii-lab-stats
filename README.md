# KAWAII LAB. Stats

Fanmade / unofficial social-media statistics site for KAWAII LAB. groups, units and members.

> Not affiliated with KAWAII LAB. or its management. Statistics are public-profile observations with source and capture timestamps.

## Current coverage — verified 2026-08-24 JST

- 5 primary groups: FRUITS ZIPPER / CANDY TUNE / SWEET STEADY / CUTIE STREET / MORE STAR
- 1 concurrent unit: PiKi
- 2 trainee units: KAWAII LAB. MATES / KAWAII LAB. SOUTH
- 59 unique member entities
- 211 canonical project/group/unit/member social accounts
- member activity state including officially announced `HIATUS`

Project, group and unit official accounts are first-class tracked accounts, not metadata-only links.

## Public site

GitHub Pages static export:

```text
https://protchan.github.io/kawaii-lab-stats/
https://protchan.github.io/kawaii-lab-stats/demo/
https://protchan.github.io/kawaii-lab-stats/directory/
https://protchan.github.io/kawaii-lab-stats/data/latest.json
```

Routes:

- `/` — real daily observations
- `/demo/` — fictional placeholder UI only
- `/directory/` — verified official-account directory
- `/data/latest.json` — latest machine-readable public snapshot
- `/data/history/YYYY-MM-DD.json` — one daily snapshot
- `/data/series.json` — group-level daily series used by the chart

## Daily collection

`.github/workflows/collect-daily-public.yml` is the only automatic social-profile collection workflow.

It runs once per day at `03:17 UTC` (`12:17 JST`) and calls the public-profile reader for every canonical account exactly once for that JST day. The collector first checks `data/live/history/YYYY-MM-DD.json`; if that day's completed snapshot already exists, it exits before making any profile request.

The initial workflow definition also has a narrow `push` trigger so deployment/collector changes can start the first snapshot. Data-only commits do not retrigger collection.

Run locally:

```bash
npm install
npm run directory:validate
npm run collect:daily-public
```

No PostgreSQL or social-platform API secret is required for this public snapshot path.

## Public-profile reader

The daily collector uses Pulse's profile endpoint:

```text
https://pulse.walls.sh/profile/batch
```

It accepts up to 50 public profile URLs per batch and normalizes profile-level fields across YouTube, X, TikTok and Instagram. This project uses batches of 40 with a 25-second gap so the free 120-lookups/minute limit is not exceeded.

Stored fields include, when public/available:

- followers / YouTube subscribers
- following
- post/video count
- TikTok total likes where returned
- verification state
- source URL
- capture timestamp
- extraction error instead of a fabricated zero

YouTube public subscriber values may be abbreviated/rounded by the platform; `precision=PUBLIC_ABBREVIATED` is retained for those observations.

Pulse's free terms are described as suitable for personal/indie projects; if this site becomes a commercial product, review and use the provider's commercial license before continuing that source.

## Once-per-day guarantee

The collector intentionally does **not retry individual profiles on the same JST day**. A failed or login-walled profile is recorded as a missing observation for that day.

This gives each account a stable observation cadence instead of repeatedly hammering profiles until they succeed.

## Automatic publication flow

```text
12:17 JST daily
   ↓
validate data/directory
   ↓
read each canonical profile once
   ↓
data/live/history/YYYY-MM-DD.json
public/data/history/YYYY-MM-DD.json
   ↓
update latest.json + series.json
   ↓
GitHub Actions commits data
   ↓
Pages workflow rebuilds
   ↓
/ displays the new observation
```

The site treats missing observations as missing. It never converts a fetch failure to zero.

## Aggregation rules

For each primary group the site exposes:

- `official` — sum of the group's official SNS accounts
- `members` — sum of that group's member SNS accounts
- `ecosystem` — official + members
- platform mix — X / Instagram / TikTok / YouTube account-count sums
- coverage — successfully observed accounts / expected canonical accounts
- daily gain — today's ecosystem sum minus the previous daily snapshot

These are sums of account audiences, **not deduplicated unique people**. One person can follow multiple accounts and platforms.

PiKi membership does not duplicate 松本かれん or 桜庭遥花 into the main group rollups; their PiKi relation is stored as a concurrent `UNIT` membership.

## Data-quality decisions

- KAWAII LAB. and MATES references to the same `@kawaiilab.mates` TikTok have one canonical owner
- KAWAII LAB. Instagram `@kawaii_lab.2022` is included from an official ASOBISYSTEM source
- MORE STAR's 鈴木花梨 and 山本るしあ remain members and are marked `HIATUS`
- the malformed official MATES TikTok link for 嶋﨑結花 is not guessed
- unknown values remain unknown
- source and capture time are preserved in the public JSON

## Legacy DB/API path

The PostgreSQL + Prisma models and official X / YouTube / Meta collectors remain in the repository for later higher-fidelity use. `.github/workflows/collect-social-stats.yml` is now manual-only so it cannot create additional automatic reads beyond the one-per-day public snapshot.

```bash
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
```

## Local site

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

## License / trademarks

Choose a source-code license before accepting public contributions. Names, logos and trademarks remain the property of their respective owners.
