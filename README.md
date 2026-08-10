# Offroad Deals

Private tool that scans Baltic and Central European classified sites hourly for
underpriced body-on-frame 4x4s, scores them against a self-built market
reference, and lists the best ones.

Live at `offroad.miezetis.com`, behind a password.

## Buyer profile

Driving every filter and score in the app:

| | |
|---|---|
| Based in | Lithuania |
| Will travel | Anywhere in EE / LV / LT / FI / PL / SK / DE |
| Budget | 5,000 to 10,000 EUR (car only, before transport and registration) |
| Vehicles | Toyota and Subaru only: Land Cruiser, Hilux Surf / 4Runner, RAV4, Forester, Outback |
| Fuel | Diesel preferred, petrol and LPG acceptable |
| Transmission | Manual preferred (scoring bonus, not a hard filter) |
| Condition floor | Minor work acceptable, no rotten frame and no blown engine |

## Architecture

- **Site**: Next.js 16 App Router on Vercel, reads Postgres directly.
  Password gate in `proxy.ts`, star/hide via server actions.
- **Scraper**: TypeScript, hourly on GitHub Actions (`scan.yml`). Hourly runs
  read one page per model category; a nightly deep sweep (02:40 UTC, 6 pages)
  keeps `last_seen` honest so vanished ads get marked inactive after 50h.
- **Database**: Neon Postgres. `listings`, `price_history`, `evaluations`,
  `scan_runs`, `user_flags`.
- **Scoring** (`lib/pipeline/score.ts`): the corpus is scraped wide
  (500-35000 EUR) so the 12k cars prove the 7k car is cheap. Median per model
  within +-3 years (min 5 comps), price delta, desirability, diesel and manual
  bonuses, mileage bands, landed-cost window, red-flag phrases.
- **AI pass** (`lib/pipeline/evaluate.ts`): Claude Haiku reads only the top
  candidates (score >= 55, max 12 per run), grounded with 5 real comps from
  the corpus, cached by content hash so a listing is paid for once until it
  changes.
- **Autonomy**: new deals scoring >= 70 arrive as GitHub issues labelled
  `deals`; parser drift or blocks file under `health`; a weekly heartbeat
  commit defeats GitHub's 60-day scheduled-workflow disable; a `concurrency`
  group stops overlapping runs.
- **Blocked sites**: the `inspect` workflow fetches any URL through Bright
  Data in CI and uploads the HTML as an artifact, so parsers for autoplius,
  autogidas, auto24 and mobile.de get written against real markup without the
  key leaving CI.

## Source sites

Measured directly, not assumed. A plain `fetch` with browser-like headers either
returns real listing data or gets challenged.

| Country | Site | Direct fetch | Where the data lives |
|---|---|---|---|
| LV | ss.com | works | plain HTML table |
| FI | nettiauto.com | works | embedded JSON (`"price":23700`) plus card markup. Note: `www.` fails DNS, use the bare host |
| PL | otomoto.pl | works | `__NEXT_DATA__` JSON, the richest structured source of the set |
| SK | autobazar.sk | works | `.price` card markup |
| SK | bazos.sk | works | plain HTML |
| DE | kleinanzeigen.de | works | card markup plus JSON-LD blocks |
| LT | autoplius.lt | via Bright Data | newest-first all-cars feed (order_by=3), matcher filters |
| LT | autogidas.lt | via Bright Data | default bump-newest feed |
| EE | auto24.ee | via Bright Data | SUV category (a=102), cheap-end-first, deep sweep covers the rest |
| FI | tori.fi | not scraped | client-rendered; nettiauto covers FI |
| EE | soov.ee | not scraped | Cloudflare; auto24 covers EE |
| PL | olx.pl | not scraped | CloudFront 403; otomoto covers PL |
| DE | mobile.de | not scraped | hard block; kleinanzeigen covers DE |

The Bright Data trio no-ops cleanly when `BRIGHTDATA_API_KEY` is unset. Feed
strategy keeps paid volume at roughly 8 requests per hourly run.

## Environment variables

| Name | Used by | Purpose |
|---|---|---|
| `SITE_PASSWORD` | site | The single password protecting the whole app |
| `DATABASE_URL` | site, scraper | Neon **pooled** connection string |
| `ANTHROPIC_API_KEY` | scraper | Deal evaluation pass |
| `BRIGHTDATA_API_KEY` | scraper | Fallback for sites that block direct scraping |

Local development uses `.env.local`, which is gitignored.

## Commands

```bash
npm run dev     # local dev server on :3000
npm run build   # production build and typecheck
```
