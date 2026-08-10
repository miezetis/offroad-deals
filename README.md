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
| Vehicles | Classic body-on-frame 4x4s only |
| Fuel | Diesel preferred, petrol and LPG acceptable |
| Transmission | Manual preferred (scoring bonus, not a hard filter) |
| Condition floor | Minor work acceptable, no rotten frame and no blown engine |

## Architecture

- **Site**: Next.js 16 App Router on Vercel, reads Postgres directly.
- **Scraper**: TypeScript, runs hourly on GitHub Actions. Vercel's Hobby plan
  restricts cron frequency, so scheduling lives in Actions instead.
- **Database**: Neon Postgres.
- **Scoring**: rolling market medians built from the tool's own scraped corpus,
  then a Claude pass over the top candidates only.
- **Auth**: password gate in `proxy.ts`, session cookie derived from
  `SITE_PASSWORD`.

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
| FI | tori.fi | shell only | client-rendered, needs their internal JSON API |
| EE | auto24.ee | **blocked** | Cloudflare security check |
| EE | soov.ee | **blocked** | Cloudflare |
| LT | autoplius.lt | **blocked** | Cloudflare |
| LT | autogidas.lt | **blocked** | Cloudflare |
| PL | olx.pl | **blocked** | CloudFront 403 |
| DE | mobile.de | **blocked** | hard access denied |

The blocked set is why Bright Data is a requirement rather than a nice-to-have:
it includes every Lithuanian and Estonian source, which is the home market.

To keep paid request volume low, blocked sites are crawled by newest-first
category listing (a few pages per run) rather than per-model, with a deeper
sweep once a day.

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
