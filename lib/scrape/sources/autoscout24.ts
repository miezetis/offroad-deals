import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * autoscout24.com, Europe's largest car marketplace. Behind bot protection,
 * fetched via Bright Data. Structured data lives in __NEXT_DATA__ under
 * props.pageProps.listings — no DOM scraping needed.
 *
 * Uses AutoScout24's own "ve_grj" variant filter (found via a live web
 * search, confirmed 2026-08-13 via the `inspect` workflow) rather than a
 * plain model search: it pre-filters to the GRJ engine-code family
 * (GRJ71/76/78/79 — the 4.0 V6 petrol 70-series), which is a much better
 * match density than a generic "Toyota Land Cruiser" search would give,
 * given how rare the GRJ76 wagon specifically is. matchTargetVariant in
 * ingest.ts still does the real filtering down to exactly the 76 body.
 *
 * Country scope: defaults to cy=D,A,B,E,F,I,L,NL (Germany, Austria,
 * Belgium, Spain, France, Italy, Luxembourg, Netherlands) when no `cy`
 * param is given. Tried widening it to more countries (Czech Republic,
 * Poland, UK, etc — real GRJ76 listings are known to exist in some of
 * these per a live web search) but an invalid/unsupported country code
 * zeroes out the entire result set rather than being ignored, and burning
 * paid requests guessing at AutoScout24's exact valid code list wasn't
 * worth it. Left at the default 8-country scope, which is where the
 * German/Italian overland-conversion dealers actually selling these
 * appear to be concentrated anyway.
 */

const BASE_URL = "https://www.autoscout24.com/lst/toyota/land-cruiser/ve_grj";
const MAX_PAGES = 3; // confirmed via inspect: 47 results / ~19-20 per page

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
  const model = l.vehicle.model ?? "Land Cruiser";
  const title = [make, model, l.vehicle.modelVersionInput].filter(Boolean).join(" ");

  const fuel = l.vehicle.fuel ? FUEL_MAP[l.vehicle.fuel.toLowerCase()] : undefined;

  // "new" (unregistered dealer stock, common for these specialist
  // overland-conversion builds) has no first-registration date — treated as
  // this year's model rather than dropped, since matchTargetVariant requires
  // a year and most real GRJ76 stock on this site is exactly this: new.
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
  // Narrow single-variant filter — a healthy run finding nothing is normal,
  // not a sign of breakage. See lib/scrape/sources/theparking.ts for the
  // same reasoning.
  expectedMinimum: 0,
  async scan() {
    const out: RawListing[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
      try {
        const html = await fetchViaBrightdata(url);
        const listings = extractListings(html);
        if (listings.length === 0) break;
        for (const l of listings) {
          const row = toListing(l);
          if (row) out.push(row);
        }
      } catch (err) {
        console.log(`autoscout24: page ${page} failed, keeping ${out.length} rows so far: ${(err as Error).message.slice(0, 120)}`);
        break;
      }
    }
    console.log(`autoscout24: ${out.length} rows in the GRJ engine-code family`);
    return out;
  },
};
