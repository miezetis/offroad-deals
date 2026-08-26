/**
 * The vehicle configurations the owner is shopping for. Single source of
 * truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching one of these)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (the scoring rubric + engine notes in the AI prompt)
 *  - app/page.tsx (the fixed Variant filter)
 *
 * Owner's call 2026-08-13 (replacing the earlier single-target GRJ76 hunt,
 * then dropping the Hilux from that list): a budget-conscious European-
 * market shortlist —
 *  1. Prado 90 (J90/J95) — the "sweet spot" 1KZ-TE 3.0 turbo diesel, plus the
 *     3.4 V6 petrol (5VZ-FE) as a thirstier but equally reliable alternative.
 *  2. Land Cruiser 100/105-series diesel — 1HD-FTE (likely over budget per
 *     the owner) or 1HZ (in-budget but slow and high-mileage).
 *
 * Owner's call 2026-08-24: added the 70-series (J7) back — likely purchase
 * choice, picked for the round-headlight front-end look that most of its
 * production run (1984-2023ish) carries. Still in production today, so it
 * spans three real engine eras rather than one: the classic 4.2 inline-6
 * diesel, and the modern 4.5 V8 diesel / 4.0 V6 petrol pairing introduced
 * 2007+ (the same GRJ76 V6 this tool briefly hunted exclusively on
 * 2026-08-13). No round-headlight guarantee on the very latest facelift —
 * flagged in the note, confirm from listing photos.
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
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J7 (70-series) classic diesel",
    label: "70 Series 4.2 Diesel (1HZ / 1HD-T / 1HD-FT)",
    displacement: "4.2", fuel: "diesel", yearFrom: 1990, yearTo: 2007,
    desirability: 13,
    note: "1HZ naturally-aspirated (~130 HP) or 1HD-T/1HD-FT turbo (~165 HP) 4.2L " +
      "inline-6 diesel. The purist's Land Cruiser: solid axles front and rear, " +
      "leaf-sprung, minimal electronics, round headlights on essentially every " +
      "example of this era — about as close to unbreakable as a diesel Toyota gets. " +
      "Genuinely few weak points; 1HD-FT turbo/injector wear at very high mileage is " +
      "about the only real inspect item.",
    engineTier: { rank: 1, points: 25, label: "1HZ/1HD-T inline-6 diesel" },
    priceTarget: { min: 6000, max: 12000 },
    hardExclusionNote: null,
    lockerNotes: "Factory front and rear locking differentials were a common option on " +
      "export/Africa-Middle-East-spec Troop Carrier and GX/GXL trims — this generation " +
      "is one of the more likely to be genuinely double-locked. Many base/JDM trims are " +
      "open though; only credit what the ad or dash-switch photos actually show.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J7 (70-series) modern diesel",
    label: "70 Series 4.5 V8 Diesel (1VD-FTV)",
    displacement: "4.5", fuel: "diesel", yearFrom: 2007, yearTo: 2030,
    desirability: 12,
    note: "1VD-FTV 4.5L V8 twin-turbo diesel (~150-200 HP depending on market/year), " +
      "the modern engine still fitted to new-production 70-series trucks today. " +
      "IMPORTANT inspection item: this engine has a well-documented EGR cooler " +
      "cracking issue (mainly pre-2012 production) that lets coolant leak into the " +
      "engine — the single most important thing to check on this variant. Round " +
      "headlights on most markets' 70-series through this era, but Toyota's most " +
      "recent facelift may differ — confirm from the actual listing photos rather " +
      "than assuming.",
    engineTier: { rank: 2, points: 20, label: "1VD-FTV V8 twin-turbo diesel" },
    priceTarget: { min: 15000, max: 35000 },
    hardExclusionNote: "1VD-FTV's documented EGR cooler cracking issue (mainly " +
      "pre-2012 production) lets coolant leak into the engine — a serious, expensive " +
      "failure mode. No documented EGR cooler inspection/replacement history is a " +
      "real risk on an unconfirmed example, not automatically disqualifying, but " +
      "weight it heavily.",
    lockerNotes: "Front and rear locking differentials standard on Middle-East " +
      "'GXR'/'VXR' heavy-duty spec (a common source for European grey imports) but " +
      "not on every trim. Only credit lockers the ad or dash-switch photos actually show.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J7 (70-series) modern petrol",
    label: "70 Series 4.0 V6 Petrol (1GR-FE / GRJ76)",
    displacement: "4.0", fuel: "petrol", yearFrom: 2007, yearTo: 2030,
    desirability: 13,
    note: "1GR-FE 4.0L V6 petrol (~231-282 HP depending on market/year), the same " +
      "well-regarded engine used in the 4Runner, FJ Cruiser and Prado 120 — chain-" +
      "driven, minimal documented weak points, genuinely simple and reliable. This " +
      "exact spec (GRJ chassis code) was primarily an Australia/Middle-East/Africa-" +
      "market option, essentially never officially sold in Europe, so a European " +
      "listing is almost certainly a private grey import — confirm import paperwork " +
      "and genuine V6 petrol identity before trusting an ad. Round headlights on most " +
      "markets' 70-series through this era; confirm from listing photos.",
    engineTier: { rank: 1, points: 25, label: "1GR-FE V6 petrol" },
    priceTarget: { min: 15000, max: 35000 },
    hardExclusionNote: null,
    lockerNotes: "Front and rear locking differentials commonly fitted on GXL/GX-R " +
      "heavy-duty export trims — one of the more likely 70-series configurations to " +
      "be genuinely double-locked. Only credit what the ad or dash-switch photos " +
      "actually show.",
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
 * The 70-series is a target again as of 2026-08-24, so its own tokens are no
 * longer excluded here — see HUNDRED_SERIES_TOKENS/J7_TOKENS below for how
 * its classic-diesel overlap with the 100-series is resolved instead.
 *
 * The 80-series is NOT a target and never has been in this list, but its
 * whole production run (1990-97) sits entirely inside the 70-series classic
 * diesel's year window (1990-2007) with no other target variant's window
 * overlapping 1990-97 either — so an 80-series ad with no displacement/fuel
 * stated was the sole remaining candidate by year alone and silently
 * mislabeled as a 70-series. Confirmed live in production 2026-08-26: 4 real
 * HDJ80 listings (one literally titled "...J8 H Zulassung", i.e. self-
 * identifying as J8) got tagged "J7 (70-series) classic diesel". Excluded by
 * chassis code/body number now, same fix pattern as the LC200 chassis codes
 * below.
 *
 * "surf" stays excluded defensively (the JDM name for the 4Runner) even with
 * the Hilux dropped as a target, in case it's ever added back. Also
 * excludes the newer Prado 150/full-size 200/300-series (VDJ200/UZJ200 are
 * that full-size line's diesel/petrol, not this list's 70-series V8/V6 —
 * excluded by chassis code so a stray mention can't be misread), whose year
 * ranges don't naturally overlap this list but are excluded defensively in
 * case of a bad year parse. Space-padded whole-word tokens, same technique
 * as lib/vehicles.ts's generation hints.
 */
