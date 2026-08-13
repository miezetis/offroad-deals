import { db } from "../db";
import { plnToEur } from "../scrape/fx";
import type { RawListing, Source } from "../scrape/types";
import { normalise } from "../vehicles";
import { matchTargetVariant } from "../target-variants";

/**
 * Keep the corpus wider than the buying band on purpose: the 12k Pajeros are
 * what prove the 7k one is cheap. The UI narrows to the user's band.
 *
 * Raised to 150k 2026-08-13 for the GRJ76 target, after a first guess of
 * 60k turned out too low: real AutoScout24 listings for this exact variant
 * go up to 83k EUR (mostly new-build overland-conversion stock, not used
 * cars), confirmed via the `inspect` workflow. The whole point of scoring
 * "much lower than usual" deals is having the expensive end of the real
 * market in the corpus to compare against — a cap that silently dropped
 * genuine high-priced comps would make every score a guess.
 */
const MIN_PRICE_EUR = 500;
const MAX_PRICE_EUR = 150000;

/** Same car cross-posted on two sites lands on the same key. */
function dedupeKey(make: string, model: string, year?: number, km?: number, price?: number) {
  return [
    normalise(make),
    normalise(model),
    year ?? "?",
    km ? Math.round(km / 10000) : "?",
    price ? Math.round(price / 500) : "?",
  ].join("|");
}

export type IngestStats = { seen: number; kept: number; inserted: number; priceDrops: number };

export async function ingest(source: Source, rows: RawListing[]): Promise<IngestStats> {
  const sql = db();
  const stats: IngestStats = { seen: rows.length, kept: 0, inserted: 0, priceDrops: 0 };

  for (let row of rows) {
    // Owner's call 2026-08-11: only the variants in lib/target-variants.ts,
    // across every source. Not the general lib/vehicles.ts whitelist any more.
    const vehicle = matchTargetVariant(row.title, row.year, row.fuel);
    if (!vehicle) continue;

    const priceEur = row.currency === "PLN" ? await plnToEur(row.price) : row.price;
    if (priceEur < MIN_PRICE_EUR || priceEur > MAX_PRICE_EUR) continue;

    // A 20-year-old 4x4 with under 30k km is a seller typo, not a time
    // capsule. Better no mileage than a fantasy one skewing the scores.
    if (row.mileageKm && row.mileageKm < 30000 && row.year && row.year < 2015) {
      row = { ...row, mileageKm: undefined };
    }

    stats.kept++;
    const id = `${source.name}:${row.sourceId}`;

    const existing = (await sql.query(
      "select price_eur from listings where id = $1",
      [id],
    )) as { price_eur: string }[];

    if (existing.length === 0) {
      await sql.query(
        `insert into listings
           (id, source, country, url, title, make, model, generation, year,
            mileage_km, fuel, transmission, power_kw, price_eur, price_original,
            currency, location, image_url, description, dedupe_key, raw)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          id, source.name, row.country ?? source.country, row.url, row.title.slice(0, 300),
          vehicle.make, vehicle.model, vehicle.generation ?? null, row.year ?? null,
          row.mileageKm ?? null, vehicle.fuel, row.transmission ?? null,
          row.powerKw ?? null,
          priceEur, row.price, row.currency,
          row.location ?? null, row.imageUrl || null, row.snippet ?? null,
          dedupeKey(vehicle.make, vehicle.model, row.year, row.mileageKm, priceEur),
          JSON.stringify({ desirability: vehicle.desirability, note: vehicle.note ?? null }),
        ],
      );
      await sql.query(
        "insert into price_history (listing_id, price_eur) values ($1, $2)",
        [id, priceEur],
      );
      stats.inserted++;
    } else {
      const oldPrice = Number(existing[0].price_eur);
      // coalesce so a source that improves its parsing backfills existing
      // rows, while a source that cannot see a field never wipes it. fuel is
      // the one exception: it is deterministic once matched (see
      // target-variants.ts), so it is always set outright rather than
      // trusting whatever a given source's own parser happened to see.
      await sql.query(
        `update listings set
           last_seen = now(), is_active = true, price_eur = $2, url = $3,
           year = coalesce($4, year),
           mileage_km = coalesce($5, mileage_km),
           fuel = $6,
           transmission = coalesce($7, transmission),
           power_kw = coalesce($8, power_kw),
           image_url = coalesce($9, image_url),
           generation = coalesce($10, generation)
         where id = $1`,
        [
          id, priceEur, row.url,
          row.year ?? null, row.mileageKm ?? null, vehicle.fuel,
          row.transmission ?? null, row.powerKw ?? null, row.imageUrl || null,
          vehicle.generation ?? null,
        ],
      );
      if (Math.abs(oldPrice - priceEur) >= 1) {
        await sql.query(
          "insert into price_history (listing_id, price_eur) values ($1, $2)",
          [id, priceEur],
        );
        if (priceEur < oldPrice) stats.priceDrops++;
      }
    }
  }

  return stats;
}

/**
 * Routine scans only read the first page per category, so an ad quietly slides
 * out of view long before it is sold. Only the daily deep sweep sees the full
 * category, hence the generous two-missed-sweeps window.
 */
export async function deactivateStale() {
  const sql = db();
  const gone = (await sql.query(
    "update listings set is_active = false where is_active and last_seen < now() - interval '50 hours' returning id",
  )) as { id: string }[];
  return gone.length;
}
