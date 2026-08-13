import { createHash } from "node:crypto";
import { db } from "../db";

/**
 * Deterministic scoring. The market reference is our own scraped corpus, so
 * every listing is judged against real asking prices for the same model, not
 * a guess.
 *
 * The score rates the **advert**, not its fit to any particular buyer. Every
 * factor is a property of the listing or the vehicle that any reader would
 * agree on: what it costs against comparable cars, how hard it has been used
 * for its age, whether the seller's own text admits to faults, and how
 * completely the ad is filled in. Personal preferences (fuel, gearbox,
 * budget, where you live and what shipping would cost you) are deliberately
 * absent — those belong in the filters, where each reader sets their own.
 *
 * Every factor records what it contributed and why, and that breakdown is
 * stored alongside the score so the UI can explain any number it shows.
 */

/**
 * Everything starts here so that a listing failing one factor still ranks
 * above one failing three. Without it the sum bottoms out and hundreds of
 * listings collapse onto 0, indistinguishable from each other.
 */
const BASELINE = 20;

/** Typical annual distance for these vehicles, used to judge mileage by age. */
const EXPECTED_KM_PER_YEAR = 15000;

/**
 * Below this, a listing for any vehicle on the whitelist is almost never a
 * running, road-legal car. Not a budget rule — a plausibility one.
 */
const IMPLAUSIBLY_CHEAP_EUR = 2000;

export type Factor = {
  label: string;
  points: number;
  detail: string;
};

export type Scored = {
  id: string;
  score: number;
  marketMedian: number | null;
  priceDeltaPct: number | null;
  contentHash: string;
  breakdown: Factor[];
};

