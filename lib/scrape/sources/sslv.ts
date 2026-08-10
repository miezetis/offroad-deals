import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseMileage, parsePrice, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * ss.com (Latvia). Plain HTML tables, one category page per model. The row
 * "title" is the seller's text, so the canonical model name comes from the
 * category and is prepended for the matcher.
 */
const CATEGORIES: [path: string, label: string][] = [
  ["toyota/land-cruiser", "Toyota Land Cruiser"],
  ["toyota/rav4", "Toyota RAV4"],
  ["subaru/forester", "Subaru Forester"],
  ["subaru/outback", "Subaru Outback"],
];

export function parseCategory(html: string, label: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $("tr[id^=tr_]").each((_, tr) => {
    const $tr = $(tr);
    const link = $tr.find("a.am").first();
    const href = link.attr("href");
    const id = $tr.attr("id")?.replace("tr_", "");
    if (!href || !id) return;

    const cells = $tr
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();

    const priceCell = cells.find((c) => c.includes("€"));
    const price = priceCell ? parsePrice(priceCell) : undefined;
    if (!price) return;

    const mileageCell = cells.find((c) => /tūkst|tukst|km/i.test(c));
    const yearCell = cells.find((c) => /^(19|20)\d\d$/.test(c));

    out.push({
      sourceId: id,
      url: new URL(href, "https://www.ss.com").href,
      title: `${label} ${link.text().trim().slice(0, 120)}`,
      price,
      currency: "EUR",
      year: yearCell ? parseYear(yearCell) : undefined,
      mileageKm: mileageCell ? parseMileage(mileageCell) : undefined,
      imageUrl: $tr.find("img.isfoto").attr("src"),
      snippet: link.text().trim(),
    });
  });

  return out;
}

export const sslv: Source = {
  name: "sslv",
  country: "LV",
  expectedMinimum: 30,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const [path, label] of CATEGORIES) {
      for (let page = 1; page <= maxPages; page++) {
        const suffix = page === 1 ? "sell/" : `sell/page${page}.html`;
        try {
          const html = await fetchPage(`https://www.ss.com/lv/transport/cars/${path}/${suffix}`);
          const rows = parseCategory(html, label);
          all.push(...rows);
          if (rows.length < 25) break; // last page of this category
        } catch {
          break; // category missing or unreachable; others continue
        }
      }
    }
    return all;
  },
};
