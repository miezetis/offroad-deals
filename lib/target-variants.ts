/**
 * The exact seven vehicle configurations the owner is shopping for. Single
 * source of truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching one of these)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (the scoring rubric + engine notes in the AI prompt)
 *  - app/page.tsx (the fixed Variant filter)
 *
 * Owner's call 2026-08-13 (replacing the earlier Prado 120/100-series V8/
 * 80-series/GX470 list): prioritise the actual offroad legends over the
 * easier-to-source-in-Europe options that don't carry the same pedigree —
 * solid-axle/simple-mechanicals Toyotas, all diesel except the two petrol
 * inline-6/V8s the owner explicitly kept. GX470 dropped entirely: no
 * standard locker, IFS front, never earned real offroad-legend status
 * despite sharing the 100-series' drivetrain.
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
  /**
   * Null means "don't gate on displacement" — used for the Hilux, whose
   * pre-common-rail diesel options genuinely spanned 2.4/2.5/2.8/3.0L across
   * markets (confirmed against real theparking.eu inventory: stated 2.4 and
   * 2.5 examples exist within the target year window, not just 3.0). Safe
   * only because Hilux is its own model family with a single entry — the
   * matcher isolates candidates by model before this field is ever checked,
   * so there's no risk of it swallowing a Land Cruiser variant instead.
   */
  displacement: string | null;
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
    generation: "J7 (70-series)",
    label: "70 Series 4.2 Diesel (1990-2007)",
    displacement: "4.2", fuel: "diesel", yearFrom: 1990, yearTo: 2007,
    desirability: 13,
    note: "1HZ naturally-aspirated or 1HD-T/1HD-FT turbo 4.2L inline-6 diesel " +
      "(1HZ ~130 HP / 285 Nm, 1HD-FT ~165 HP / 380 Nm). The purist's Land Cruiser: " +
      "solid axles front and rear, leaf-sprung, minimal electronics — about as close " +
      "to unbreakable as a diesel Toyota gets. Genuinely few weak points; watch " +
      "1HD-FT turbo/injector wear at very high mileage, otherwise mostly a rust and " +
      "usage-history check rather than a mechanical one. Rare as a grey import in " +
      "most of Europe (never officially sold here post-90s) — confirm import " +
      "paperwork and left/right-hand-drive conversion history if applicable.",
    engineTier: { rank: 1, points: 25, label: "1HZ/1HD-T inline-6 diesel" },
    // Not in the owner's original blueprint — no documented target band. Estimated
    // from typical EU asking prices for grey-imported 70-series diesels (8k-15k
    // EUR, wide spread by age/spec); flagged as an assumption.
    priceTarget: { min: 8000, max: 15000 },
    hardExclusionNote: null,
    lockerNotes: "Factory front and rear locking differentials were a common option " +
      "on export/Africa-Middle-East-spec Troop Carrier and GX/GXL trims, standard on " +
      "some heavy-duty configurations — this generation is the most likely of all " +
      "seven targets to be genuinely triple-locked. Many base/JDM trims are open " +
      "though; only credit what the ad or dash-switch photos actually show.",
    airSuspensionRisk: null,
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
    make: "Toyota", model: "Land Cruiser",
    generation: "J10/J105 (100-series diesel)",
    label: "100 Series 4.2 Diesel HDJ100/105 (1998-2007)",
    displacement: "4.2", fuel: "diesel", yearFrom: 1998, yearTo: 2007,
    desirability: 12,
    note: "1HD-FTE 4.2L inline-6 turbo diesel (~204 HP / 430 Nm). More heavy-duty " +
      "than the IFS petrol V8 this generation is also sold with (not this variant — " +
      "only match on the stated diesel fuel/4.2 displacement). Covers both chassis " +
      "codes: the regular 100 (HDJ100, independent front, solid rear) and the export " +
      "105 wagon/Troop Carrier (HDJ105, solid axles front and rear, leaf-sprung, the " +
      "more heavy-duty of the two — check the ad/VIN for which one it actually is). " +
      "Known weak points: injector and turbo wear at very high mileage, glow plug " +
      "failures causing cold-start trouble, otherwise a robust, well-regarded engine.",
    engineTier: { rank: 1, points: 25, label: "1HD-FTE inline-6 turbo diesel" },
    // Not in the owner's original blueprint — no documented target band. Estimated
    // from typical EU asking prices for diesel 100-series wagons (10k-16k EUR, a
    // premium over the old petrol-V8 band since diesel trades higher in Europe);
    // flagged as an assumption.
    priceTarget: { min: 10000, max: 16000 },
    hardExclusionNote: null,
    lockerNotes: "Locking rear differential common on 105 Troop Carrier/GXL export " +
      "trims, sometimes paired with a locking front diff on heavy-duty spec. The " +
      "regular 100 (independent front suspension) typically has an open front — only " +
      "credit lockers the ad or dash-switch photos actually show.",
    airSuspensionRisk: null,
  },
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
    generation: "J15 (Prado 150)",
    label: "Prado 150 2.8 D-4D (2015-23)",
    displacement: "2.8", fuel: "diesel", yearFrom: 2015, yearTo: 2023,
    desirability: 10,
    note: "1GD-FTV 2.8L common-rail turbo-diesel (~177 HP / 450 Nm), the post-facelift " +
      "engine and the one that actually shows up used in Europe. Good value, proven, " +
      "common — but IFS front, so not full solid-axle like the 70/80-series. IMPORTANT " +
      "inspection item: early-production 1GD-FTV engines (roughly 2015-2017) were " +
      "subject to a piston-crack service campaign in several markets (shared with the " +
      "Hilux/Fortuner of the same era) — check for recall completion or a later " +
      "production date before buying.",
    engineTier: { rank: 2, points: 20, label: "1GD-FTV turbo diesel" },
    // Not in the owner's original blueprint — no documented target band. Estimated
    // from typical EU asking prices for a 2015+ diesel Prado 150 (20k-30k EUR,
    // priced as a still-recent vehicle); flagged as an assumption.
    priceTarget: { min: 20000, max: 30000 },
    hardExclusionNote: "Early-build (roughly 2015-2017) 1GD-FTV engines had a documented " +
      "piston-crack service campaign in several markets. No documented recall/engine " +
      "inspection history on an early-build example is a real inspect item, not automatically " +
      "disqualifying — weight it heavily given how expensive an engine-out repair would be.",
    lockerNotes: "Torsen center diff standard; locking rear differential optional on " +
      "higher trims (same pattern as Prado 120). Only credit a rear locker if the ad or " +
      "photos show it.",
    airSuspensionRisk: null,
  },
  {
    make: "Toyota", model: "Land Cruiser",
    generation: "J200 (200-series)",
    label: "200 Series 4.5 VDJ200 Diesel (2007-21)",
    displacement: "4.5", fuel: "diesel", yearFrom: 2007, yearTo: 2021,
    desirability: 11,
    note: "1VD-FTV 4.5L V8 twin-turbo diesel (~235-268 HP depending on year/market), " +
      "the engine that actually shows up used in Europe — not the rare US-spec 5.7 V8 " +
      "petrol. IMPORTANT inspection item: this engine has a well-documented EGR cooler " +
      "cracking issue (mainly pre-2012 production) that lets coolant leak into the " +
      "engine — arguably the single most important thing to check on this variant. " +
      "Also watch for standard DPF/EGR clogging on short-trip-only cars.",
    engineTier: { rank: 2, points: 20, label: "1VD-FTV V8 twin-turbo diesel" },
    // Not in the owner's original blueprint — no documented target band. Estimated
    // from typical EU asking prices for a diesel 200-series (18k-30k EUR); flagged
    // as an assumption.
    priceTarget: { min: 18000, max: 30000 },
    hardExclusionNote: "1VD-FTV's documented EGR cooler cracking issue (mainly pre-2012 " +
      "production) lets coolant leak into the engine — a serious, expensive failure mode. " +
      "No documented EGR cooler inspection/replacement history is a real risk on an " +
      "unconfirmed example, not automatically disqualifying, but weight it heavily.",
    lockerNotes: "Torsen center diff standard. Front and rear locking differentials were " +
      "standard on the Middle-East 'GXR'/'VXR' heavy-duty spec (a common source for " +
      "European grey imports) but not on every trim. Only credit lockers the ad or " +
      "dash-switch photos actually show.",
    airSuspensionRisk: "AHC (Active Height Control) air suspension standard on VX/Sahara+ " +
      "trims, KDSS on some markets — both documented expensive failure points when they age.",
  },
  {
    make: "Toyota", model: "Hilux",
    generation: "Mk5/Mk6 (1988-2005)",
    label: "Hilux Diesel, pre-common-rail (1988-2005)",
    // No displacement gate: this era's diesel options genuinely spanned
    // 2.4L (2L/2L-T), 2.5L, 2.8L (3L) and 3.0L (5L/5L-E) across markets — all
    // naturally-aspirated or single-turbo, mechanically-injected, none of
    // them common-rail. Year + fuel + the Hilux-only model filter (see
    // TargetVariant.displacement doc) is what actually identifies this
    // variant; a specific cc figure would just cause false misses.
    displacement: null, fuel: "diesel", yearFrom: 1988, yearTo: 2005,
    desirability: 12,
    note: "2.4-3.0L naturally-aspirated or single-turbo diesel (2L/2L-T/3L/5L/5L-E " +
      "family, ~75-103 HP depending on displacement) — no common-rail, about as " +
      "mechanically simple as a diesel gets. This is the era behind the 'nearly " +
      "indestructible' Hilux reputation (the Top Gear truck was this generation). " +
      "Genuinely minimal weak points on the engine itself; wear items are clutch and " +
      "gearbox from hard use, not the drivetrain. The later common-rail 1KD-FTV/" +
      "2KD-FTV Hilux (same injector risk as Prado 120) is NOT this variant — treat " +
      "any ad mentioning D-4D, common-rail, or a 2005+ facelift body as the wrong car.",
    engineTier: { rank: 1, points: 25, label: "2L/3L/5L-family diesel, pre-common-rail" },
    // Not in the owner's original blueprint — no documented target band. Estimated
    // from typical EU asking prices for a simple diesel Hilux this age (5k-10k EUR,
    // notably cheaper than the SUV/wagon options above); flagged as an assumption.
    priceTarget: { min: 5000, max: 10000 },
    hardExclusionNote: null,
    lockerNotes: "No factory locking rear differential on most export trims of this era " +
      "— that came later on the Vigo/Revo generations. Standard part-time 4WD with low " +
      "range only; don't credit a locker unless the ad explicitly states one was fitted.",
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
 * Other Land Cruiser lines/engines that share a title with a target but are
 * NOT one of our targets, and could otherwise be miscategorized: the
 * full-size 300-series, the 200-series' petrol engines (UZJ200 4.6, URJ200
 * 5.7 — our target is the VDJ200 diesel), and Hilux Surf (the JDM name for
 * the 4Runner, a completely different vehicle that would otherwise match the
 * bare "hilux" token below). Space-padded whole-word tokens, same technique
 * as lib/vehicles.ts's generation hints, so "300" doesn't match "300 kW" etc
 * (the padding requires the token to stand alone, not be a substring).
 */
