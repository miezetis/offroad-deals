# Offroad Deals

Scans European classified sites every two hours for underpriced 4x4s, scores
each advert against a market reference built from its own scraped corpus, and
lists the best deals. The scoring judges the advert, not the reader, so it is
useful to anyone shopping for one of these vehicles.

The code is public; the running instance is not. It lives at
`offroad.miezetis.com` behind a password, and its database, listings, and all
credentials are private. Nothing here is secret: no keys are committed, and
every secret is injected at runtime from GitHub Actions secrets and Vercel
environment variables.

## What the score means

The score rates the **advert**, not its fit to any particular person. Anyone
can read it the same way. Every factor is a property of the listing or the
vehicle:

| Factor | Range | What it measures |
|---|---|---|
| Baseline | +20 | Every listing starts here, so one bad factor does not bottom out the score |
| Market value | -28 to **+50** | Asking price against the median of comparable listings for the same model, from this tool's own corpus. Damped when few comparables exist |
| Model | 0 to +18 | How capable the vehicle is offroad, independent of price |
| Mileage | -15 to +10 | Distance per year of age, not the raw odometer, so an old truck is not punished for being old |
| Red flags | -30 to 0 | Phrases in the seller's own text: engine damage, no roadworthiness certificate, sold for parts, accident |
| Missing data | -9 to 0 | Ads that do not state year, mileage or fuel are harder to trust and to compare |
| Price plausibility | -12 | Under 2,000 EUR is rarely a running, road-legal example of anything on the list |

Deliberately **not** in the score: budget, fuel, gearbox, location, shipping
or import costs. Those are personal, so they live in the filters where each
reader sets their own. A well-priced 18,000 EUR truck scores well and an
overpriced 4,000 EUR one does not.

## Vehicles covered

A wide list of body-on-frame 4x4s, pickups, one van, and Subaru wagons; the
full whitelist with per-generation notes is in `lib/vehicles.ts`. Anything not
on it is discarded before it reaches the database, which is what keeps the
tool free of the crossover noise that dominates these sites.

## Architecture

- **Site**: Next.js 16 App Router on Vercel, reads Postgres directly.
  Password gate in `proxy.ts`, star/hide via server actions.
- **Scraper**: TypeScript, every 2 hours on GitHub Actions (`scan.yml`). Runs
  read one page per model category; a nightly deep sweep (02:40 UTC, 6 pages)
  keeps `last_seen` honest so vanished ads get marked inactive after 50h.
- **Database**: Neon Postgres. `listings`, `price_history`, `evaluations`,
  `scan_runs`, `user_flags`.
- **Scoring** (`lib/pipeline/score.ts`): the corpus is scraped wide
  (500-35000 EUR) so the expensive cars prove the cheap one is cheap. Median
  per model within +-3 years (min 5 comps, damped below 20), mileage per year
  of age, offroad pedigree, red-flag phrases, missing fields, and a price
  plausibility floor. See "What the score means" above.
- **AI pass** (`lib/pipeline/evaluate.ts`): Claude Haiku reads only the top
  candidates (score >= 55, max 12 per run), grounded with 5 real comps from
  the corpus, and is instructed to appraise the advert for a general
  audience rather than any one buyer. Cached by content hash so a listing is
  paid for once until it changes.
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
| NL | marktplaats.nl | works | `__NEXT_DATA__` JSON, per-keyword search. Occasional cross-border ad; `RawListing.country` overrides the source default when the listing states one of our tracked countries |
| IT | subito.it | via Bright Data | `__NEXT_DATA__` JSON (`initialState.items.originalList`), richest spec data of any source. Pagination param is a best guess with a duplicate-detection safety check |

The Bright Data trio no-ops cleanly when `BRIGHTDATA_API_KEY` is unset. Feed
strategy keeps paid volume modest per run.

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
