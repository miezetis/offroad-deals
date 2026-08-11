import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { TARGET_VARIANTS, type TargetVariant } from "../target-variants";

/**
 * The AI pass. Only the best algorithmic candidates get read by the model,
 * verdicts are cached against the content hash, and the whole stage is
 * skipped when no key is configured. Grounded with real comps from our own
 * corpus so the model judges against data, not vibes.
 *
 * Scoring methodology is the owner's blueprint (2026-08-11): hard exclusion
 * checks first, then a weighted 5-category rubric (drivetrain 30 / engine 25
 * / suspension 20 / overlanding upgrades 15 / price-to-value 10) summing to
 * a 0-100 score, bucketed GREEN/YELLOW/RED. The blueprint was written for a
 * wider vehicle list (4Runner, Hilux, LC150) that isn't in scope here — it's
 * adapted to exactly the 4 variants in target-variants.ts, using that
 * module's engine tier / price target / locker / suspension data so the
 * prompt can never drift out of sync with the whitelist itself.
 */

const MAX_EVALUATIONS_PER_RUN = 12;
const MIN_SCORE_FOR_AI = 55;

function variantFor(generation: string | null, fuel: string | null, year: number | null): TargetVariant | undefined {
  if (!generation || !fuel || !year) return undefined;
  return TARGET_VARIANTS.find(
    (v) => v.generation === generation && v.fuel === fuel && year >= v.yearFrom && year <= v.yearTo,
  );
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
  image_url: string | null;
  score: number;
  market_median_eur: string | null;
  price_delta_pct: string | null;
  content_hash: string;
};

type CategoryScore = { label: string; points: number; max: number; detail: string };
type Verdict = {
  ai_score: number;
  bucket: "GREEN" | "YELLOW" | "RED";
  category_breakdown: CategoryScore[];
  verdict: string;
  risks: string[];
  inspect: string[];
};

