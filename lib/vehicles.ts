/**
 * The whitelist. Anything that does not match one of these is discarded before
 * it ever reaches the database.
 *
 * Scope: Toyota and Subaru only, per the owner's call on 2026-08-10. Land
 * Cruiser and Surf/4Runner are the serious offroaders, RAV4 and the Subarus
 * cover light offroad and overlanding. The old wide list (Pajero, Patrol,
 * Jimny, ...) lives in git history if the scope ever widens again.
 *
 * `aliases` are matched against a normalised (lowercased, de-accented) title.
 * Longer aliases win.
 */

export type Generation = {
  name: string;
  from: number;
  to: number;
  /**
   * Whole-word tokens in the title that pin the generation directly. Needed
   * wherever year ranges overlap, as they do across the Land Cruiser line where
   * a 1998 car could be a J7, a Prado 90, or a 100-series.
   */
  hints?: string[];
  /** Rough desirability nudge applied during scoring. */
  bonus?: number;
  note?: string;
};

export type VehicleSpec = {
  make: string;
  model: string;
  aliases: string[];
  generations?: Generation[];
  /** Baseline desirability for the model as an offroader, 0 to 10. */
  desirability: number;
  note?: string;
};

export const VEHICLES: VehicleSpec[] = [
  {
    make: "Toyota",
    model: "Land Cruiser",
    desirability: 10,
    aliases: [
      "land cruiser", "landcruiser", "land-cruiser", "land cruizer", "maastur land cruiser",
      "lc80", "lc 80", "lc90", "lc 90", "lc100", "lc 100", "lc120", "lc 120",
      "hdj80", "hzj80", "fzj80", "kzj90", "kzj95", "vzj95", "hdj100", "uzj100",
      "kdj120", "grj120", "rzj", "prado",
    ],
    generations: [
      { name: "J4", from: 1960, to: 1984, bonus: 2, hints: ["40", "42", "45", "47", "bj40", "bj42", "bj45", "bj46", "fj40", "fj43", "fj45", "hj45", "hj47"], note: "The vintage classic, collector territory" },
      { name: "J6", from: 1980, to: 1990, bonus: 1, hints: ["60", "61", "62", "fj60", "fj62", "hj60", "hj61"] },
      { name: "J7", from: 1984, to: 2004, bonus: 2, hints: ["70", "71", "73", "76", "78", "79", "lj70", "lj71", "lj73", "lj77", "bj70", "bj73", "bj74", "hzj70", "hzj73", "hzj75", "hzj77", "kzj70", "kzj73", "kzj77", "pzj70", "kj70", "kj73", "kj77", "lj72", "bj71", "bj75", "hj75"], note: "Solid axles, the purist choice" },
      { name: "J8 (80-series)", from: 1990, to: 1997, bonus: 3, hints: ["80", "hdj80", "hzj80", "fzj80"], note: "Coil sprung solid axles, triple locked on the best trims" },
      { name: "J9 (Prado 90)", from: 1996, to: 2002, bonus: 2, hints: ["90", "95", "kzj90", "kzj95", "vzj95"], note: "The value sweet spot in this budget" },
      { name: "J10 (100-series)", from: 1998, to: 2007, bonus: 1, hints: ["100", "105", "hdj100", "uzj100"], note: "IFS on petrol V8s, live axle on 105" },
      { name: "J12 (Prado 120)", from: 2002, to: 2009, bonus: 1, hints: ["120", "kdj120", "grj120"] },
      { name: "J15 (Prado 150)", from: 2009, to: 2023, bonus: 1, hints: ["150", "kdj150", "grj150"] },
    ],
  },
  {
    make: "Toyota",
    model: "Hilux Surf / 4Runner",
    desirability: 9,
    aliases: ["hilux surf", "4runner", "4 runner", "surf ssr", "ln130", "kzn130", "vzn130", "kzn185", "rzn185"],
    generations: [
      { name: "N120/N130", from: 1989, to: 1995, bonus: 2 },
      { name: "N180", from: 1995, to: 2002, bonus: 2 },
      { name: "N210", from: 2002, to: 2009, bonus: 1 },
    ],
  },
  {
    make: "Toyota",
    model: "RAV4",
    desirability: 5,
    aliases: ["rav4", "rav 4", "rav-4"],
    generations: [
      { name: "XA10", from: 1994, to: 2000, bonus: 2, note: "The original, light and honest offroader" },
      { name: "XA20", from: 2000, to: 2006, bonus: 1 },
      { name: "XA30", from: 2006, to: 2013, bonus: 0 },
    ],
    note: "Light offroad only, but cheap, reliable, and everywhere",
  },
  {
    make: "Subaru",
    model: "Forester",
    desirability: 7,
    aliases: ["forester"],
    generations: [
      { name: "SF", from: 1997, to: 2002, bonus: 2, note: "The classic, EJ engines, great on gravel" },
      { name: "SG", from: 2002, to: 2008, bonus: 2, note: "The overland favourite, watch EJ25 head gaskets" },
      { name: "SH", from: 2008, to: 2013, bonus: 1 },
      { name: "SJ", from: 2013, to: 2018, bonus: 1 },
    ],
  },
  {
    make: "Subaru",
    model: "Outback",
    desirability: 6,
    aliases: ["outback", "legacy outback"],
    generations: [
      { name: "BG/BH", from: 1996, to: 2003, bonus: 1 },
      { name: "BP", from: 2003, to: 2009, bonus: 1, note: "3.0R six is smooth, EJ25 head gaskets again" },
      { name: "BR", from: 2009, to: 2014, bonus: 1 },
    ],
  },
];

/** Strip diacritics so Lithuanian, Latvian, Polish and German titles all match. */
export function normalise(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type VehicleMatch = {
  make: string;
  model: string;
  generation?: string;
  desirability: number;
  note?: string;
};

// Longest alias first, so specific names beat the generic ones they contain.
const INDEX = VEHICLES.flatMap((spec) =>
  spec.aliases.map((alias) => ({ alias: normalise(alias), spec })),
).sort((a, b) => b.alias.length - a.alias.length);

/**
 * An explicit chassis hint in the title always beats the year, since year
 * ranges overlap. Failing that, the narrowest range that contains the year is
 * the most specific claim we can make.
 */
function pickGeneration(spec: VehicleSpec, haystack: string, year?: number) {
  if (!spec.generations?.length) return undefined;

  const hinted = spec.generations
    .flatMap((g) => (g.hints ?? []).map((hint) => ({ g, hint })))
    .filter(({ hint }) => haystack.includes(` ${hint} `))
    .sort((a, b) => b.hint.length - a.hint.length)[0];
  if (hinted) return hinted.g;

  if (!year) return undefined;

  return spec.generations
    .filter((g) => year >= g.from && year <= g.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
}

/**
 * Maps a raw listing title to a canonical vehicle, or null when the listing is
 * not something we care about.
 */
export function matchVehicle(title: string, year?: number): VehicleMatch | null {
  const haystack = ` ${normalise(title)} `;

  for (const { alias, spec } of INDEX) {
    if (!haystack.includes(` ${alias} `) && !haystack.includes(` ${alias}`)) continue;

    const generation = pickGeneration(spec, haystack, year);

    return {
      make: spec.make,
      model: spec.model,
      generation: generation?.name,
      desirability: spec.desirability + (generation?.bonus ?? 0),
      note: generation?.note ?? spec.note,
    };
  }

  return null;
}
