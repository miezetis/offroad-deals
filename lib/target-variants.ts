/**
 * The exact four vehicle configurations the owner is shopping for. Single
 * source of truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching one of these)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (the scoring rubric + engine notes in the AI prompt)
 *  - app/page.tsx (the fixed Variant filter)
 *
 * Generation labels ("J12 (Prado 120)" etc) match lib/vehicles.ts's existing
 * Land Cruiser naming on purpose, so historical rows ingested under the old
 * broad whitelist line up with the new one instead of needing a migration.
 */

export type EngineTier = { rank: 1 | 2 | 3 | 4; points: number; label: string };

export type TargetVariant = {
  make: string;
  model: string;
  generation: string;
  label: string;
  displacement: string;
  fuel: "diesel" | "petrol";
  yearFrom: number;
  yearTo: number;
  desirability: number;
  note: string;
  /**
   * Owner's scoring blueprint 2026-08-11, section 3B. The blueprint's own
   * tier table only covers 4Runner/Hilux-era engines; it doesn't mention the
   * 1FZ-FE at all. Ranked it Tier 1 by the same logic the blueprint applies
   * to the 1KD-FTV/1GR-FE (a documented, exceptionally low-failure-rate
   * engine), since that's the closest fit — flagged as an assumption, not
   * something the blueprint stated outright.
   */
  engineTier: EngineTier;
  /** Section 3E: target asking-price band for a fair deal on this variant. */
  priceTarget: { min: number; max: number };
  /**
   * Section 1 hard exclusions specific to this engine, beyond the shared
   * rust/frame check every variant gets in evaluate.ts. Framed as an
   * inspection item, not an automatic reject — almost no private-seller ad
   * documents injector diagnostics, so auto-rejecting on silence would
   * discard nearly every real listing.
   */
  hardExclusionNote: string | null;
  /** Section 3A: what factory diff-lock hardware actually exists on this platform, so the AI doesn't credit locker points nobody could have. */
  lockerNotes: string;
  /** Section 1 & 3C: failure-prone active suspension this platform can carry, if any. */
  airSuspensionRisk: string | null;
};

