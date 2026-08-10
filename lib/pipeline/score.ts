import { createHash } from "node:crypto";
import { db } from "../db";

/**
 * Deterministic scoring. The market reference is our own scraped corpus, so
 * every listing is judged against real asking prices for the same model, not
 * a guess.
 */

/** Rough door-to-door transport into Lithuania, EUR. */
const TRANSPORT_EUR: Record<string, number> = {
  LT: 0, LV: 150, EE: 250, PL: 300, SK: 450, DE: 700, FI: 500,
};
/** LT registration, plates, mandatory checks for an import. */
const REGISTRATION_EUR = 150;

export type Scored = {
  id: string;
  score: number;
  marketMedian: number | null;
  priceDeltaPct: number | null;
  landedCost: number;
  contentHash: string;
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
  price_eur: string;
  description: string | null;
  raw: { desirability?: number } | null;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Red flags in seller text that the algorithm can catch without AI. */
const RED_FLAGS =
  /be\s*ta|bez\s*ta|be\s*tech|defekt|nevažiuoja|nejezdi|motorschaden|getriebeschaden|kein\s*t[üu]v|ohne\s*t[üu]v|unfall|avarij|p[āa]rdod\s*da[ļl][āa]s|dalimis|na\s*[cč]asti|export|rez[eė]les|supuv|renovavimui|remontui/i;

export async function scoreAll(): Promise<{ scored: number; top: Scored[] }> {
  const sql = db();

  const rows = (await sql.query(
    `select l.id, l.country, l.title, l.make, l.model, l.year, l.mileage_km,
            l.fuel, l.transmission, l.price_eur, l.description, l.raw
     from listings l where l.is_active`,
  )) as Row[];

  // Build comparison buckets in memory; the whole active corpus is small.
  const byModel = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.make}|${row.model}`;
    byModel.get(key)?.push(row) ?? byModel.set(key, [row]);
  }

  const results: Scored[] = [];

  for (const row of rows) {
    const price = Number(row.price_eur);
    const peers = byModel.get(`${row.make}|${row.model}`) ?? [];

    // Fallback ladder: same model within +-3 years, then same model any year.
    // Never fewer than 5 comps, otherwise no median claim is made.
    let comps = row.year
      ? peers.filter((p) => p.year && Math.abs(p.year - row.year!) <= 3 && p.id !== row.id)
      : [];
    if (comps.length < 5) comps = peers.filter((p) => p.id !== row.id);

    let marketMedian: number | null = null;
    let priceDeltaPct: number | null = null;
    let score = 0;

    if (comps.length >= 5) {
      marketMedian = median(comps.map((c) => Number(c.price_eur)));
      priceDeltaPct = ((price - marketMedian) / marketMedian) * 100;
      // Being 40% under median is worth ~55 points, capped so one absurd
      // (usually broken) listing cannot hit 100 on price alone.
      score += Math.max(-20, Math.min(55, -priceDeltaPct * 1.4));
    }

    const desirability = row.raw?.desirability ?? 5;
    score += desirability * 2.5;

    if (row.fuel === "diesel") score += 5;
    if (row.transmission === "manual") score += 3;

    if (row.mileage_km) {
      if (row.mileage_km > 400000) score -= 15;
      else if (row.mileage_km > 300000) score -= 8;
      else if (row.mileage_km < 200000) score += 5;
    }

    const transport = TRANSPORT_EUR[row.country] ?? 400;
    const landedCost = Math.round(price + transport + (row.country === "LT" ? 0 : REGISTRATION_EUR));

    // The buying band. Above it the deal is academic, below it suspicious.
    if (landedCost >= 4000 && landedCost <= 12000) score += 10;
    else if (landedCost < 2000) score -= 10;

    if (RED_FLAGS.test(`${row.title} ${row.description ?? ""}`)) score -= 25;

    score = Math.round(Math.max(0, Math.min(100, score)));

    const contentHash = createHash("sha256")
      .update(`${row.title}|${price}|${row.description ?? ""}`)
      .digest("hex")
      .slice(0, 32);

    results.push({ id: row.id, score, marketMedian, priceDeltaPct, landedCost, contentHash });
  }

  for (const r of results) {
    await sql.query(
      `insert into evaluations (listing_id, content_hash, score, market_median_eur, price_delta_pct, landed_cost_eur)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (listing_id) do update set
         content_hash = excluded.content_hash,
         score = excluded.score,
         market_median_eur = excluded.market_median_eur,
         price_delta_pct = excluded.price_delta_pct,
         landed_cost_eur = excluded.landed_cost_eur,
         evaluated_at = now()`,
      [r.id, r.contentHash, r.score, r.marketMedian, r.priceDeltaPct, r.landedCost],
    );
  }

  const top = [...results].sort((a, b) => b.score - a.score).slice(0, 15);
  return { scored: results.length, top };
}
