import * as cheerio from "cheerio";
import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseFuel, parseMileage, parsePrice, parseTransmission, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * autoplius.lt (Lithuania), behind Cloudflare, fetched via Bright Data. The
 * home market, so it scans the all-cars newest feed rather than per-model
 * pages: order_by=3 is newest-first, and the whitelist matcher does the
 * filtering. Three pages per run keeps paid requests modest.
 */
const PAGES_PER_DEPTH = 3;

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $("a.announcement-item[href]").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href")!;
    const id = href.match(/-(\d{6,})\.html/)?.[1];
    if (!id) return;

    const title = $a.find(".announcement-title").first().text().trim();
    const price = parsePrice($a.find(".announcement-pricing-info strong").first().text());
    if (!title || !price) return;

    // Two parameter blocks per card: a short one beside the title (date,
    // body) and the full one (fuel, gearbox, engine, km, city). Take all.
    const params = $a
      .find(".announcement-parameters span")
      .map((_, s) => $(s).text().trim())
      .get()
      .filter(Boolean);
    const joined = params.join(" | ");

    out.push({
      sourceId: id,
      url: href,
      title,
      price,
      currency: "EUR",
      year: parseYear(joined),
      mileageKm: /km/.test(joined) ? parseMileage(joined.match(/\d[\d\s]*km/)?.[0] ?? "") : undefined,
      fuel: parseFuel(joined),
      transmission: parseTransmission(joined),
      location: params.at(-1),
      imageUrl: $a.find(".announcement-photo img").first().attr("src"),
      snippet: joined.slice(0, 200),
    });
  });

  return out;
}

export const autoplius: Source = {
  name: "autoplius",
  country: "LT",
  enabled: brightdataAvailable,
  expectedMinimum: 15,
  async scan(maxPages) {
    const all: RawListing[] = [];
    const pages = Math.min(maxPages * PAGES_PER_DEPTH, 12);
    for (let page = 1; page <= pages; page++) {
      const html = await fetchViaBrightdata(
        `https://autoplius.lt/skelbimai/naudoti-automobiliai?order_by=3&page_nr=${page}`,
      );
      const rows = parseList(html);
      all.push(...rows);
      if (rows.length < 15) break;
    }
    return all;
  },
};
