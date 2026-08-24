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
https://protchan.github.io/kawaii-lab-stats/groups/
https://protchan.github.io/kawaii-lab-stats/members/
https://protchan.github.io/kawaii-lab-stats/rankings/
https://protchan.github.io/kawaii-lab-stats/compare/
https://protchan.github.io/kawaii-lab-stats/coverage/
https://protchan.github.io/kawaii-lab-stats/directory/
https://protchan.github.io/kawaii-lab-stats/methodology/
https://protchan.github.io/kawaii-lab-stats/data/latest.json
```

The compare page stores state in query parameters. Example:

```text
/compare/?scope=members&metric=tiktokLikes&group=cutie-street
```

This opens CUTIE STREET-related members with TikTok total likes selected.

## Daily collection

`.github/workflows/collect-daily-public.yml` is the only automatic social-profile collection workflow.

It is scheduled once per day at `15:00 UTC` (`00:00 JST`). The collector first checks `data/live/history/YYYY-MM-DD.json`; if that JST day's completed snapshot already exists, it exits before making any profile request.

The workflow can also be dispatched manually, but the same completed-day guard prevents a second set of profile reads for that JST day.

Run locally:

```bash
npm install
npm run directory:validate
npm run collect:daily-public
```

No PostgreSQL or social-platform API secret is required for this public snapshot path.

## Per-platform daily metrics

### X

- followers
- following
- posts
- verification state

### Instagram

- followers
- following
- posts

A login wall is recorded as a missing observation, never as zero.

### TikTok

- followers
- following
- videos/posts
- **profile total likes/hearts**

`likes` is the cumulative profile-level TikTok likes value, not the likes on one video.

### YouTube

YouTube uses one public channel About-page read per channel per JST day. The same page is used to capture:

- subscribers
- video count
- **total channel views**

The collector does not make a second YouTube channel read just for total views. Publicly abbreviated values remain marked as abbreviated rather than being reverse-engineered.

## Public-profile readers

X / Instagram / TikTok use Pulse's profile endpoint:

```text
https://pulse.walls.sh/profile/batch
```

The project uses batches of 40 with a 25-second gap so the provider's free rate limit is not exceeded.

YouTube is routed separately to the channel's public About page so total channel views can be captured in the same single daily channel read.

Stored fields include source URL/type, capture time, raw public metrics and extraction errors instead of fabricated zeros.

## Once-per-day guarantee

The collector intentionally does **not retry individual profiles on the same JST day**. A failed or login-walled profile is recorded as a missing observation for that day.

## Automatic publication flow

```text
00:00 JST daily
   ↓
validate data/directory
   ↓
read each canonical account once
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

GitHub Actions cron is scheduled for midnight JST; GitHub may start a scheduled run slightly later than the nominal cron time.

## Aggregation rules

For each primary group the site exposes:

- `official` — sum of the group's official SNS account audiences
- `members` — sum of that group's member SNS account audiences
- `ecosystem` — official + members
- platform mix — X / Instagram / TikTok / YouTube audience sums
- `youtubeViews` — total channel-view sum for observed YouTube accounts
- `tiktokLikes` — total profile-like sum for observed TikTok accounts
- coverage — successfully observed accounts / expected canonical accounts
- daily gain — today's ecosystem sum minus the previous daily snapshot

These are sums of account audiences, **not deduplicated unique people**.

PiKi membership does not duplicate 松本かれん or 桜庭遥花 into the main group rollups; their PiKi relation is stored as a concurrent `UNIT` membership.

## Data-quality decisions

- KAWAII LAB. and MATES references to the same `@kawaiilab.mates` TikTok have one canonical owner
- KAWAII LAB. Instagram `@kawaii_lab.2022` is included from an official ASOBISYSTEM source
- KAWAII LAB. and 鎮西寿々歌 YouTube entries use stable channel-ID URLs
- 澤村いろは Instagram/TikTok use `@iroha_sawamura`
- 有村心晴 TikTok uses `@koha_ru411`
- MORE STAR's 鈴木花梨 and 山本るしあ remain members and are marked `HIATUS`
- unknown values remain unknown
- source and capture time are preserved in the public JSON

## Legacy DB/API path

The PostgreSQL + Prisma models and official X / YouTube / Meta collectors remain in the repository for later higher-fidelity use. `.github/workflows/collect-social-stats.yml` is manual-only.

## Local site

```bash
npm install
npm run demo
```

## License / trademarks

Choose a source-code license before accepting public contributions. Names, logos and trademarks remain the property of their respective owners.
