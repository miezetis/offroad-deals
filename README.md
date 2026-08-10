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
