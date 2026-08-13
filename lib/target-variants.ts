/**
 * The single vehicle configuration the owner is hunting for. Single source
 * of truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching this)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (the scoring rubric + engine notes in the AI prompt)
 *  - app/page.tsx (the fixed Variant filter)
 *
 * Owner's call 2026-08-13 (replacing the earlier seven-variant "legends"
 * list): narrow all the way down to exactly one chassis — GRJ76, the
 * long-wheelbase 4-door wagon body on the 70-series, with the 1GR-FE 4.0L V6
 * petrol engine. Explicitly NOT the far more common HZJ76 (4.2 diesel) or
 * VDJ76 (4.5 V8 turbo diesel) that actually dominate 76-wagon listings in
 * Europe, and NOT the 78 (troop carrier) or 79 (pickup) body styles that
 * share the same engine options as the 76 wagon.
 *
 * Reality check, worth keeping in mind when almost nothing shows up: the
 * GRJ76 petrol V6 was primarily an Australia/Middle-East/Africa-market
 * option. It was never officially sold in Europe, so a genuine European
 * listing is almost always going to be a rare private grey import — expect
 * this to surface far fewer matches than the previous broader lists, by
 * design.
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
    generation: "J76 (GRJ76)",
    label: "76 Series 4.0 V6 Petrol Wagon (GRJ76)",
    // The 70-series remains in production today, unlike every other
    // variant this tool has ever targeted — confirmed via a real bug:
    // brand-new 2026-model-year GRJ76 dealer stock on AutoScout24 was
    // silently rejected by an earlier 2024 cutoff copied from a discontinued
    // model's pattern. yearTo is deliberately generous rather than "current
    // year" to avoid the same mistake recurring as time passes.
    displacement: "4.0", fuel: "petrol", yearFrom: 2007, yearTo: 2030,
    desirability: 13,
    note: "1GR-FE 4.0L V6 petrol (~231-282 HP depending on market/year), the same " +
      "well-regarded engine used in the 4Runner, FJ Cruiser and Prado 120. Introduced " +
      "on the 70-series around 2007 as a petrol alternative in markets that wanted it. " +
      "Genuinely simple and reliable — chain-driven, minimal documented weak points. " +
      "Solid axles front and rear on the 70-series platform, long-wheelbase 4-door " +
      "wagon body specifically (not the 78 troop carrier or 79 pickup, which share " +
      "the same engine option but are a different vehicle for the owner's purposes). " +
      "This exact spec was primarily sold in Australia, the Middle East and Africa — " +
      "essentially never officially sold in Europe, so any European listing is almost " +
      "certainly a private grey import. Confirm import paperwork, RHD/LHD status, and " +
      "genuine V6 petrol identity (not a re-badged/converted diesel) before trusting an ad.",
    engineTier: { rank: 1, points: 25, label: "1GR-FE V6 petrol" },
    // No owner-supplied target band, and virtually no European market data exists
    // for direct comps given how rare this exact spec is here — this is a rough
    // estimate based on general 70-series wagon values, not a confident figure.
    // Flagged heavily as speculative; correct it if you have a better sense of it.
    priceTarget: { min: 15000, max: 35000 },
    hardExclusionNote: null,
    lockerNotes: "Front and rear locking differentials were commonly fitted on " +
      "GXL/GX-R heavy-duty export trims (the Middle-East/Africa spec this car most " +
      "likely came from) — this body/engine combination is one of the more likely " +
      "70-series configurations to be genuinely double-locked. Only credit what the " +
      "ad or dash-switch photos actually show; don't assume it by default.",
    airSuspensionRisk: null,
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
 * Only one target variant exists now, so matching is really "is this
 * specifically a GRJ76 76-series wagon" rather than picking among several
 * candidates. That makes precision harder, not easier: with nothing else in
 * the list to disambiguate against, a loose match would happily mislabel the
 * far more common HZJ76/VDJ76 diesel wagons, or the 78/79 body styles, as
 * our target. So every check here is a hard requirement, not a fallback.
 */

// The 76 wagon shares its engine options with the 78 (troop carrier) and 79
// (pickup) body styles — these must never match even if displacement and
// fuel are otherwise a perfect fit, since they're a different vehicle body.
const WRONG_BODY_TOKENS = [
  "78", "79", "grj78", "grj79", "hzj78", "hzj79", "vdj78", "vdj79",
  "troop", "troopy", "troopcarrier",
];
const WRONG_BODY_PHRASES = ["single cab", "double cab", "pick up", "pickup"];

// "76" (or "grj76"/"j76") is the one token that's genuinely unique to this
// exact body style within the whole Land Cruiser family — no other
// generation is ever labelled "76" — so it doubles as both the required
// positive body-style signal and the generation disambiguator, with no need
// for a broader Land-Cruiser-family exclusion list like the old multi-target
// version needed.
const BODY_76_TOKENS = ["76", "grj76", "j76"];

/**
 * Title must mention "Land Cruiser" and the "76" body-style token — GRJ76 is
 * one specific chassis among many 70-series body/engine combinations that
 * all share the same "Land Cruiser" name and a heavily overlapping year
 * range, so unlike the matcher this replaced, there is no safe "year alone"
 * fallback: with only one target in the whole list, a spec-less "Land
 * Cruiser 70-series" ad is far more likely to be one of the common diesel
 * variants than this rare petrol V6, so it stays unresolved (null) rather
 * than guessing. Fuel is the other hard requirement — if the ad states
 * diesel, or states neither diesel nor petrol/V6/4.0, it's rejected; only an
 * explicit "petrol" fuel field or an explicit V6/4.0/1GR/GRJ76 mention in
 * the title is trusted as confirmation this is the rare petrol engine and
 * not the ubiquitous diesel.
 */
export function matchTargetVariant(
  title: string,
  year: number | undefined,
  fuel: string | undefined,
): TargetMatch | null {
  if (!year) return null;
  const variant = TARGET_VARIANTS[0];
  if (year < variant.yearFrom || year > variant.yearTo) return null;

  const haystack = ` ${title.toLowerCase().replace(/[^a-z0-9.]+/g, " ")} `;
  if (!/land\s*cruiser/.test(haystack)) return null;

  if (WRONG_BODY_TOKENS.some((t) => haystack.includes(` ${t} `))) return null;
  if (WRONG_BODY_PHRASES.some((p) => haystack.includes(` ${p} `))) return null;
  if (!BODY_76_TOKENS.some((t) => haystack.includes(` ${t} `))) return null;

  if (fuel === "diesel") return null;
  const statesPetrolOrV6 =
    fuel === "petrol" ||
    /\b4\.0\b/.test(haystack) ||
    haystack.includes(" v6 ") ||
    haystack.includes(" 1gr ") ||
    haystack.includes(" grj76 ") ||
    haystack.includes(" grj ");
  if (!statesPetrolOrV6) return null;

  return {
    make: variant.make, model: variant.model,
    generation: variant.generation, fuel: variant.fuel,
    desirability: variant.desirability, note: variant.note,
  };
}
