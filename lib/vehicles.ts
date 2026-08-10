/**
 * The whitelist. Anything that does not match one of these is discarded before
 * it ever reaches the database.
 *
 * Scope as of 2026-08-11: the full body-on-frame/overland list, plus pickups
 * and vans, plus Subaru's unibody wagons. Widened twice by the owner: first
 * narrowed to Toyota/Subaru only, then reopened to include pickups (Hilux,
 * D-Max, L200, Tacoma), a van (Delica), and two more Subarus (Impreza, Baja).
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
    model: "Hilux",
    desirability: 8,
    aliases: ["hilux"],
    note: "The pickup, not the Surf/4Runner. Widely regarded as nearly indestructible",
  },
  {
    make: "Toyota",
    model: "Tacoma",
    desirability: 7,
    aliases: ["tacoma"],
    note: "US-market pickup, genuinely great but rare and pricier in Europe; parts mean a wait",
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
  {
    make: "Subaru",
    model: "Impreza",
    desirability: 4,
    aliases: ["impreza"],
    note: "Unibody AWD, gravel and snow only, no real ground clearance for trails",
  },
  {
    make: "Subaru",
    model: "Baja",
    desirability: 4,
    aliases: ["baja"],
    note: "Rare unibody pickup on the Outback platform. Very few will ever surface in Europe",
  },
  {
    make: "Mitsubishi",
    model: "Pajero",
    desirability: 9,
    aliases: ["pajero", "shogun", "montero", "pajero ii", "pajero 2", "pajero iii", "pajero 3", "pajero iv", "pajero 4"],
    generations: [
      { name: "Mk2", from: 1991, to: 1999, bonus: 3, note: "4M40 diesel, cheap and tough" },
      { name: "Mk3", from: 1999, to: 2006, bonus: 2, note: "Monocoque with integrated frame, still very capable" },
      { name: "Mk4", from: 2006, to: 2021, bonus: 1 },
    ],
  },
  {
    make: "Mitsubishi",
    model: "Pajero Sport",
    desirability: 7,
    aliases: ["pajero sport", "challenger", "montero sport", "nativa"],
  },
  {
    make: "Mitsubishi",
    model: "L200",
    desirability: 6,
    aliases: ["l200", "l 200", "triton", "strada"],
    note: "Common, cheap to run, decent value pickup",
  },
  {
    make: "Mitsubishi",
    model: "Delica",
    desirability: 8,
    aliases: ["delica", "space gear", "l400", "l 400", "l300", "l 300"],
    generations: [
      { name: "L300", from: 1986, to: 1999, bonus: 1 },
      { name: "L400 (Space Gear)", from: 1994, to: 2007, bonus: 2, note: "4x4 versions are an overlanding favourite" },
      { name: "D5", from: 2007, to: 2019, bonus: 1 },
    ],
    note: "JDM import in most of Europe; check for a genuine 4x4 drivetrain, not the 2WD version",
  },
  {
    make: "Nissan",
    model: "Patrol",
    desirability: 10,
    aliases: ["patrol", "patrol gr", "safari", "y60", "y61", "gr y61", "gr y60"],
    generations: [
      { name: "Y60", from: 1987, to: 1997, bonus: 3, note: "Coil sprung solid axles" },
      { name: "Y61", from: 1997, to: 2013, bonus: 3, note: "ZD30 needs care, TD42 is bulletproof" },
    ],
  },
  {
    make: "Nissan",
    model: "Terrano II",
    desirability: 6,
    aliases: ["terrano", "terrano ii", "terrano 2"],
    note: "Shares a platform with the Ford Maverick",
  },
  {
    make: "Nissan",
    model: "Pathfinder",
    desirability: 6,
    aliases: ["pathfinder", "r50", "r51"],
    generations: [{ name: "R50", from: 1995, to: 2004, bonus: 1 }],
  },
  {
    make: "Land Rover",
    model: "Defender",
    desirability: 10,
    aliases: ["defender", "land rover 90", "land rover 110", "lr defender", "def 90", "def 110"],
    note: "Rarely clears the budget in good condition, but worth catching when it does",
  },
  {
    make: "Land Rover",
    model: "Discovery",
    desirability: 7,
    aliases: ["discovery", "disco 1", "disco 2", "discovery i", "discovery ii", "discovery 1", "discovery 2"],
    generations: [
      { name: "Series I", from: 1989, to: 1998, bonus: 2 },
      { name: "Series II", from: 1998, to: 2004, bonus: 1, note: "Watch the chassis rear crossmember" },
    ],
  },
  {
    make: "Land Rover",
    model: "Range Rover Classic",
    desirability: 7,
    aliases: ["range rover classic", "range rover klasik"],
  },
  {
    make: "Suzuki",
    model: "Jimny",
    desirability: 9,
    aliases: ["jimny", "sn413"],
    note: "Tiny, light, and astonishingly capable. Holds value hard",
  },
  {
    make: "Suzuki",
    model: "Samurai",
    desirability: 8,
    aliases: ["samurai", "sj410", "sj413", "santana"],
  },
  {
    make: "Suzuki",
    model: "Vitara",
    desirability: 6,
    aliases: ["vitara", "escudo", "sidekick"],
    note: "First generation only, later Grand Vitara is a separate entry",
  },
  {
    make: "Suzuki",
    model: "Grand Vitara",
    desirability: 5,
    aliases: ["grand vitara", "grandvitara", "grand-vitara"],
    generations: [{ name: "Mk1", from: 1998, to: 2005, bonus: 2, note: "Body on frame. The 2005+ car is not" }],
  },
  {
    make: "Isuzu",
    model: "Trooper",
    desirability: 7,
    aliases: ["trooper", "bighorn", "monterey", "opel monterey"],
    note: "Sold as Opel/Vauxhall Monterey and Honda Horizon",
  },
  {
    make: "Isuzu",
    model: "D-Max",
    desirability: 7,
    aliases: ["d-max", "d max", "dmax"],
    note: "Solid modern pickup, good reliability record",
  },
  {
    make: "Opel",
    model: "Frontera",
    desirability: 5,
    aliases: ["frontera"],
    note: "Isuzu underneath, cheap entry point, rust prone",
  },
  {
    make: "Jeep",
    model: "Wrangler",
    desirability: 9,
    aliases: ["wrangler", "yj", "tj", " jk ", "cj7", "cj-7"],
    generations: [
      { name: "YJ", from: 1986, to: 1995, bonus: 2 },
      { name: "TJ", from: 1996, to: 2006, bonus: 3, note: "Coil sprung solid axles" },
    ],
  },
  {
    make: "SsangYong",
    model: "Musso",
    desirability: 6,
    aliases: ["musso"],
    note: "Mercedes engines and drivetrain, very cheap to buy",
  },
  {
    make: "SsangYong",
    model: "Korando",
    desirability: 5,
    aliases: ["korando"],
  },
  {
    make: "SsangYong",
    model: "Rexton",
    desirability: 5,
    aliases: ["rexton"],
  },
  {
    make: "Hyundai",
    model: "Terracan",
    desirability: 6,
    aliases: ["terracan"],
  },
  {
    make: "Hyundai",
    model: "Galloper",
    desirability: 6,
    aliases: ["galloper"],
    note: "Licence-built Pajero Mk1",
  },
  {
    make: "Kia",
    model: "Sorento",
    desirability: 5,
    aliases: ["sorento"],
    generations: [{ name: "BL", from: 2002, to: 2009, bonus: 2, note: "Body on frame. Later Sorentos are not" }],
  },
  {
    make: "Ford",
    model: "Maverick",
    desirability: 5,
    aliases: ["maverick"],
    note: "Rebadged Nissan Terrano II",
  },
  {
    make: "Ford",
    model: "Explorer",
    desirability: 5,
    aliases: ["explorer"],
    generations: [{ name: "Pre-2010", from: 1990, to: 2010, bonus: 1 }],
  },
  {
    make: "Daihatsu",
    model: "Rocky / Fourtrak",
    desirability: 6,
    aliases: ["fourtrak", "rocky", "taft"],
  },
  {
    make: "Mercedes-Benz",
    model: "G-Class",
    desirability: 9,
    aliases: ["g-klasse", "g klasse", "gelandewagen", "gelaendewagen", "g-class", "w460", "w461", "w463", "puch g"],
  },
  {
    make: "UAZ",
    model: "Hunter / 469",
    desirability: 6,
    aliases: ["uaz", "uaz hunter", "uaz 469", "uaz patriot", "469"],
    note: "Crude, cheap, and genuinely capable. Parts are trivial in the Baltics",
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
