/**
 * The full pipeline, run every 2 hours by GitHub Actions.
 * SCAN_DEPTH=1 for the routine runs, 6 for the nightly deep sweep that keeps
 * last_seen honest across whole categories.
 *
 * Emits GitHub Actions outputs (new_deals / health_warnings) that the
 * workflow turns into issues, so nothing here needs to know about GitHub.
 */
import { appendFileSync } from "node:fs";
import { db } from "../lib/db";
import { SOURCES } from "../lib/scrape/sources";
import { ingest, deactivateStale, type IngestStats } from "../lib/pipeline/ingest";
import { scoreAll } from "../lib/pipeline/score";
import { evaluateTop } from "../lib/pipeline/evaluate";
import { sendDealAlert } from "../lib/notify/email";

function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<EOF\n${value}\nEOF\n`);
  }
}

async function main() {
  const startedAt = new Date();
  const depth = Math.max(1, parseInt(process.env.SCAN_DEPTH ?? "1", 10));
  const sql = db();

  const counts: Record<string, IngestStats & { error?: string }> = {};
  const warnings: string[] = [];

  // Sources hit different hosts, and the polite rate limit is per host, so
  // they run in parallel. Wall time becomes the slowest source, which keeps
  // the depth-6 nightly sweep well inside the workflow timeout.
  const active = SOURCES.filter((s) => s.enabled?.() ?? true);
  for (const s of SOURCES) {
    if (!active.includes(s)) console.log(`${s.name}: disabled (no key), skipping`);
  }

  await Promise.all(
    active.map(async (source) => {
      try {
        const rows = await source.scan(depth);
        const stats = await ingest(source, rows);
        counts[source.name] = stats;
        console.log(
          `${source.name}: seen=${stats.seen} kept=${stats.kept} new=${stats.inserted} drops=${stats.priceDrops}`,
        );
        if (stats.seen < source.expectedMinimum) {
          warnings.push(
            `${source.name} returned ${stats.seen} rows (expected >= ${source.expectedMinimum}). Markup change or block?`,
          );
        }
      } catch (err) {
        const msg = (err as Error).message.slice(0, 200);
        counts[source.name] = { seen: 0, kept: 0, inserted: 0, priceDrops: 0, error: msg };
        warnings.push(`${source.name} failed entirely: ${msg}`);
        console.log(`${source.name}: FAILED ${msg}`);
      }
    }),
  );

  const deactivated = await deactivateStale();
  const { scored } = await scoreAll();
  const evaluated = await evaluateTop();

  const inserted = Object.values(counts).reduce((n, c) => n + c.inserted, 0);
  const drops = Object.values(counts).reduce((n, c) => n + c.priceDrops, 0);

  await sql.query(
    `insert into scan_runs (started_at, depth, source_counts, new_listings, price_drops)
     values ($1,$2,$3,$4,$5)`,
    [startedAt.toISOString(), depth, JSON.stringify(counts), inserted, drops],
  );

  // Fresh high scorers from this run become the notification payload.
  const newDeals = (await sql.query(
    `select l.id, l.title, l.url, l.country, l.price_eur, e.score
     from listings l join evaluations e on e.listing_id = l.id
     where l.is_active and e.score >= 70 and l.first_seen >= $1
     order by e.score desc limit 10`,
    [startedAt.toISOString()],
  )) as { title: string; url: string; country: string; price_eur: string; score: number }[];

  if (newDeals.length) {
    setOutput(
      "new_deals",
      newDeals
        .map(
          (d) =>
            `- [${d.score}] ${d.title.slice(0, 80)} | ${Math.round(Number(d.price_eur))} EUR (${d.country}) | ${d.url}`,
        )
        .join("\n"),
    );
    await sendDealAlert(newDeals);
  }
  if (warnings.length) setOutput("health_warnings", warnings.join("\n"));

  console.log(
    `done: +${inserted} new, ${drops} price drops, ${deactivated} deactivated, ${scored} scored, ${evaluated} AI verdicts, ${warnings.length} warnings`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
