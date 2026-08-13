import * as cheerio from "cheerio";
import { brightdataAvailable, fetchViaBrightdata } from "../brightdata";
import { parseFuel, parseMileage, parsePower, parsePrice, parseTransmission } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * auto24.ee (Estonia), behind Cloudflare, fetched via Bright Data. The SUV
 * category (a=102) sorted by its default ascending price: the cheap pages ARE
 * the budget band, and the nightly deep sweep covers the rest. Auction rows
 * show the current bid rather than a price and are skipped.
 */
const PAGES_PER_DEPTH = 3;
const ROWS_PER_PAGE = 50;

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $(".result-row").each((_, el) => {
    const $r = $(el);
    if ($r.hasClass("has-auction")) return;

    const link = $r.find("a.main").first();
    const href = link.attr("href");
    const id = href?.match(/\/soidukid\/(\d+)/)?.[1];
    if (!href || !id) return;

    const title = link.text().replace(/\s+/g, " ").trim();
    const price = parsePrice($r.find(".finance .price").first().text());
    // Rows without a make/model title are parts and junk categories.
    if (!title || title.length < 6 || !price) return;

    const extra = $r.find(".extra").text().replace(/\s+/g, " ");
    const yearText = $r.find(".extra .year").first().text().trim();

    out.push({
      sourceId: id,
      url: new URL(href, "https://www.auto24.ee").href,
      title,
      price,
      currency: "EUR",
      year: /^(19|20)\d\d$/.test(yearText) ? parseInt(yearText, 10) : undefined,
      mileageKm: parseMileage($r.find(".mileage").first().text()),
      fuel: parseFuel(extra),
      transmission: parseTransmission(extra),
      powerKw: parsePower(`${title} ${extra}`),
      imageUrl: $r.find("img.thumb").first().attr("src"),
      snippet: extra.trim().slice(0, 200),
    });
  });

  return out;
}

export const auto24: Source = {
  name: "auto24",
  country: "EE",
  enabled: brightdataAvailable,
  expectedMinimum: 20,
  async scan(maxPages) {
    const all: RawListing[] = [];
    const pages = Math.min(maxPages * PAGES_PER_DEPTH, 12);
    for (let page = 1; page <= pages; page++) {
      const offset = (page - 1) * ROWS_PER_PAGE;
      let html: string;
      try {
        html = await fetchViaBrightdata(
          `https://www.auto24.ee/kasutatud/nimekiri.php?bn=2&a=102&otsi=1&ak=${offset}`,
        );
      } catch (err) {
        // One flaky page (usually a slow Bright Data attempt) shouldn't
        // discard pages already fetched successfully this run.
        console.log(`auto24: page ${page} failed, keeping ${all.length} rows so far: ${(err as Error).message.slice(0, 120)}`);
        break;
      }
      const rows = parseList(html);
      all.push(...rows);
      if (rows.length < 20) break;
    }
    return all;
  },
};