const EXCLUDED_GENERATIONS = [
  "80", "81", "j8", "hdj80", "hdj81", "hzj80", "hzj81", "fzj80", "fzj80h",
  "surf",
  "150", "j150", "kdj150", "grj150",
  "200", "j200", "vdj200", "uzj200", "urj200",
  "300", "j300",
];

/**
 * Title must mention the Land Cruiser/Prado line — Hilux dropped as a
 * target 2026-08-13.
 *
 * Displacement and fuel each narrow the year-plausible candidates further
 * when the ad states them, and either one that flatly contradicts every
 * year-plausible variant rejects the match outright (better to miss a
 * listing than mislabel one). Two overlaps need a token-based disambiguator
 * before falling back to displacement/fuel: Prado 90 vs the 100/105-series
 * diesel (1998-2002, resolved by "Prado" — Toyota's own name for the J9
 * line, never used for the 100-series) and the 70-series classic diesel vs
 * the 100/105-series diesel (same displacement/fuel, heavily overlapping
 * years — resolved by Toyota's own model-number tokens, e.g. "78"/"hdj100").
 * An ad with none of these tokens and no displacement/fuel stated stays
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

  if (!/land\s*cruiser|prado/.test(haystack)) return null;
  if (EXCLUDED_GENERATIONS.some((t) => haystack.includes(` ${t} `))) return null;

  let candidates = TARGET_VARIANTS.filter((v) => year >= v.yearFrom && year <= v.yearTo);
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

  // The 70-series classic diesel and the 100/105-series diesel share
  // displacement (4.2), fuel and an overlapping year window, so neither
  // narrows them apart — Toyota's own model-number tokens are the only
  // thing that can when the ad skips the spec sheet.
  const J7_TOKENS = [
    "70", "71", "73", "75", "76", "77", "78", "79",
    "hzj70", "hzj71", "hzj73", "hzj75", "hzj76", "hzj77", "hzj78", "hzj79",
    "hdj70", "hdj71", "hdj73", "hdj76", "hdj78", "hdj79",
  ];
  if (J7_TOKENS.some((t) => haystack.includes(` ${t} `))) {
    const only = candidates.filter((v) => v.generation === "J7 (70-series) classic diesel");
    if (only.length) candidates = only;
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
