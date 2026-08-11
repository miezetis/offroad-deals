import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";

/**
 * The AI pass. Only the best algorithmic candidates get read by the model,
 * verdicts are cached against the content hash, and the whole stage is
 * skipped when no key is configured. Grounded with real comps from our own
 * corpus so the model judges against data, not vibes.
 */

const MAX_EVALUATIONS_PER_RUN = 12;
const MIN_SCORE_FOR_AI = 55;

type Candidate = {
  id: string;
  title: string;
  country: string;
  make: string;
  model: string;
  generation: string | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  price_eur: string;
  description: string | null;
  score: number;
  market_median_eur: string | null;
  price_delta_pct: string | null;
  content_hash: string;
};

type Verdict = { ai_score: number; verdict: string; risks: string[]; inspect: string[] };

export async function evaluateTop(): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("evaluate: ANTHROPIC_API_KEY not set, skipping AI pass");
    return 0;
  }

  const sql = db();
  const candidates = (await sql.query(
    `select l.id, l.title, l.country, l.make, l.model, l.generation, l.year,
            l.mileage_km, l.fuel, l.transmission, l.price_eur, l.description,
            e.score, e.market_median_eur, e.price_delta_pct,
            e.content_hash
     from listings l
     join evaluations e on e.listing_id = l.id
     where l.is_active
       and e.score >= $1
       and (e.ai_hash is null or e.ai_hash is distinct from e.content_hash)
     order by e.score desc
     limit $2`,
    [MIN_SCORE_FOR_AI, MAX_EVALUATIONS_PER_RUN],
  )) as Candidate[];

  if (candidates.length === 0) return 0;

  const anthropic = new Anthropic({ apiKey });
  let done = 0;

  for (const c of candidates) {
    const comps = (await sql.query(
      `select country, year, mileage_km, price_eur from listings
       where is_active and make = $1 and model = $2 and id <> $3
         and ($4::int is null or year is null or abs(year - $4) <= 4)
       order by abs(coalesce(mileage_km, 250000) - coalesce($5, 250000))
       limit 5`,
      [c.make, c.model, c.id, c.year, c.mileage_km],
    )) as { country: string; year: number | null; mileage_km: number | null; price_eur: string }[];

    const prompt = `You are appraising a used 4x4 advert for a general audience of
buyers. You do not know who is reading, where they live, what they can spend,
or what they want the vehicle for, so judge the advert on its own merits:
is this a good deal for this vehicle at this price, and what should anyone
know before contacting the seller?

Do not assume a budget, a country, a preferred fuel or gearbox, or an
intended use. Do not mention shipping, import or registration costs. If the
price is strong for the specification and condition, say so plainly even if
the car is expensive in absolute terms; a well-priced 18000 EUR truck is a
good deal and a poorly-priced 4000 EUR one is not.

LISTING
Model: ${c.make} ${c.model}${c.generation ? ` (${c.generation})` : ""}
Year: ${c.year ?? "unknown"} | Mileage: ${c.mileage_km ? `${c.mileage_km} km` : "unknown"}
Fuel: ${c.fuel ?? "unknown"} | Gearbox: ${c.transmission ?? "unknown"}
Price: ${c.price_eur} EUR, located in ${c.country}
Market median for comparable cars in our scraped corpus: ${c.market_median_eur ?? "insufficient data"} EUR
Title: ${c.title}
Seller text: ${(c.description ?? "").slice(0, 600) || "(none)"}

REAL COMPARABLE LISTINGS FROM THE SAME CORPUS
${comps.map((k) => `- ${k.year ?? "?"} | ${k.mileage_km ?? "?"} km | ${k.price_eur} EUR | ${k.country}`).join("\n") || "(none)"}

Respond with strict JSON only:
{"ai_score": <0-100, how good this advert is as a deal on its own terms>,
 "verdict": "<2-3 sentences on whether the asking price is justified by the specification, condition and comparables>",
 "risks": ["<up to 4 short risk phrases specific to this ad and model>"],
 "inspect": ["<up to 4 things to check before buying, model-specific>"]}`;

    try {
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.content[0].type === "text" ? res.content[0].text : "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) continue;
      const v = JSON.parse(json) as Verdict;

      await sql.query(
        `update evaluations set ai_score = $2, verdict = $3, risks = $4, inspect = $5,
           ai_hash = $6, evaluated_at = now()
         where listing_id = $1`,
        [
          c.id,
          Math.max(0, Math.min(100, Math.round(v.ai_score))),
          String(v.verdict).slice(0, 800),
          JSON.stringify((v.risks ?? []).slice(0, 4)),
          JSON.stringify((v.inspect ?? []).slice(0, 4)),
          c.content_hash,
        ],
      );
      done++;
    } catch (err) {
      console.log(`evaluate: ${c.id} failed: ${(err as Error).message.slice(0, 120)}`);
    }
  }

  return done;
}
