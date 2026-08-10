/** Parsers vs the CI-fetched artifacts. Not part of the hourly run. */
import { readFileSync } from "node:fs";
import { parseList as autoplius } from "../lib/scrape/sources/autoplius";
import { parseList as auto24 } from "../lib/scrape/sources/auto24";
import { parseList as autogidas } from "../lib/scrape/sources/autogidas";
import { matchVehicle } from "../lib/vehicles";

const S = process.argv[2];
const cases = [
  ["autoplius", autoplius],
  ["auto24", auto24],
  ["autogidas", autogidas],
] as const;

for (const [name, parse] of cases) {
  const rows = parse(readFileSync(`${S}/${name}.html`, "utf8"));
  const matched = rows.filter((r) => matchVehicle(r.title, r.year));
  const complete = rows.filter((r) => r.year && r.mileageKm && r.fuel);
  console.log(`${name.padEnd(11)} rows=${String(rows.length).padEnd(4)} toyota/subaru=${String(matched.length).padEnd(3)} full-fields=${complete.length}`);
  const s = rows[0];
  if (s) console.log(`  sample: [${s.sourceId}] ${s.title.slice(0, 40)} | ${s.price}€ y=${s.year} km=${s.mileageKm} ${s.fuel ?? "-"}/${s.transmission ?? "-"} | ${s.url.slice(0, 60)}`);
}
