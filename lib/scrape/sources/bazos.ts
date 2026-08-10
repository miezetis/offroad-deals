import * as cheerio from "cheerio";
import { fetchPage } from "../http";
import { parseFuel, parseMileage, parsePrice, parseTransmission, parseYear } from "../parse";
import type { RawListing, Source } from "../types";

/**
 * auto.bazos.sk (Slovakia). Keyword search over div.inzeraty blocks. The
 * description carries labelled fields (Rok, Palivo, Prevodovka, Najazdene).
 * Search is fulltext, so off-model hits appear; the whitelist matcher drops
 * them downstream.
 */
const KEYWORDS = [
  "land cruiser",
  "rav4",
  "4runner",
  "hilux surf",
  "forester",
  "outback",
];

export function parseList(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];

  $("div.inzeraty").each((_, div) => {
    const $d = $(div);
    const link = $d.find("h2.nadpis a").first();
    const href = link.attr("href");
    const title = link.text().trim();
    if (!href || !title) return;

    const id = href.match(/\/inzerat\/(\d+)\//)?.[1];
    if (!id) return;

    const price = parsePrice($d.find(".inzeratycena").text());
    if (!price) return;

    const desc = $d.find(".popis").text().replace(/\s+/g, " ").trim();
    const yearField = desc.match(/rok:?\s*(?:\d{1,2}\s*\/\s*)?((?:19|20)\d\d)/i)?.[1];
    const mileageField = desc.match(/najazden\w*\s*:?\s*([\d\s.,]+)/i)?.[1];

    out.push({
      sourceId: id,
      url: new URL(href, "https://auto.bazos.sk").href,
      title,
      price,
      currency: "EUR",
      year: yearField ? parseInt(yearField, 10) : (parseYear(title) ?? parseYear(desc)),
      mileageKm: mileageField ? parseMileage(mileageField) : undefined,
      fuel: parseFuel(desc),
      transmission: parseTransmission(desc),
      location: $d.find(".inzeratylok").text().trim().replace(/\s+/g, ", "),
      imageUrl: $d.find("img.obrazek").attr("src"),
      snippet: desc.slice(0, 200),
    });
  });

  return out;
}

export const bazos: Source = {
  name: "bazos",
  country: "SK",
  expectedMinimum: 20,
  async scan(maxPages) {
    const all: RawListing[] = [];
    for (const keyword of KEYWORDS) {
      for (let page = 1; page <= maxPages; page++) {
        // bazos paginates by row offset, 20 per page.
        const offset = (page - 1) * 20;
        const path = offset ? `/${offset}/` : "/";
        try {
          const html = await fetchPage(
            `https://auto.bazos.sk${path}?hledat=${encodeURIComponent(keyword)}&cenaod=500&cenado=30000`,
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
