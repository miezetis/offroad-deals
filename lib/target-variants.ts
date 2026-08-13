/**
 * The vehicle configurations the owner is shopping for. Single source of
 * truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching one of these)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (the scoring rubric + engine notes in the AI prompt)
 *  - app/page.tsx (the fixed Variant filter)
 *
 * Owner's call 2026-08-13 (replacing the earlier single-target GRJ76 hunt):
 * back to a budget-conscious European-market shortlist, owner-supplied with
 * specific engine call-outs and price bands —
 *  1. Prado 90 (J90/J95) — the "sweet spot" 1KZ-TE 3.0 turbo diesel, plus the
 *     3.4 V6 petrol (5VZ-FE) as a thirstier but equally reliable alternative.
 *  2. Hilux Mk4/Mk5/early Mk6 diesel — the "indestructible" utility truck,
 *     2.4 (2L-T) or 2.5 (2KD-FTV).
 *  3. Land Cruiser 100/105-series diesel — 1HD-FTE (likely over budget per
 *     the owner) or 1HZ (in-budget but slow and high-mileage).
 *
 * Generation labels ("J9 (Prado 90)" etc) match lib/vehicles.ts's existing
 * Land Cruiser naming on purpose, so historical rows ingested under the old
 * broad whitelist line up with the new one instead of needing a migration.
 */

export type EngineTier = { rank: 1 | 2 | 3 | 4; points: number; label: string };

export type TargetVariant = {
  make: string;
  model: string;
  generation: string;
  label: string;
  /** Null means "don't gate on displacement" — see the Hilux entry. */
  displacement: string | null;
  fuel: "diesel" | "petrol";
  yearFrom: number;
  yearTo: number;
  desirability: number;
  note: string;
  engineTier: EngineTier;
  /** Target asking-price band for a fair deal on this variant. */
  priceTarget: { min: number; max: number };
  hardExclusionNote: string | null;
  /** What factory diff-lock hardware actually exists on this platform, so the AI doesn't credit locker points nobody could have. */
  lockerNotes: string;
  airSuspensionRisk: string | null;
};

