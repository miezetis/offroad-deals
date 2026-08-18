import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * autoscout24.com, Europe's largest car marketplace. Behind bot protection,
 * fetched via Bright Data. Structured data lives in __NEXT_DATA__ under
 * props.pageProps.listings — no DOM scraping needed.
 *
 * Searches the plain Land Cruiser category (1577 total results as of
 * 2026-08-13, far too many to page through fully) sorted price-ascending
 * (&sort=price&desc=0, confirmed via the `inspect` workflow to genuinely
 * return low-to-high prices) — same trick auto24.ts uses: the cheap pages
 * ARE the budget band this tool cares about. matchTargetVariant in
 * ingest.ts still does the real filtering down to the exact target variants.
 *
 * Country scope: defaults to cy=D,A,B,E,F,I,L,NL (Germany, Austria,
 * Belgium, Spain, France, Italy, Luxembourg, Netherlands) when no `cy`
 * param is given. Tried widening it to more countries but an invalid/
 * unsupported country code zeroes out the entire result set rather than
 * being ignored, and burning paid requests guessing at AutoScout24's exact
 * valid code list wasn't worth it. Left at the default 8-country scope.
 */

const SEARCH_URLS = [
  "https://www.autoscout24.com/lst/toyota/land-cruiser?sort=price&desc=0",
];
// Cut 2026-08-13 (was 2/8) after the owner ran out of Bright Data free-tier
// credits mid-month — price-ascending sort means even 1 shallow page still
// covers the cheap/budget end of the market that matters most here.
const PAGES_PER_DEPTH = 1;
const MAX_PAGES = 4;

const FUEL_MAP: Record<string, "diesel" | "petrol"> = {
  gasoline: "petrol",
  petrol: "petrol",
  diesel: "diesel",
};

type AS24Listing = {
  id: string;
  url: string;
  price?: { priceRaw?: number };
  images?: string[];
  vehicle: {
    make?: string;
    model?: string;
    modelVersionInput?: string;
    fuel?: string;
    transmission?: string;
  };
  location?: { countryCode?: string };
  tracking?: { firstRegistration?: string };
  vehicleDetails?: { data: string; iconName: string }[];
};

export function extractListings(html: string): AS24Listing[] {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return [];
  const data = JSON.parse(m[1]);
  return data?.props?.pageProps?.listings ?? [];
}

export function toListing(l: AS24Listing): RawListing | undefined {
  const price = l.price?.priceRaw;
  if (!price || !l.url) return undefined;

  const make = l.vehicle.make ?? "Toyota";
  const model = l.vehicle.model ?? "";
  const title = [make, model, l.vehicle.modelVersionInput].filter(Boolean).join(" ");

  const fuel = l.vehicle.fuel ? FUEL_MAP[l.vehicle.fuel.toLowerCase()] : undefined;

  // "new" (unregistered dealer stock) has no first-registration date —
  // treated as this year's model rather than dropped, since
  // matchTargetVariant requires a year.
  const firstReg = l.tracking?.firstRegistration;
  const year = firstReg === "new" ? new Date().getFullYear() : parseYear(firstReg ?? "");

  const mileageText = l.vehicleDetails?.find((d) => d.iconName === "mileage_odometer")?.data;
  const mileageKm = mileageText && /\d/.test(mileageText)
    ? parseInt(mileageText.replace(/\D/g, ""), 10)
    : undefined;

  const transmission = l.vehicle.transmission?.toLowerCase().includes("manual")
    ? "manual"
    : l.vehicle.transmission?.toLowerCase().includes("automat")
      ? "automatic"
      : undefined;

  return {
    sourceId: l.id,
    url: l.url.startsWith("http") ? l.url : `https://www.autoscout24.com${l.url}`,
    title,
    price,
    currency: "EUR",
    year,
    mileageKm,
    fuel,
    transmission,
    country: l.location?.countryCode,
    imageUrl: l.images?.[0],
  };
}

export const autoscout24: Source = {
  name: "autoscout24",
  country: "EU",
  enabled: brightdataAvailable,
  expectedMinimum: 15,
  async scan(maxPages) {
    const out: RawListing[] = [];
    const pages = Math.min(maxPages * PAGES_PER_DEPTH, MAX_PAGES);
    for (const baseUrl of SEARCH_URLS) {
      for (let page = 1; page <= pages; page++) {
        const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;
        try {
          const html = await fetchViaBrightdata(url);
          const listings = extractListings(html);
          if (listings.length === 0) break;
          for (const l of listings) {
            const row = toListing(l);
            if (row) out.push(row);
          }
        } catch (err) {
          console.log(`autoscout24: ${baseUrl} page ${page} failed, keeping ${out.length} rows so far: ${(err as Error).message.slice(0, 120)}`);
          break;
        }
      }
    }
    console.log(`autoscout24: ${out.length} rows fetched (unfiltered)`);
    return out;
  },
};
