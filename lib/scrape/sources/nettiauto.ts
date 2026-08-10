import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseFuel, parseMileage, parsePrice, parseTransmission, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * nettiauto.com (Finland). Server-rendered product cards. The bare host must
 * be used: the www. subdomain does not resolve from every network.
 */
const MODEL_PATHS = [
  "toyota/land+cruiser",
  "toyota/land+cruiser+prado",
  "toyota/4runner",
  "toyota/rav4",
  "subaru/forester",
  "subaru/outback",
];

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $(".product-card").each((_, card) => {
    const $c = $(card);
    // Skip the hidden-ad template block.
    if ($c.hasClass("hidden-ad-card")) return;

    // Ad links are relative: /mitsubishi/pajero/15815823. Cards also carry
    // promo and dealer anchors, so pin the shape exactly.
    let href: string | undefined;
    let id: string | undefined;
    $c.find("a[href]").each((_, a) => {
      if (id) return;
      const h = $(a).attr("href") ?? "";
      const m = h.match(/^\/[^/]+\/[^/]+\/(\d{6,})$/);
      if (m) {
        href = h;
        id = m[1];
      }
    });
    if (!href || !id) return;
    const link = $c.find(`a[href='${href}']`).first();

    const title = ($c.find(".product-card__name, .product-card__title").first().text() ||
      link.attr("title") ||
      link.text())
      .replace(/\s+/g, " ")
      .trim();
    if (!title) return;

    const price = parsePrice($c.find("[class*=price-main], [class*=price]").first().text());
    if (!price) return;

    const meta = $c.text().replace(/\s+/g, " ");

    out.push({
      sourceId: id,
      url: new URL(href, "https://www.nettiauto.com").href,
      title,
      price,
      currency: "EUR",
      year: parseYear(title) ?? parseYear(meta),
      mileageKm: parseMileage(meta.match(/[\d\s.,]+\s*(?:tkm|km)/i)?.[0] ?? ""),
      fuel: parseFuel(meta),
      transmission: parseTransmission(meta),
      imageUrl: $c.find("img").first().attr("src"),
    });
  });

  return out;
}

export const nettiauto: Source = {
  name: "nettiauto",
  country: "FI",
  expectedMinimum: 40,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const path of MODEL_PATHS) {
      for (let page = 1; page <= maxPages; page++) {
        try {
          const html = await fetchPage(
            `https://nettiauto.com/${path}?sortCol=enrolldate&ord=DESC&page=${page}`,
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