function buildPrompt(c: Candidate, variant: TargetVariant | undefined, comps: string): string {
  const isV8 = variant?.fuel === "petrol" && variant.displacement === "4.7";

  return `You are appraising a used off-road 4x4 advert against a structured scoring
rubric. Score only what the advert text and photo actually show or state —
never assume equipment that isn't mentioned or visible, and never assume a
reader's personal budget, country, or intended use (the price-to-value
category below uses this exact variant's own fair-price band, which is a
market fact, not a personal preference).

HARD EXCLUSION CHECKS — apply these first, before any category scoring.
- Chassis/frame rust: seller text mentioning "chassis rust", "frame rot",
  "welded frame", "rust holes", or the photo visibly showing frame/chassis
  corrosion. If present: cap ai_score at 25, set bucket to "RED", and make
  it the first item in risks, regardless of anything else about the ad.
- Active, unconverted air/hydraulic suspension: ${
    variant?.airSuspensionRisk
      ? variant.airSuspensionRisk
      : "not a common factory option on this variant, so this is unlikely to apply."
  } This is a real repair-cost risk (reflect it in the Suspension category
  and in risks), not an automatic fail on its own — only chassis rust caps
  the score outright.
${variant?.hardExclusionNote ? `- ${variant.hardExclusionNote}\n` : ""}
CATEGORY SCORING — target sum equals ai_score, out of 100.
A. Drivetrain & capability (max 30 pts). Factory diff locks: ${
    variant?.lockerNotes ?? "no locker data available for this variant; score conservatively."
  } Only credit what the ad or photo actually shows — score the open/base-trim
  case if nothing is stated. Transmission: a 5-speed (auto or manual) scores
  higher than an older 4-speed automatic; infer from what is stated, or use a
  neutral mid-score if not stated. Low-range transfer case: full marks by
  default (standard on this whole platform) unless the ad indicates otherwise.
B. Engine reliability (max 25 pts). This exact variant's engine is ${
    variant ? `Tier ${variant.engineTier.rank} (${variant.engineTier.label}), worth ${variant.engineTier.points}/25 as the baseline.` : "not identified — score conservatively."
  }${isV8 ? " Deduct 5 points if the ad does not mention an LPG conversion (a real running-cost factor on this V8)." : ""}
C. Suspension & chassis (max 20 pts). Traditional steel coil springs
  (factory or heavy-duty aftermarket like Old Man Emu/Bilstein/Ironman) score
  highest. Active air/hydraulic suspension that is still original and
  unconverted scores low here (high failure risk) — not zero, since it may
  still function.
D. Overlanding value upgrades (max 15 pts). All-terrain or mud-terrain tyres
  with decent visible tread, underbody skid plates, a roof rack or off-road
  bumper, dual-battery/aux power setup — credit only what is stated in the
  text or visible in the photo, and note whether modifications look
  well-fitted or bodged if the photo shows them.
E. Price-to-value (max 10 pts). The fair EU asking-price band for this exact
  variant is ${variant ? `${variant.priceTarget.min}-${variant.priceTarget.max} EUR` : "unknown"} (our
  own scraped corpus currently puts the comparable median at ${c.market_median_eur ?? "insufficient data"} EUR).
  Full marks inside the band; 0 points if priced more than 25% above the band
  with no major documented build to justify it.

MARKET ORIGIN: if the ad indicates this is a US-spec/North American import or
grey-market car sold in Europe, note the parts-availability risk that implies.
A normal EU-market car is the default case here and needs no comment.

LISTING
Model: ${c.make} ${c.model}${c.generation ? ` (${c.generation})` : ""}
Year: ${c.year ?? "unknown"} | Mileage: ${c.mileage_km ? `${c.mileage_km} km` : "unknown"}
Fuel: ${c.fuel ?? "unknown"} | Gearbox: ${c.transmission ?? "unknown"}
Price: ${c.price_eur} EUR, located in ${c.country}
Title: ${c.title}
Seller text: ${(c.description ?? "").slice(0, 600) || "(none)"}
${c.image_url ? "\nA photo from the ad is attached — use it for the hard exclusion checks and categories A/C/D above." : "\nNo photo is available for this ad — judge on the text alone."}

REAL COMPARABLE LISTINGS FROM THE SAME CORPUS
${comps || "(none)"}

Respond with strict JSON only:
{"ai_score": <0-100, the sum of the 5 category points below>,
 "bucket": "<GREEN if ai_score >= 80, YELLOW if ai_score is 60-79, RED if ai_score < 60 — or RED regardless of score if the chassis-rust hard exclusion applies>",
 "category_breakdown": [
   {"label": "Drivetrain & capability", "points": <0-30>, "max": 30, "detail": "<one sentence: what you credited and why>"},
   {"label": "Engine reliability", "points": <0-25>, "max": 25, "detail": "<one sentence>"},
   {"label": "Suspension & chassis", "points": <0-20>, "max": 20, "detail": "<one sentence>"},
   {"label": "Overlanding upgrades", "points": <0-15>, "max": 15, "detail": "<one sentence>"},
   {"label": "Price-to-value", "points": <0-10>, "max": 10, "detail": "<one sentence, vs the ${variant ? `${variant.priceTarget.min}-${variant.priceTarget.max} EUR` : "target"} band>"}
 ],
 "verdict": "<2-3 sentences on whether the asking price is justified by the specification and condition>",
 "risks": ["<up to 4 short risk phrases specific to this ad and variant, hard-exclusion first if triggered>"],
 "inspect": ["<up to 4 things to check before buying, specific to this variant and what the ad does/doesn't state>"]}`;
}

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
            l.image_url,
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

    const variant = variantFor(c.generation, c.fuel, c.year);
    const prompt = buildPrompt(
      c,
      variant,
      comps.map((k) => `- ${k.year ?? "?"} | ${k.mileage_km ?? "?"} km | ${k.price_eur} EUR | ${k.country}`).join("\n"),
    );

    try {
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: c.image_url
              ? [
                  { type: "image", source: { type: "url", url: c.image_url } },
                  { type: "text", text: prompt },
                ]
              : prompt,
          },
        ],
      });
      const text = res.content[0].type === "text" ? res.content[0].text : "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) continue;
      const v = JSON.parse(json) as Verdict;

      const bucket = ["GREEN", "YELLOW", "RED"].includes(v.bucket) ? v.bucket : null;
      const breakdown = Array.isArray(v.category_breakdown) ? v.category_breakdown.slice(0, 5) : [];

      await sql.query(
        `update evaluations set ai_score = $2, verdict = $3, risks = $4, inspect = $5,
           bucket = $6, category_breakdown = $7, ai_hash = $8, evaluated_at = now()
         where listing_id = $1`,
        [
          c.id,
          Math.max(0, Math.min(100, Math.round(v.ai_score))),
          String(v.verdict).slice(0, 800),
          JSON.stringify((v.risks ?? []).slice(0, 4)),
          JSON.stringify((v.inspect ?? []).slice(0, 4)),
          bucket,
          JSON.stringify(breakdown),
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
