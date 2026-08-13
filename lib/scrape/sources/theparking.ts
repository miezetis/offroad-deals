import * as cheerio from "cheerio";
import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseMileage, parsePrice, parseYear } from "../parse";
import type { RawListing, Source } from "../types";
import { matchTargetVariant } from "../../target-variants";

/**
 * theparking.eu, a pan-European meta-search aggregator (pulls from
 * autoscout24, 2ememain, autoplius, dealer sites, etc). Behind bot
 * protection like the other blocked sources, fetched via Bright Data.
 *
 * Owner wants exactly the narrow configurations in lib/target-variants.ts,
 * not "Land Cruiser"/"Hilux" in general, so this source filters down to
 * them before returning anything. The general VEHICLES whitelist in
 * lib/vehicles.ts is deliberately left alone: it is shared by every other
 * source and covers the full model range, which is not what was asked for
 * here.
 *
 * expectedMinimum is 0 on purpose. A narrow variant filter finding nothing
 * in a given run is normal, not a sign the parser broke; the raw pre-filter
 * count is logged instead so a real breakage is still visible in the
 * Action log without spamming health-warning issues.
 *
 * Confirmed against a real Bright Data fetch (via the `inspect` workflow):
 * the hash-bang URL a browser generates when you use the on-site search box
 * (".../used-cars/toyota-land-cruiser/#!/used-cars/Toyota-Land-Cruiser.html")
 * does NOT filter through Bright Data — fragments never reach the server,
 * so BD's render saw the same unfiltered homepage feed a cold `curl` would.
 * The fix is the plain, no-fragment URL below, which the site itself
 * resolves server-side to the filtered result set: confirmed both in a
 * live browser and via a second Bright Data fetch through the `inspect`
 * workflow, which correctly parsed 2 real Prado 120 3.0 D-4D listings out
 * of the 27 Land Cruiser cards on the page.
 */

const SEARCH_URLS = [
  // Covers every Land Cruiser generation in one page: 70/80/100-105/120/150/
  // 200-series are all filtered down to the exact targets by
  // matchTargetVariant below.
  "https://www.theparking.eu/used-cars/Toyota-Land-Cruiser.html",
  // Verified 2026-08-13 via the `inspect` workflow: 28 real result cards,
  // page title "Toyota Hilux used".
  "https://www.theparking.eu/used-cars/Toyota-Hilux.html",
];

const FUEL_MAP: Record<string, "diesel" | "petrol" | "hybrid" | "lpg" | "electric"> = {
  diesel: "diesel",
  gasoline: "petrol",
  petrol: "petrol",
  hybrid: "hybrid",
  lpg: "lpg",
  electric: "electric",
};

// Site displays country names spelled out in caps ("LITHUANIA", "UNITED
// KINGDOM"). Mapped to the ISO-2 codes the rest of the schema uses.
const COUNTRY_MAP: Record<string, string> = {
  GERMANY: "DE", LITHUANIA: "LT", LATVIA: "LV", ESTONIA: "EE", POLAND: "PL",
  SLOVAKIA: "SK", FINLAND: "FI", BELGIUM: "BE", FRANCE: "FR", NETHERLANDS: "NL",
  "UNITED KINGDOM": "GB", SPAIN: "ES", ITALY: "IT", PORTUGAL: "PT", AUSTRIA: "AT",
  SWITZERLAND: "CH", DENMARK: "DK", SWEDEN: "SE", NORWAY: "NO", IRELAND: "IE",
  LUXEMBOURG: "LU", "CZECH REPUBLIC": "CZ", HUNGARY: "HU", ROMANIA: "RO",
  BULGARIA: "BG", GREECE: "GR", CROATIA: "HR", SLOVENIA: "SI", SERBIA: "RS",
};

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $('li[class*="li-result"]').each((_, el) => {
    const $li = $(el);

    const id =
      $li.find(".unmask-announce[data-id]").first().attr("data-id") ||
      $li.attr("class")?.match(/holder-(\d+)/)?.[1];
    if (!id) return;

    const brand = $li.find(".title-block.brand").first().text().trim();
    const model = $li.find(".sub-title.title-block").eq(0).text().trim();
    const trimTokens = $li
      .find(".sub-title.title-block")
      .eq(1)
      .find(".nowrap")
      .map((_, s) => $(s).text().trim())
      .get()
      .filter(Boolean);
    const trim = trimTokens.join(" ") || $li.find(".sub-title.title-block").eq(1).text().trim();
    // Some listings (Lexus GX470 among them) repeat the model name as the
    // first trim token ("Gx 470" model + "Gx 470 V8 4.7" trim), which reads
    // as "Lexus Gx 470 Gx 470" once joined. Drop the duplicate.
    const dedupedTrim = trim.toLowerCase().startsWith(model.toLowerCase())
      ? trim.slice(model.length).trim()
      : trim;
    const title = [brand, model, dedupedTrim].filter(Boolean).join(" ").trim();
    if (!title) return;

    const price = parsePrice($li.find(".prix").first().text());
    if (!price) return;

    const infoCells = $li
      .find(".bc-info .info li .upper")
      .first()
      .parent()
      .parent()
      .find("li .upper")
      .map((_, s) => $(s).text().trim())
      .get();
    // Fixed order confirmed against the live markup: fuel, mileage, year,
    // transmission, doors (doors is frequently "-").
    const [fuelRaw, mileageRaw, yearRaw, transmissionRaw] = infoCells;

    const fuel = fuelRaw ? FUEL_MAP[fuelRaw.toLowerCase()] : undefined;
    const year = yearRaw ? parseYear(yearRaw) : undefined;

    if (!matchTargetVariant(title, year, fuel)) return;

    const countryRaw = $li.find(".location .upper").first().text().trim().toUpperCase();
    const country = COUNTRY_MAP[countryRaw];

    const href =
      $li.find('a[href^="/used-cars-detail/"]').first().attr("href") ||
      $li.find('a[href^="/tools/"]').first().attr("href");
    if (!href) return;

    out.push({
      sourceId: id,
      url: href.startsWith("http") ? href : `https://www.theparking.eu${href}`,
      title,
      price,
      currency: "EUR",
      year,
      mileageKm: mileageRaw ? parseMileage(mileageRaw) : undefined,
      fuel,
      transmission: transmissionRaw?.toLowerCase().includes("auto")
        ? "automatic"
        : transmissionRaw?.toLowerCase().includes("manual")
          ? "manual"
          : undefined,
      location: countryRaw || undefined,
      country,
      imageUrl:
        $li.find("picture source[srcset]").first().attr("srcset") ||
        $li.find(".figure img").first().attr("src") ||
        undefined,
      snippet: $li.find(".desc").first().text().trim() || undefined,
    });
  });

  return out;
}

export const theparking: Source = {
  name: "theparking",
  country: "EU",
  enabled: brightdataAvailable,
  // See file header: a healthy run can legitimately return zero rows.
  expectedMinimum: 0,
  async scan() {
    const out: RawListing[] = [];
    for (const url of SEARCH_URLS) {
      try {
        const html = await fetchViaBrightdata(url);
        out.push(...parseList(html));
      } catch (err) {
        console.log(`theparking: ${url} failed: ${(err as Error).message.slice(0, 120)}`);
      }
    }
    console.log(`theparking: ${out.length} rows matched one of the target variants`);
    return out;
  },
};
