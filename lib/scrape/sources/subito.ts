import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import type { RawListing, Source } from "../types";

/**
 * subito.it (Italy), behind DataDome, fetched via Bright Data. Structured
 * data lives in __NEXT_DATA__ under initialState.items.originalList, with
 * specs keyed by URI in each item's `features` map ("/price", "/fuel", ...).
 *
 * Search is per-keyword national search (annunci-italia). The `&o=` page
 * param is a best guess from general knowledge of Subito's URL scheme, not
 * verified against a live multi-page fetch (that would cost a second paid
 * request per keyword just to check). If it turns out wrong, page 2 repeats
 * page 1's first item and the loop below detects that and stops, so a bad
 * guess costs one extra BD call per keyword rather than silently duplicating
 * data forever.
 */
const KEYWORDS = [
  "toyota land cruiser",
  "lexus gx470",
  "toyota hilux",
  "toyota tacoma",
  "toyota rav4",
  "toyota 4runner",
  "mitsubishi pajero",
  "mitsubishi l200",
  "mitsubishi delica",
  "nissan patrol",
  "nissan terrano",
  "nissan pathfinder",
  "suzuki jimny",
  "suzuki samurai",
  "suzuki vitara",
  "land rover defender",
  "land rover discovery",
  "range rover classic",
  "jeep wrangler",
  "isuzu trooper",
  "isuzu d-max",
  "opel frontera",
  "ssangyong musso",
  "ssangyong korando",
  "ssangyong rexton",
  "hyundai terracan",
  "hyundai galloper",
  "kia sorento",
  "ford maverick",
  "mercedes classe g",
  "uaz",
  "subaru forester",
  "subaru outback",
  "subaru impreza",
];

const PAGES_PER_DEPTH = 2;

const FUEL_MAP: Record<string, string> = {
  diesel: "diesel",
  benzina: "petrol",
  gpl: "lpg",
  metano: "lpg",
  ibrida: "hybrid",
  elettrica: "electric",
};

type SubitoItem = {
  urn: string;
  subject: string;
  body?: string;
  images?: { cdnBaseUrl?: string }[];
  geo?: { town?: { value?: string }; city?: { value?: string } };
  urls?: { default?: string };
  features?: Record<string, { values?: { key?: string; value?: string }[] }>;
};

function feature(item: SubitoItem, uri: string) {
  return item.features?.[uri]?.values?.[0];
}

export function toListing(item: SubitoItem): RawListing | undefined {
  const url = item.urls?.default;
  const id = url?.match(/-(\d+)\.htm$/)?.[1];
  const priceStr = feature(item, "/price")?.key;
  if (!url || !id || !priceStr) return undefined;

  const price = parseInt(priceStr, 10);
  if (!Number.isFinite(price) || price <= 0) return undefined;

  const fuelLabel = feature(item, "/fuel")?.value?.toLowerCase() ?? "";
  const gearboxLabel = feature(item, "/gearbox")?.value?.toLowerCase() ?? "";

  return {
    sourceId: id,
    url,
    title: item.subject,
    price,
    currency: "EUR",
    year: feature(item, "/year")?.key ? parseInt(feature(item, "/year")!.key!, 10) : undefined,
    mileageKm: feature(item, "/mileage_scalar")?.key
      ? parseInt(feature(item, "/mileage_scalar")!.key!, 10)
      : undefined,
    fuel: FUEL_MAP[fuelLabel],
    transmission: gearboxLabel.includes("automat")
      ? "automatic"
      : gearboxLabel.includes("manual")
        ? "manual"
        : undefined,
    location: item.geo?.town?.value ?? item.geo?.city?.value,
    imageUrl: item.images?.[0]?.cdnBaseUrl
      ? `${item.images[0].cdnBaseUrl}?rule=large-fixed-card-1x-auto`
      : undefined,
    snippet: item.body?.slice(0, 200),
  };
}

export function extractItems(html: string): SubitoItem[] {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return [];
  const data = JSON.parse(m[1]);
  return data?.props?.pageProps?.initialState?.items?.originalList ?? [];
}

export const subito: Source = {
  name: "subito",
  country: "IT",
  enabled: brightdataAvailable,
  expectedMinimum: 15,
  async scan(maxPages) {
    const all: RawListing[] = [];
    const pages = Math.min(maxPages * PAGES_PER_DEPTH, 6);

    for (const keyword of KEYWORDS) {
      const query = encodeURIComponent(keyword);
      let firstIdSeen: string | undefined;

      try {
        for (let page = 1; page <= pages; page++) {
          const suffix = page === 1 ? "" : `&o=${page}`;
          const html = await fetchViaBrightdata(
            `https://www.subito.it/annunci-italia/vendita/auto/?q=${query}${suffix}`,
          );
          const items = extractItems(html);
          if (items.length === 0) break;

          if (page === 1) {
            firstIdSeen = items[0]?.urn;
          } else if (items[0]?.urn === firstIdSeen) {
            break; // pagination param had no effect, stop paying for repeats
          }

          for (const item of items) {
            const listing = toListing(item);
            if (listing) all.push(listing);
          }
          if (items.length < 20) break;
        }
      } catch (err) {
        // One flaky keyword (usually a slow Bright Data attempt) shouldn't
        // discard the other 33 keywords already fetched successfully this run.
        console.log(`subito: "${keyword}" failed, keeping ${all.length} rows so far: ${(err as Error).message.slice(0, 120)}`);
      }
    }
    return all;
  },
};