export const TARGET_VARIANTS: TargetVariant[] = [
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J9 (Prado 90) diesel",
    label: "Prado 90 3.0 Turbo Diesel (1KZ-TE)",
    displacement: "3.0", fuel: "diesel", yearFrom: 1996, yearTo: 2002,
    desirability: 11,
    note: "1KZ-TE 3.0L turbo diesel (~125-165 HP depending on market/year) — the " +
      "owner's stated 'sweet spot' for this generation: reliable, plenty of torque. " +
      "Independent front suspension with a solid rear axle and low-range transfer " +
      "case — noticeably more comfortable than a solid-axle Land Cruiser while " +
      "keeping serious trail ability. IMPORTANT inspection item: cracked cylinder " +
      "heads are a known failure mode on this engine if it was ever run overheated " +
      "— ask about cooling system history and check for coolant/oil mixing signs.",
    engineTier: { rank: 2, points: 20, label: "1KZ-TE turbo diesel" },
    priceTarget: { min: 6000, max: 10000 },
    hardExclusionNote: "1KZ-TE cylinder heads are a documented crack risk after an " +
      "overheating event. No documented cooling-system service history is a real " +
      "inspect item on a private sale, not automatically disqualifying, but check " +
      "carefully for head gasket or coolant-mixing symptoms.",
    lockerNotes: "Torsen center diff standard; locking rear differential optional on " +
      "VX/higher trims. Only credit a rear locker if the ad or photos show it.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J9 (Prado 90) petrol",
    label: "Prado 90 3.4 V6 Petrol (5VZ-FE)",
    displacement: "3.4", fuel: "petrol", yearFrom: 1996, yearTo: 2002,
    desirability: 11,
    note: "5VZ-FE 3.4L V6 petrol (~183 HP / 300 Nm) — excellent and reliable per the " +
      "owner's own assessment, genuinely few mechanical weak points, but noticeably " +
      "thirstier than the 1KZ-TE diesel alternative. Same chassis/suspension as the " +
      "diesel: independent front, solid rear axle, low-range transfer case.",
    engineTier: { rank: 1, points: 25, label: "5VZ-FE V6 petrol" },
    priceTarget: { min: 6000, max: 10000 },
    hardExclusionNote: null,
    lockerNotes: "Torsen center diff standard; locking rear differential optional on " +
      "VX/higher trims. Only credit a rear locker if the ad or photos show it.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Hilux",
    generation: "Mk4/Mk5/early Mk6 diesel",
    label: "Hilux Diesel (2.4 2L-T / 2.5 2KD-FTV)",
    // No displacement gate: the owner explicitly named two different engines
    // spanning two chassis generations (2.4 2L-T on Mk4/Mk5, 2.5 2KD-FTV on
    // the early Mk6 "Vigo") — same lesson as the earlier Hilux target this
    // tool carried: pinning one cc figure just causes false misses. Year +
    // fuel + the Hilux-only model filter identify this variant instead.
    displacement: null, fuel: "diesel", yearFrom: 1988, yearTo: 2009,
    desirability: 12,
    note: "2.4L 2L-T turbo diesel (Mk4/Mk5, ~90 HP) or 2.5L 2KD-FTV common-rail turbo " +
      "diesel (early Mk6 'Vigo', ~102 HP) — slow either way, but will run forever with " +
      "basic maintenance per the owner's own assessment. The industry-standard utility " +
      "truck; parts available everywhere in Europe. IMPORTANT inspection item: these " +
      "were very often used as farm or construction vehicles — check the suspension " +
      "and drivetrain carefully for signs of heavy commercial abuse, not just cosmetics.",
    engineTier: { rank: 1, points: 25, label: "2L-T/2KD-FTV diesel" },
    priceTarget: { min: 4000, max: 10000 },
    hardExclusionNote: null,
    lockerNotes: "No factory locking rear differential on most trims of this era. " +
      "Standard part-time 4WD with low range only; don't credit a locker unless the " +
      "ad explicitly states one was fitted.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J10/J105 (100-series diesel)",
    label: "100 Series 4.2 Diesel (1HD-FTE / 1HZ)",
    displacement: "4.2", fuel: "diesel", yearFrom: 1998, yearTo: 2007,
    desirability: 12,
    note: "1HD-FTE 4.2L turbo diesel (~204 HP, legendary — but per the owner's own " +
      "budget assessment, a genuine example is likely to price above the target band) " +
      "or 1HZ 4.2L naturally-aspirated diesel (~130 HP, indestructible but slow). At " +
      "this budget, expect high mileage — 300,000-400,000 km is normal for an " +
      "in-budget example, not a red flag on its own; some cosmetic wear should be " +
      "expected too. A massive comfort upgrade over the 70/90-series while keeping " +
      "true go-anywhere capability. Covers both chassis codes: the regular 100 " +
      "(independent front, solid rear) and the export 105 wagon (solid axles front " +
      "and rear) — check the ad/VIN for which one it actually is. Watch for electronic " +
      "gremlins in the cabin on higher-mileage examples.",
    engineTier: { rank: 1, points: 25, label: "1HD-FTE/1HZ inline-6 diesel" },
    priceTarget: { min: 4000, max: 10000 },
    hardExclusionNote: null,
    lockerNotes: "Locking rear differential common on 105 export trims. The regular " +
      "100 (independent front suspension) typically has an open front — only credit " +
      "lockers the ad or dash-switch photos actually show.",
    airSuspensionRisk: "VX/Cygnus trims commonly came with AHC (Active Height Control) " +
      "hydro-pneumatic suspension, a documented failure point when it ages — many owners " +
      "convert to standard coil springs. Treat active/unconverted AHC as a real " +
      "repair-cost risk unless the ad states it's been converted.",
  },
];

export type TargetMatch = {
  make: string;
  model: string;
  generation: string;
  fuel: "diesel" | "petrol";
  desirability: number;
  note: string;
};

