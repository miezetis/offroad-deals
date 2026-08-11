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

/**
 * Known-issue notes for specific engine/generation combinations, so the AI
 * pass can flag model-specific things instead of generic advice. Matched by
 * generation + fuel + a year window narrower than the generation itself,
 * since e.g. the 100 Series spans both a 4.2 diesel and a 4.7 V8 petrol, and
 * only the latter gets this note.
 */
const ENGINE_NOTES: { generation: string; fuel: string; yearFrom: number; yearTo: number; note: string }[] = [
  {
    generation: "J12 (Prado 120)", fuel: "diesel", yearFrom: 2006, yearTo: 2009,
    note: "1KD-FTV 3.0L D-4D turbo-diesel (173 HP / 410 Nm). Known weak points: injector failures " +
      "(cheap fuel is a common cause), timing chain guides and tensioner wear past 200k km, EGR/DPF " +
      "clogging on cars used mostly for short trips.",
  },
  {
    generation: "J10 (100-series)", fuel: "petrol", yearFrom: 1998, yearTo: 2007,
    note: "2UZ-FE 4.7L V8 petrol (~232 HP / 434 Nm). Reliable engine, but check for: high fuel " +
      "consumption as a running cost, front differential/IFS wear on early cars, and confirm timing " +
      "belt/water pump service history, not chain-driven on this engine.",
  },
  {
    generation: "J8 (80-series)", fuel: "petrol", yearFrom: 1992, yearTo: 1997,
    note: "1FZ-FE 4.5L straight-6 petrol (~212 HP / 373 Nm). Watch for: head gasket failures " +
      "(known weak point on this engine), fuel consumption, and rust on the chassis/rear crossmember " +
      "given the age of the vehicle.",
  },
];

function engineNote(generation: string | null, fuel: string | null, year: number | null): string | undefined {
  if (!generation || !fuel || !year) return undefined;
  return ENGINE_NOTES.find(
    (n) => n.generation === generation && n.fuel === fuel && year >= n.yearFrom && year <= n.yearTo,
  )?.note;
}

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
  // Listings that already carry a verdict go first: when the prompt changes,
  // invalidating ai_hash makes every prior verdict eligible again, and
  // without this those stale-but-still-displayed verdicts would be buried
  // under whichever new candidates happen to score higher.
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
     order by (e.verdict is not null) desc, e.score desc
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
${engineNote(c.generation, c.fuel, c.year) ? `\nKnown engine/generation notes: ${engineNote(c.generation, c.fuel, c.year)}\n` : ""}
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
