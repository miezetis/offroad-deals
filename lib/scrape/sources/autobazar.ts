import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseFuel, parseMileage, parsePower, parsePrice, parseTransmission, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * autobazar.sk (Slovakia). Items under #search-results with data-id. SEO
 * category URLs per model.
 */
const MODEL_PATHS = [
  "toyota-land-cruiser",
  "toyota-rav4",
  "subaru-forester",
  "subaru-outback",
];

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $("#search-results .item[data-id], #search-results div[data-id]").each((_, item) => {
    const $i = $(item);
    const id = $i.attr("data-id");
    if (!id) return;

    const link = $i.find("a[href*='autobazar.sk/']").first();
    const href = link.attr("href");
    if (!href) return;

    const title = ($i.find("h2, h3, .title").first().text() || link.attr("title") || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) return;

    const price = parsePrice($i.find(".price").first().text());
    if (!price) return;

    const meta = $i.text().replace(/\s+/g, " ");

    out.push({
      sourceId: id,
      url: href,
      title,
      price,
      currency: "EUR",
      year: parseYear(title) ?? parseYear(meta),
      mileageKm: parseMileage(meta.match(/\d[\d\s.,]*\s*km/i)?.[0] ?? ""),
      fuel: parseFuel(meta),
      transmission: parseTransmission(meta),
      powerKw: parsePower(meta),
      imageUrl: $i.find("img").first().attr("src"),
    });
  });

  return out;
}

export const autobazar: Source = {
  name: "autobazar",
  country: "SK",
  expectedMinimum: 15,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const path of MODEL_PATHS) {
      for (let page = 1; page <= maxPages; page++) {
        try {
          const html = await fetchPage(
            `https://www.autobazar.sk/${path}/?p%5Border%5D=1&p%5Bpage%5D=${page}`,
          );
          const rows = parseList(html);
          all.push(...rows);
          if (rows.length < 15) break;
        } catch {
          break;
        }
      }
    }
    return all;
  },
};