export const TARGET_VARIANTS: TargetVariant[] = [
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J12 (Prado 120)",
    label: "Prado 120 3.0 D-4D (2006-09)",
    displacement: "3.0", fuel: "diesel", yearFrom: 2006, yearTo: 2009,
    desirability: 11,
    note: "1KD-FTV 3.0L D-4D turbo-diesel (173 HP / 410 Nm). Known weak points: " +
      "injector failures (cheap fuel is a common cause), timing chain guides and " +
      "tensioner wear past 200k km, EGR/DPF clogging on cars used mostly for short trips.",
    engineTier: { rank: 1, points: 25, label: "1KD-FTV D-4D diesel" },
    priceTarget: { min: 8000, max: 11000 },
    hardExclusionNote: "1KD-FTV diesel injectors are a known failure point on this exact " +
      "generation. No documented injector replacement or diagnostic correction values is " +
      "normal for a private sale, not disqualifying on its own — but treat it as an inspect " +
      "item, not a positive.",
    lockerNotes: "Torsen center diff standard; optional locking rear differential on " +
      "VX/higher trims. Most European-market Prado 120s are center-lock only or A-TRC — " +
      "only credit a rear locker if the ad or photos show it (locker switch on the dash).",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J10 (100-series)",
    label: "100 Series 4.7 V8 (1998-2007)",
    displacement: "4.7", fuel: "petrol", yearFrom: 1998, yearTo: 2007,
    desirability: 11,
    note: "2UZ-FE 4.7L V8 petrol (~232 HP / 434 Nm). Reliable engine, but check for " +
      "high fuel consumption as a running cost, front differential/IFS wear on early " +
      "cars, and confirm timing belt/water pump service history (not chain-driven).",
    engineTier: { rank: 2, points: 20, label: "2UZ-FE V8 petrol" },
    priceTarget: { min: 10000, max: 14000 },
    hardExclusionNote: null,
    lockerNotes: "Torsen center diff standard; locking rear differential optional on " +
      "VX/Cygnus trims, A-TRC traction control on others. This generation was never " +
      "'triple locked' like the 80-series — don't credit that.",
    airSuspensionRisk: "VX/Cygnus trims commonly came with AHC (Active Height Control) " +
      "hydro-pneumatic suspension, a documented failure point when it ages. If the ad or " +
      "photos show a VX/Cygnus badge or air suspension, treat active/unconverted AHC as a " +
      "real repair-cost risk unless converted to coil springs.",
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J8 (80-series)",
    label: "80 Series 4.5 (1992-97)",
    displacement: "4.5", fuel: "petrol", yearFrom: 1992, yearTo: 1997,
    desirability: 13,
    note: "1FZ-FE 4.5L straight-6 petrol (~212 HP / 373 Nm). Watch for head gasket " +
      "failures (known weak point on this engine), fuel consumption, and rust on the " +
      "chassis/rear crossmember given the age of the vehicle.",
    engineTier: { rank: 1, points: 25, label: "1FZ-FE straight-6 petrol" },
    priceTarget: { min: 12000, max: 16000 },
    hardExclusionNote: null,
    lockerNotes: "The best-equipped 80-series trims are factory 'triple locked' (front, " +
      "center and rear electric diff locks) — full points. Many exported/base trims only " +
      "have a center diff lock, or are fully open. Only credit what the ad or dash-switch " +
      "photos actually show; don't assume triple-locked by default.",
    airSuspensionRisk: null,
  },
  {
    make: "Lexus", model: "GX470",
    generation: "J120 (GX470)",
    label: "4.7 V8 (2003-09)",
    displacement: "4.7", fuel: "petrol", yearFrom: 2003, yearTo: 2009,
    desirability: 11,
    note: "2UZ-FE 4.7L V8 petrol (~235 HP / 434 Nm) — same engine as the Toyota " +
      "100-series V8, built on the Prado 120 platform. Watch for: high fuel " +
      "consumption, front differential/IFS wear, KDSS hydraulic suspension faults " +
      "on equipped trims (expensive to repair if present), and confirm timing " +
      "belt/water pump service history.",
    engineTier: { rank: 2, points: 20, label: "2UZ-FE V8 petrol (same as 100-series)" },
    // Not in the owner's blueprint (Lexus-badged, added later) — estimated from the
    // real EU asking-price spread seen when this source was validated (9k-30k EUR,
    // most clustered 12-20k), skewed slightly below the Toyota-badged 100-series
    // target since the GX470 typically trades a little cheaper in Europe despite
    // being mechanically the same car.
    priceTarget: { min: 9000, max: 14000 },
    hardExclusionNote: null,
    lockerNotes: "Torsen center diff standard; a factory locking rear differential was " +
      "rare/market-dependent on this model. Most EU-market GX470s are open rear diff " +
      "with A-TRC only — don't credit a locker unless the ad states one.",
    airSuspensionRisk: "KDSS (Kinetic Dynamic Suspension System) is a hydraulic anti-roll " +
      "system on equipped trims, not the same as AHC air suspension but similarly a known " +
      "expensive failure point when it fails. Flag it as a repair-cost risk if mentioned or " +
      "visible, same treatment as the 100-series' AHC.",
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
 * Other Land Cruiser lines that share the "Land Cruiser" name but are NOT
 * one of our targets, and could otherwise be miscategorized: the full-size
 * 200/300-series (a completely different, much more expensive vehicle) and
 * the newer Prado 150. Space-padded whole-word tokens, same technique as
 * lib/vehicles.ts's generation hints, so "200" doesn't match "200 kW" etc
 * (the padding requires the token to stand alone, not be a substring).
 */
const EXCLUDED_GENERATIONS = [
  "200", "j200", "urj200", "vdj200", "uzj200",
  "300", "j300",
  "150", "j150", "kdj150", "grj150",
];

/**
 * Title must mention the Land Cruiser/Prado line or the Lexus GX470 — the
 * two vehicle families never share a title, so that alone keeps the 2003-07
 * year overlap between the Lexus GX470 and the Toyota 100-series V8 (same
 * 2UZ-FE engine, different chassis/badge) from ever being ambiguous.
 *
 * Displacement and fuel each narrow the year-plausible candidates further
 * when the ad states them, and either one that flatly contradicts every
 * year-plausible variant rejects the match outright (better to miss a
 * listing than mislabel one). When neither is stated — common on
 * modification/build-focused listings that skip the spec sheet — year alone
 * still resolves it whenever only one variant's year window fits; the only
 * genuinely ambiguous years are 2006-2007, where Prado 120 and the
 * 100-series windows overlap (both Toyota-badged, so the family gate above
 * does not help there — "Prado" in the title is the disambiguator).
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
  const isLexusGx = /gx\s?470/.test(haystack) || (haystack.includes(" lexus ") && haystack.includes(" 470 "));
  if (!isLandCruiser && !isLexusGx) return null;
  if (EXCLUDED_GENERATIONS.some((t) => haystack.includes(` ${t} `))) return null;

  let candidates = TARGET_VARIANTS.filter((v) => year >= v.yearFrom && year <= v.yearTo);
  if (isLexusGx && !isLandCruiser) candidates = candidates.filter((v) => v.make === "Lexus");
  if (isLandCruiser && !isLexusGx) candidates = candidates.filter((v) => v.make === "Toyota");
  if (!candidates.length) return null;

  // "Prado" is Toyota's own name for the J12 line specifically — never used
  // for the 100 or 80 series — so it resolves the one remaining ambiguity
  // (the 2006-2007 overlap) even when the ad states neither displacement
  // nor fuel.
  if (haystack.includes(" prado ")) {
    const pradoOnly = candidates.filter((v) => v.generation === "J12 (Prado 120)");
    if (pradoOnly.length) candidates = pradoOnly;
  }

  const displacement = haystack.match(/\b(\d\.\d)\b/)?.[1];
  if (displacement) {
    candidates = candidates.filter((v) => v.displacement === displacement);
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