/**
 * The 70-series diesel (HZJ7x/HDJ7x, 4.2L, sold throughout this whole era)
 * is NOT a target this time, but shares displacement, fuel, and an
 * overlapping year window with the 100/105-series diesel above — an
 * unstated-spec 70-series ad would otherwise mislabel as a 100-series
 * without this exclusion. Also excludes Hilux Surf, the JDM name for the
 * 4Runner (a different vehicle that would otherwise match the bare "hilux"
 * token below), and the newer Prado 150/full-size 200/300-series, whose
 * year ranges don't naturally overlap this list but are excluded defensively
 * in case of a bad year parse. Space-padded whole-word tokens, same
 * technique as lib/vehicles.ts's generation hints.
 */
const EXCLUDED_GENERATIONS = [
  "70", "71", "73", "75", "76", "77", "78", "79",
  "hzj70", "hzj71", "hzj73", "hzj75", "hzj76", "hzj77", "hzj78", "hzj79",
  "hdj70", "hdj71", "hdj73", "hdj76", "hdj78", "hdj79",
  "surf",
  "150", "j150", "kdj150", "grj150",
  "200", "j200", "300", "j300",
];

/**
 * Title must mention the Land Cruiser/Prado line or the Hilux — the two
 * vehicle families never share a title.
 *
 * Displacement and fuel each narrow the year-plausible candidates further
 * when the ad states them, and either one that flatly contradicts every
 * year-plausible variant rejects the match outright (better to miss a
 * listing than mislabel one). Prado 90 and the 100/105-series diesel
 * overlap 1998-2002, but different displacements (3.0/3.4 vs 4.2) resolve
 * it whenever the ad states one; when it doesn't, "Prado" in the title is
 * the disambiguator (Toyota's own name for the J9 line, never used for the
 * 100-series). An ad with neither and no displacement/fuel stated stays
 * unresolved (null) rather than guessing — same "miss over mislabel" rule
 * as always.
 *
 * Used for sources whose raw title text is the only reliable field (most of
 * them) — theparking.eu also calls this against its own structured title.
 */
export function matchTargetVariant(
  title: string,
  year: number | undefined,
  fuel: string | undefined,
): TargetMatch | null {
  if (!year) return null;
  const haystack = ` ${title.toLowerCase().replace(/[^a-z0-9.]+/g, " ")} `;

  const isLandCruiser = /land\s*cruiser|prado/.test(haystack);
  const isHilux = haystack.includes(" hilux ");
  if (!isLandCruiser && !isHilux) return null;
  if (EXCLUDED_GENERATIONS.some((t) => haystack.includes(` ${t} `))) return null;

  let candidates = TARGET_VARIANTS.filter((v) => year >= v.yearFrom && year <= v.yearTo);
  if (isHilux) candidates = candidates.filter((v) => v.model === "Hilux");
  else if (isLandCruiser) candidates = candidates.filter((v) => v.model === "Land Cruiser");
  if (!candidates.length) return null;

  // "Prado" is Toyota's own name for the J9 line specifically — never used
  // for the 100-series — so it resolves the 1998-2002 overlap even when the
  // ad states neither displacement nor fuel.
  if (haystack.includes(" prado ")) {
    const pradoOnly = candidates.filter((v) => v.generation.startsWith("J9 (Prado 90)"));
    if (pradoOnly.length) candidates = pradoOnly;
  }

  // "100"/"105" (plus common chassis codes) are Toyota's own model numbers
  // for the other side of that same overlap — sellers commonly cite them
  // even when they skip displacement/fuel entirely.
  const HUNDRED_SERIES_TOKENS = ["100", "105", "hdj100", "hdj105", "hzj105", "uzj100"];
  if (HUNDRED_SERIES_TOKENS.some((t) => haystack.includes(` ${t} `))) {
    const only = candidates.filter((v) => v.generation === "J10/J105 (100-series diesel)");
    if (only.length) candidates = only;
  }

  const displacement = haystack.match(/\b(\d\.\d)\b/)?.[1];
  if (displacement) {
    candidates = candidates.filter((v) => v.displacement === null || v.displacement === displacement);
    if (!candidates.length) return null;
  }

  if (fuel) {
    candidates = candidates.filter((v) => v.fuel === fuel);
    if (!candidates.length) return null;
  }

  if (candidates.length !== 1) return null;
  const variant = candidates[0];

  return {
    make: variant.make, model: variant.model,
    generation: variant.generation, fuel: variant.fuel,
    desirability: variant.desirability, note: variant.note,
  };
}
