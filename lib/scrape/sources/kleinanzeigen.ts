import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseMileage, parsePrice, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * kleinanzeigen.de (Germany). Card markup under article.aditem. The site mixes
 * in "Suche ..." want-to-buy ads, which must be dropped, and "VB" (negotiable)
 * price suffixes, which parsePrice ignores.
 */
const KEYWORDS = [
  "toyota-land-cruiser",
  "toyota-rav4",
  "toyota-4runner",
  "subaru-forester",
  "subaru-outback",
];

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $("article.aditem").each((_, article) => {
    const $a = $(article);
    const id = $a.attr("data-adid");
    const href = $a.attr("data-href");
    const title = $a.find("h2 a").first().text().trim();
    if (!id || !href || !title) return;

    // Want-to-buy ads, not cars for sale.
    if (/^\W*such/i.test(title) || /\bankauf\b/i.test(title)) return;

    const priceText = $a.find("[class*=price]").first().text();
    const price = parsePrice(priceText);
    if (!price) return;

    const tags = $a
      .find(".simpletag")
      .map((_, el) => $(el).text().trim())
      .get()
      .join(" | ");

    out.push({
      sourceId: id,
      url: new URL(href, "https://www.kleinanzeigen.de").href,
      title,
      price,
      currency: "EUR",
      year: parseYear(tags) ?? parseYear(title),
      mileageKm: /km/i.test(tags) ? parseMileage(tags.match(/[\d.,\s]+km/i)?.[0] ?? "") : undefined,
      location: $a.find(".aditem-main--top--left").text().trim().replace(/\s+/g, " "),
      imageUrl: $a.find("img").first().attr("src"),
      snippet: $a.find(".aditem-main--middle--description").text().trim().slice(0, 200),
    });
  });

  return out;
}

export const kleinanzeigen: Source = {
  name: "kleinanzeigen",
  country: "DE",
  expectedMinimum: 40,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const keyword of KEYWORDS) {
      for (let page = 1; page <= maxPages; page++) {
        // Path segments: price band 500-30000, newest first, page number.
        const seite = page === 1 ? "" : `seite:${page}/`;
        try {
          const html = await fetchPage(
            `https://www.kleinanzeigen.de/s-autos/preis:500:30000/sortierung:neueste/${seite}${keyword}/k0c216`,
          );
          const rows = parseList(html);
          all.push(...rows);
          if (rows.length < 20) break;
        } catch {
          break;
        }
      }
    }
    return all;
  },
};