type Row = {
  id: string;
  country: string;
  title: string;
  make: string;
  model: string;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  power_kw: number | null;
  price_eur: string;
  description: string | null;
  raw: { desirability?: number } | null;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Red flags in seller text. Each is labelled so the breakdown can say which
 * phrase triggered the penalty rather than just deducting points silently.
 */
const RED_FLAGS: [RegExp, string][] = [
  [/motorschaden|variklio\s*defekt|engine\s*damage/i, "engine damage"],
  [/getriebeschaden|gearbox\s*damage|defekt.*gearbox/i, "gearbox damage"],
  [/kein\s*t[üu]v|ohne\s*t[üu]v|be\s*ta\b|bez\s*ta\b|be\s*tech/i, "no roadworthiness certificate"],
  [/unfall|avarij|accident|powypadkow/i, "accident damage"],
  [/p[āa]rdod\s*da[ļl][āa]s|dalimis|na\s*[cč]asti|for\s*parts|auf\s*teile/i, "sold for parts"],
  [/nev[ai]ž[iu]uoja|nejezdi|not\s*running|nie\s*jezdzi/i, "not running"],
  [/rez[eė]les|supuv|rust|rostig|zardzewial/i, "rust mentioned"],
  [/renovavimui|remontui|zum\s*restaurieren|do\s*remontu|project/i, "project / needs restoration"],
];

/** Value against the model's own market, weighted by how many comps we had. */
function valueFactor(priceDeltaPct: number | null, compCount: number): Factor {
  if (priceDeltaPct === null) {
    return {
      label: "Market value",
      points: 0,
      detail: `Not enough comparable listings yet (${compCount} found, need 5)`,
    };
  }

  // Thin samples make an extreme median untrustworthy, so their influence
  // is damped rather than trusted outright.
  const confidence = compCount >= 20 ? 1 : compCount >= 10 ? 0.85 : 0.7;
  const raw = Math.max(-28, Math.min(50, -priceDeltaPct * 1.3));
  const points = Math.round(raw * confidence);
  const direction = priceDeltaPct < 0 ? "below" : "above";

  return {
    label: "Market value",
    points,
    detail: `${Math.abs(Math.round(priceDeltaPct))}% ${direction} median of ${compCount} comparable listings${confidence < 1 ? " (small sample, damped)" : ""}`,
  };
}

/** Mileage judged against the car's age, not as an absolute number. */
function mileageFactor(mileageKm: number | null, year: number | null): Factor {
  if (!mileageKm) {
    return { label: "Mileage", points: 0, detail: "Not stated in the listing" };
  }

  const age = year ? Math.max(1, new Date().getFullYear() - year) : null;
  if (!age) {
    const points = mileageKm > 350000 ? -10 : mileageKm < 150000 ? 5 : 0;
    return {
      label: "Mileage",
      points,
      detail: `${Math.round(mileageKm / 1000)}k km, age unknown so judged absolutely`,
    };
  }

  const perYear = Math.round(mileageKm / age);
  const ratio = perYear / EXPECTED_KM_PER_YEAR;
  const points = ratio < 0.6 ? 10 : ratio < 1.1 ? 5 : ratio < 1.6 ? 0 : ratio < 2.2 ? -8 : -15;

  return {
    label: "Mileage",
    points,
    detail: `${Math.round(mileageKm / 1000)}k km over ${age} years, ${(perYear / 1000).toFixed(1)}k/year vs ${EXPECTED_KM_PER_YEAR / 1000}k typical`,
  };
}

export async function scoreAll(): Promise<{ scored: number; top: Scored[] }> {
  const sql = db();

  const rows = (await sql.query(
    `select l.id, l.country, l.title, l.make, l.model, l.year, l.mileage_km,
            l.fuel, l.transmission, l.power_kw, l.price_eur, l.description, l.raw
     from listings l where l.is_active`,
  )) as Row[];

  const byModel = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.make}|${row.model}`;
    const bucket = byModel.get(key);
    if (bucket) bucket.push(row);
    else byModel.set(key, [row]);
  }

  const results: Scored[] = [];

  for (const row of rows) {
    const price = Number(row.price_eur);
    const peers = byModel.get(`${row.make}|${row.model}`) ?? [];

    // Fallback ladder: same model within +-3 years, then same model any year.
    let comps = row.year
      ? peers.filter((p) => p.year && Math.abs(p.year - row.year!) <= 3 && p.id !== row.id)
      : [];
    if (comps.length < 5) comps = peers.filter((p) => p.id !== row.id);

    let marketMedian: number | null = null;
    let priceDeltaPct: number | null = null;
    if (comps.length >= 5) {
      marketMedian = median(comps.map((c) => Number(c.price_eur)));
      priceDeltaPct = ((price - marketMedian) / marketMedian) * 100;
    }

    const breakdown: Factor[] = [
      { label: "Baseline", points: BASELINE, detail: "Every listing starts here" },
      valueFactor(priceDeltaPct, comps.length),
    ];

    // Model desirability, normalised. Capped low on purpose: it says how good
    // the vehicle is, not how good the deal is, and it must not swamp value.
    const desirability = row.raw?.desirability ?? 5;
    breakdown.push({
      label: "Model",
      points: Math.round((Math.min(13, desirability) / 13) * 18),
      detail: `${row.make} ${row.model} rates ${desirability}/13 as an offroader`,
    });

    breakdown.push(mileageFactor(row.mileage_km, row.year));

    // Not a budget test — a plausibility test. A running 4x4 priced this far
    // under the floor for its own model is usually a non-runner, a parts car,
    // or bait, and the price alone is the tell.
    if (price < IMPLAUSIBLY_CHEAP_EUR) {
      breakdown.push({
        label: "Price plausibility",
        points: -12,
        detail: `${price} EUR is below what a running example of anything on this list sells for`,
      });
    }

    const haystack = `${row.title} ${row.description ?? ""}`;
    const hits = RED_FLAGS.filter(([re]) => re.test(haystack)).map(([, label]) => label);
    if (hits.length) {
      breakdown.push({
        label: "Red flags",
        points: Math.max(-30, hits.length * -12),
        detail: hits.join(", "),
      });
    }

    // Year and fuel are guaranteed present for every row that reaches this
    // table (both are required to match one of the target variants in the
    // first place — see lib/target-variants.ts), so mileage is the only
    // basic fact that can genuinely still be missing from the ad.
    if (!row.mileage_km) {
      breakdown.push({
        label: "Missing data",
        points: -3,
        detail: "Listing does not state mileage",
      });
    }

    const total = breakdown.reduce((sum, f) => sum + f.points, 0);
    const score = Math.round(Math.max(0, Math.min(100, total)));

    const contentHash = createHash("sha256")
      .update(`${row.title}|${price}|${row.description ?? ""}`)
      .digest("hex")
      .slice(0, 32);

    results.push({
      id: row.id,
      score,
      marketMedian,
      priceDeltaPct,
      contentHash,
      breakdown,
    });
  }

  for (const r of results) {
    await sql.query(
      `insert into evaluations
         (listing_id, content_hash, score, market_median_eur, price_delta_pct,
          landed_cost_eur, breakdown)
       values ($1,$2,$3,$4,$5,null,$6)
       on conflict (listing_id) do update set
         content_hash = excluded.content_hash,
         score = excluded.score,
         market_median_eur = excluded.market_median_eur,
         price_delta_pct = excluded.price_delta_pct,
         landed_cost_eur = null,
         breakdown = excluded.breakdown,
         evaluated_at = now()`,
      [
        r.id, r.contentHash, r.score, r.marketMedian, r.priceDeltaPct,
        JSON.stringify(r.breakdown),
      ],
    );
  }

  const top = [...results].sort((a, b) => b.score - a.score).slice(0, 15);
  return { scored: results.length, top };
}
