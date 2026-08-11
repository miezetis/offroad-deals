/**
 * The exact three Land Cruiser configurations the owner is shopping for.
 * Single source of truth, imported by:
 *  - lib/pipeline/ingest.ts (the site-wide whitelist — every source, not
 *    just theparking.eu, only keeps listings matching one of these three)
 *  - lib/scrape/sources/theparking.ts (pre-filters at the source too)
 *  - lib/pipeline/evaluate.ts (engine-specific notes in the AI prompt)
 *  - app/page.tsx (the fixed 3-option Model filter)
 *
 * Generation labels ("J12 (Prado 120)" etc) match lib/vehicles.ts's existing
 * Land Cruiser naming on purpose, so historical rows ingested under the old
 * broad whitelist line up with the new one instead of needing a migration.
 */

export type TargetVariant = {
  generation: string;
  label: string;
  displacement: string;
  fuel: "diesel" | "petrol";
  yearFrom: number;
  yearTo: number;
  desirability: number;
  note: string;
};

export const TARGET_VARIANTS: TargetVariant[] = [
  {
    generation: "J12 (Prado 120)",
    label: "Prado 120 3.0 D-4D (2006-09)",
    displacement: "3.0", fuel: "diesel", yearFrom: 2006, yearTo: 2009,
    desirability: 11,
    note: "1KD-FTV 3.0L D-4D turbo-diesel (173 HP / 410 Nm). Known weak points: " +
      "injector failures (cheap fuel is a common cause), timing chain guides and " +
      "tensioner wear past 200k km, EGR/DPF clogging on cars used mostly for short trips.",
  },
  {
    generation: "J10 (100-series)",
    label: "100 Series 4.7 V8 (1998-2007)",
    displacement: "4.7", fuel: "petrol", yearFrom: 1998, yearTo: 2007,
    desirability: 11,
    note: "2UZ-FE 4.7L V8 petrol (~232 HP / 434 Nm). Reliable engine, but check for " +
      "high fuel consumption as a running cost, front differential/IFS wear on early " +
      "cars, and confirm timing belt/water pump service history (not chain-driven).",
  },
  {
    generation: "J8 (80-series)",
    label: "80 Series 4.5 (1992-97)",
    displacement: "4.5", fuel: "petrol", yearFrom: 1992, yearTo: 1997,
    desirability: 13,
    note: "1FZ-FE 4.5L straight-6 petrol (~212 HP / 373 Nm). Watch for head gasket " +
      "failures (known weak point on this engine), fuel consumption, and rust on the " +
      "chassis/rear crossmember given the age of the vehicle.",
  },
];

export type TargetMatch = {
  make: string;
  model: string;
  generation: string;
  desirability: number;
  note: string;
};

/**
 * Title must mention the Land Cruiser line; displacement + fuel + year narrow
 * it down to one of the three. Used for sources whose raw title text is the
 * only reliable field (most of them) — theparking.eu has cleaner structured
 * fields and does its own matching against the same TARGET_VARIANTS data.
 */
export function matchTargetVariant(
  title: string,
  year: number | undefined,
  fuel: string | undefined,
): TargetMatch | null {
  if (!year || !fuel) return null;
  const normalized = title.toLowerCase();
  if (!/land\s*cruiser|prado/.test(normalized)) return null;

  const displacement = normalized.match(/\b(\d\.\d)\b/)?.[1];
  if (!displacement) return null;

  const variant = TARGET_VARIANTS.find(
    (v) => v.displacement === displacement && v.fuel === fuel && year >= v.yearFrom && year <= v.yearTo,
  );
  if (!variant) return null;

  return { make: "Toyota", model: "Land Cruiser", generation: variant.generation, desirability: variant.desirability, note: variant.note };
}
