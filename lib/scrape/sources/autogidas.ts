import * as cheerio from "cheerio";
import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseFuel, parseMileage, parsePower, parsePrice, parseTransmission } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * autogidas.lt (Lithuania), behind Cloudflare, fetched via Bright Data.
 * Default ordering is bump-newest, which suits a periodic diff. Year comes
 * from the card description ("2002 m.").
 */
const PAGES_PER_DEPTH = 2;

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $(".article-item").each((_, el) => {
    const $a = $(el);
    const href = $a.find("a.item-link").first().attr("href");
    const id = href?.match(/-0?(\d{7,})\.html/)?.[1];
    if (!href || !id) return;

    const title = $a.find(".item-title").first().text().trim();
    const price = parsePrice($a.find(".item-price").first().text());
    if (!title || !price) return;

    const desc = $a.find(".description").text().replace(/\s+/g, " ").trim();
    const year = desc.match(/((?:19|20)\d\d)\s*m\./)?.[1];

    out.push({
      sourceId: id,
      url: new URL(href, "https://autogidas.lt").href,
      title,
      price,
      currency: "EUR",
      year: year ? parseInt(year, 10) : undefined,
      mileageKm: /km/.test(desc) ? parseMileage(desc.match(/\d[\d\s]*km/)?.[0] ?? "") : undefined,
      fuel: parseFuel(desc),
      transmission: parseTransmission(desc),
      powerKw: parsePower(desc),
      imageUrl: $a.find("img.js-image").first().attr("src"),
      snippet: desc.slice(0, 200),
    });
  });

  return out;
}

export const autogidas: Source = {
  name: "autogidas",
  country: "LT",
  enabled: brightdataAvailable,
  expectedMinimum: 12,
  async scan(maxPages) {
    const all: RawListing[] = [];
    const pages = Math.min(maxPages * PAGES_PER_DEPTH, 8);
    for (let page = 1; page <= pages; page++) {
      const html = await fetchViaBrightdata(
        `https://autogidas.lt/skelbimai/automobiliai/?page=${page}`,
      );
      const rows = parseList(html);
      all.push(...rows);
      if (rows.length < 12) break;
    }
    return all;
  },
};
