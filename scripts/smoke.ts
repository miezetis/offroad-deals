/**
 * One live URL per site, straight through the real parser and the vehicle
 * matcher. Fast feedback while selectors are being tuned; not part of the
 * hourly run.
 */
import { fetchPage } from "../lib/scrape/http";
import { matchVehicle } from "../lib/vehicles";
import type { RawListing } from "../lib/scrape/types";
import { parseCategory } from "../lib/scrape/sources/sslv";
import { extractEdges, toListing } from "../lib/scrape/sources/otomoto";
import { parseList as parseKA } from "../lib/scrape/sources/kleinanzeigen";
import { parseList as parseBazos } from "../lib/scrape/sources/bazos";
import { parseList as parseNetti } from "../lib/scrape/sources/nettiauto";
import { parseList as parseAB } from "../lib/scrape/sources/autobazar";

const CASES: [name: string, url: string, parse: (html: string) => RawListing[]][] = [
  [
    "sslv",
    "https://www.ss.com/lv/transport/cars/mitsubishi/pajero/sell/",
    (h) => parseCategory(h, "Mitsubishi Pajero"),
  ],
  [
    "otomoto",
    "https://www.otomoto.pl/osobowe/mitsubishi/pajero?search%5Border%5D=created_at_first%3Adesc",
    (h) => extractEdges(h).flatMap((n) => toListing(n) ?? []),
  ],
  [
    "kleinanzeigen",
    "https://www.kleinanzeigen.de/s-autos/preis:500:30000/sortierung:neueste/mitsubishi-pajero/k0c216",
    parseKA,
  ],
  ["bazos", "https://auto.bazos.sk/?hledat=pajero&cenaod=500&cenado=30000", parseBazos],
  ["nettiauto", "https://nettiauto.com/mitsubishi/pajero?sortCol=enrolldate&ord=DESC", parseNetti],
  [
    "autobazar",
    "https://www.autobazar.sk/mitsubishi-pajero/?p%5Border%5D=1",
    parseAB,
  ],
];

async function main() {
  for (const [name, url, parse] of CASES) {
    try {
      const rows = parse(await fetchPage(url));
      const matched = rows.filter((r) => matchVehicle(r.title, r.year));
      const complete = rows.filter((r) => r.year && r.mileageKm);
      console.log(
        `${name.padEnd(14)} rows=${String(rows.length).padEnd(4)} matched=${String(matched.length).padEnd(4)} with year+km=${complete.length}`,
      );
      const s = rows[0];
      if (s) {
        console.log(
          `  sample: [${s.sourceId}] ${s.title.slice(0, 60)} | ${s.price} ${s.currency} | y=${s.year} km=${s.mileageKm} | ${s.fuel ?? "-"}/${s.transmission ?? "-"}`,
        );
        console.log(`  url: ${s.url.slice(0, 90)}`);
      }
    } catch (err) {
      console.log(`${name.padEnd(14)} FAILED: ${(err as Error).message.slice(0, 120)}`);
    }
  }
}

main();
