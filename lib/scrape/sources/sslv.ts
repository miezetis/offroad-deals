import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseFuel, parseMileage, parsePower, parsePrice, parseTransmission, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * ss.com (Latvia). Plain HTML tables, one category page per model. The row
 * "title" is the seller's text, so the canonical model name comes from the
 * category and is prepended for the matcher.
 */
const CATEGORIES: [path: string, label: string][] = [
  ["toyota/land-cruiser", "Toyota Land Cruiser"],
  ["toyota/hilux", "Toyota Hilux"],
  ["toyota/rav4", "Toyota RAV4"],
  ["mitsubishi/pajero", "Mitsubishi Pajero"],
  ["mitsubishi/l200", "Mitsubishi L200"],
  ["mitsubishi/delica", "Mitsubishi Delica"],
  ["nissan/patrol", "Nissan Patrol"],
  ["nissan/terrano", "Nissan Terrano"],
  ["nissan/pathfinder", "Nissan Pathfinder"],
  ["land-rover/defender", "Land Rover Defender"],
  ["land-rover/discovery", "Land Rover Discovery"],
  ["land-rover/range-rover", "Land Rover Range Rover"],
  ["suzuki/jimny", "Suzuki Jimny"],
  ["suzuki/samurai", "Suzuki Samurai"],
  ["suzuki/vitara", "Suzuki Vitara"],
  ["suzuki/grand-vitara", "Suzuki Grand Vitara"],
  ["isuzu/trooper", "Isuzu Trooper"],
  ["isuzu/d-max", "Isuzu D-Max"],
  ["jeep/wrangler", "Jeep Wrangler"],
  ["opel/frontera", "Opel Frontera"],
  ["ssangyong/musso", "SsangYong Musso"],
  ["ssangyong/korando", "SsangYong Korando"],
  ["ssangyong/rexton", "SsangYong Rexton"],
  ["hyundai/terracan", "Hyundai Terracan"],
  ["hyundai/galloper", "Hyundai Galloper"],
  ["kia/sorento", "Kia Sorento"],
  ["ford/maverick", "Ford Maverick"],
  ["ford/explorer", "Ford Explorer"],
  ["subaru/forester", "Subaru Forester"],
  ["subaru/outback", "Subaru Outback"],
  ["subaru/impreza", "Subaru Impreza"],
  ["uaz/", "UAZ"],
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

    const sellerText = link.text().trim();

    out.push({
      sourceId: id,
      url: new URL(href, "https://www.ss.com").href,
      title: `${label} ${sellerText.slice(0, 120)}`,
      price,
      currency: "EUR",
      year: yearCell ? parseYear(yearCell) : undefined,
      mileageKm: mileageCell ? parseMileage(mileageCell) : undefined,
      // The list page has no spec columns for these, so they come out of the
      // seller's own text when mentioned.
      fuel: parseFuel(sellerText),
      transmission: parseTransmission(sellerText),
      powerKw: parsePower(sellerText),
      imageUrl: $tr.find("img.isfoto").attr("src"),
      snippet: sellerText,
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
