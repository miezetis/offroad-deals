import { fetchPage } from "../http";
import type { RawListing, Source } from "../types";

/**
 * marktplaats.nl (Netherlands). Everything lives in __NEXT_DATA__ as
 * structured JSON, same shape of win as otomoto. Search is per-keyword
 * (like bazos), since the category is generic "auto's" with no per-model
 * URL slugs. Most ads are Dutch, but a minority are cross-border stock from
 * exporters, so the listing's own country is used when present.
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
  "mercedes g klasse",
  "uaz",
  "subaru forester",
  "subaru outback",
  "subaru impreza",
];

const RESULTS_PER_PAGE = 30;

const COUNTRY_MAP: Record<string, string> = {
  NL: "NL", DE: "DE", PL: "PL", BE: "NL" /* nearest tracked market */,
};

type MpListing = {
  itemId: string;
  title: string;
  description?: string;
  priceInfo?: { priceCents?: number };
  location?: { cityName?: string; countryAbbreviation?: string; abroad?: boolean };
  imageUrls?: string[];
  attributes?: { key: string; value?: string }[];
};

function extractListings(html: string): MpListing[] {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return [];
  const data = JSON.parse(m[1]);
  return data?.props?.pageProps?.searchRequestAndResponse?.listings ?? [];
}

function toListing(item: MpListing): RawListing | undefined {
  const priceCents = item.priceInfo?.priceCents;
  if (!priceCents) return undefined;

  const attr = (key: string) => item.attributes?.find((a) => a.key === key)?.value;
  const yearStr = attr("constructionYear");
  const mileageStr = attr("mileage");

  return {
    sourceId: item.itemId,
    url: `https://www.marktplaats.nl/v/auto-s/${item.itemId}`,
    title: item.title,
    price: Math.round(priceCents / 100),
    currency: "EUR",
    year: yearStr ? parseInt(yearStr, 10) : undefined,
    mileageKm: mileageStr ? parseInt(mileageStr, 10) : undefined,
    fuel: attr("fuel")?.toLowerCase().includes("diesel")
      ? "diesel"
      : attr("fuel")?.toLowerCase().includes("benzine") || attr("fuel")?.toLowerCase().includes("benzin")
        ? "petrol"
        : attr("fuel")?.toLowerCase().includes("lpg")
          ? "lpg"
          : attr("fuel")?.toLowerCase().includes("hybrid")
            ? "hybrid"
            : attr("fuel")?.toLowerCase().includes("elektr")
              ? "electric"
              : undefined,
    transmission: attr("transmission")?.toLowerCase().includes("handgeschakeld")
      ? "manual"
      : attr("transmission")?.toLowerCase().includes("automa")
        ? "automatic"
        : undefined,
    location: item.location?.cityName,
    country: item.location?.countryAbbreviation
      ? COUNTRY_MAP[item.location.countryAbbreviation]
      : undefined,
    // Marktplaats images are protocol-relative ("//images...").
    imageUrl: item.imageUrls?.[0] ? `https:${item.imageUrls[0]}` : undefined,
    snippet: item.description?.slice(0, 200),
  };
}

export const marktplaats: Source = {
  name: "marktplaats",
  country: "NL",
  expectedMinimum: 40,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const keyword of KEYWORDS) {
      const query = encodeURIComponent(keyword);
      for (let page = 1; page <= maxPages; page++) {
        try {
          const html = await fetchPage(
            `https://www.marktplaats.nl/l/auto-s/q/${query}/p/${page}/`,
          );
          const items = extractListings(html);
          for (const item of items) {
            const listing = toListing(item);
            if (listing) all.push(listing);
          }
          if (items.length < RESULTS_PER_PAGE) break;
        } catch {
          break;
        }
      }
    }
    return all;
  },
};