const EXCLUDED_GENERATIONS = [
  "300", "j300",
  "uzj200", "urj200",
  "surf",
];

/**
 * Toyota's own model-number tokens for the two diesel Land Cruiser
 * generations that otherwise collide completely: the 70-series and the
 * 100/105-series diesel share the same displacement (4.2), fuel (diesel) and
 * year window (1998-2007 overlap), so neither displacement nor fuel narrows
 * them apart. Reuses the same bare-number hints lib/vehicles.ts already
 * keys its own J7/J10 generations on.
 */
const J7_TOKENS = [
  "70", "71", "73", "76", "78", "79",
  "hzj70", "hzj71", "hzj73", "hzj75", "hzj76", "hzj77", "hzj78", "hzj79",
  "hdj70", "hdj71", "hdj73", "hdj76", "hdj78", "hdj79",
];
const J100_TOKENS = ["100", "105", "hdj100", "hdj105", "hzj105", "uzj100"];

/**
 * Title must mention the Land Cruiser/Prado line or the Hilux — the two
 * vehicle families never share a title.
 *
 * Displacement and fuel each narrow the year-plausible candidates further
 * when the ad states them, and either one that flatly contradicts every
 * year-plausible variant rejects the match outright (better to miss a
 * listing than mislabel one). When neither is stated — common on
 * modification/build-focused listings that skip the spec sheet — year alone
 * still resolves it whenever only one variant's year window fits. Several
 * year windows are genuinely ambiguous this way and need a token-based
 * disambiguator before falling back to displacement/fuel: 1998-2007
 * (70-series vs the 100/105-series diesel — Toyota's own model-number
 * tokens above resolve it), 2006-2007 (Prado 120 vs the 100/105-series
 * diesel — "Prado" resolves it), and 2015-2021 (Prado 150 vs the 200-series
 * diesel — "Prado" or "200" resolves it). An ad with none of these tokens
 * and no displacement/fuel stated stays unresolved (null) rather than
 * guessing — same "miss over mislabel" rule as always.
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

  // "Prado" is Toyota's own name for the J12/J15 lines specifically — never
  // used for the 70/100/105/200-series — so it resolves any overlap between
  // a Prado generation and a non-Prado Land Cruiser even when the ad states
  // neither displacement nor fuel.
  if (haystack.includes(" prado ")) {
    const pradoOnly = candidates.filter(
      (v) => v.generation === "J12 (Prado 120)" || v.generation === "J15 (Prado 150)",
    );
    if (pradoOnly.length) candidates = pradoOnly;
  }

  // 70-series vs 100/105-series diesel: same displacement, fuel and an
  // overlapping year window, so Toyota's own model-number tokens are the
  // only thing that can tell them apart when the ad skips the spec sheet.
  if (J7_TOKENS.some((t) => haystack.includes(` ${t} `))) {
    const only = candidates.filter((v) => v.generation === "J7 (70-series)");
    if (only.length) candidates = only;
  } else if (J100_TOKENS.some((t) => haystack.includes(` ${t} `))) {
    const only = candidates.filter((v) => v.generation === "J10/J105 (100-series diesel)");
    if (only.length) candidates = only;
  }

  // "200" is the 200-series' own commercial model number, resolving its
  // 2015-2021 overlap with Prado 150 the same way "Prado" does above.
  if (haystack.includes(" 200 ")) {
    const only = candidates.filter((v) => v.generation === "J200 (200-series)");
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
