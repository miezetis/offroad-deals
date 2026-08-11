import { db } from "@/lib/db";
import { TARGET_VARIANTS } from "@/lib/target-variants";
import { FilterChip, FilterField, FilterForm } from "./filter-form";
import { ListingCard, type CardData } from "./listing-card";
import type { Factor } from "./score-badge";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  score: "e.score desc nulls last",
  price: "l.price_eur asc",
  newest: "l.first_seen desc",
  mileage: "l.mileage_km asc nulls last",
  power: "l.power_kw desc nulls last",
  year: "l.year desc nulls last",
};
const SORT_LABELS: Record<string, string> = {
  score: "Best score", price: "Cheapest", newest: "Newest listed",
  mileage: "Lowest km", power: "Most power", year: "Newest year",
};

/**
 * Owner's call 2026-08-11: this page shows exactly the 3 Land Cruiser
 * variants in lib/target-variants.ts, nothing else. `l.generation` is set by
 * that same whitelist at ingest time (lib/pipeline/ingest.ts), so filtering
 * on it here is a belt-and-braces guarantee, not just a UI convenience —
 * even a stray row from before this whitelist existed cannot show up.
 */
const TARGET_GENERATIONS = TARGET_VARIANTS.map((v) => v.generation);
const VARIANT_LABEL = Object.fromEntries(TARGET_VARIANTS.map((v) => [v.generation, v.label]));

/**
 * Asking price, since shipping and import costs depend entirely on where the
 * reader lives. `max: null` means no ceiling, bounded only by the 35k
 * ingest cap.
 */
const BANDS = {
  small: { label: "Up to 5k", min: 0, max: 5000 },
  medium: { label: "5k-12k", min: 5000, max: 12000 },
  large: { label: "12k-20k", min: 12000, max: 20000 },
  all: { label: "All prices", min: 0, max: null },
} satisfies Record<string, { label: string; min: number; max: number | null }>;

type BandKey = keyof typeof BANDS;
const FUELS = ["diesel", "petrol"];
const GEARBOXES = ["manual", "automatic"];
const COUNTRIES = [
  "BE", "DE", "FR", "GB", "NL", "IT", "ES", "AT", "CH", "PL", "EE", "LV", "LT", "FI", "SK",
];

type Row = {
  id: string;
  source: string;
  country: string;
  url: string;
  title: string;
  make: string;
  model: string;
  generation: string | null;
  year: number | null;
  mileage_km: number | null;
  fuel: string | null;
  transmission: string | null;
  power_kw: number | null;
  price_eur: string;
  location: string | null;
  image_url: string | null;
  is_new: boolean;
  score: number | null;
  breakdown: Factor[] | null;
  ai_score: number | null;
  verdict: string | null;
  risks: string[] | null;
  inspect: string[] | null;
  market_median_eur: string | null;
  price_delta_pct: string | null;
  flag: string | null;
  opened_at: string | null;
  first_price: string | null;
};

function eur(value: string | number | null | undefined) {
  if (value == null) return "?";
  return `${Math.round(Number(value)).toLocaleString("en-US").replace(/,/g, " ")} €`;
}

function num(value: string | string[] | undefined) {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function ago(date: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function toCard(r: Row): CardData {
  const dropped = r.first_price != null && Number(r.price_eur) < Number(r.first_price) - 1;
  const heading = `${r.make} ${r.model}${r.generation ? ` · ${VARIANT_LABEL[r.generation] ?? r.generation}` : ""}`;
  const meta = [r.source, r.location ? `${r.country} · ${r.location.slice(0, 24)}` : r.country]
    .filter(Boolean)
    .join(" · ");

  return {
    id: r.id,
    url: r.url,
    heading,
    subtitle: r.title,
    year: r.year ? String(r.year) : null,
    mileage: r.mileage_km ? `${Math.round(r.mileage_km / 1000)} tkm` : null,
    fuel: r.fuel,
    power: r.power_kw ? `${r.power_kw} kW / ${Math.round(r.power_kw / 0.7355)} hp` : null,
    meta,
    price: eur(r.price_eur),
    median:
      r.market_median_eur && r.price_delta_pct
        ? `${Math.round(Number(r.price_delta_pct))}% vs median ${eur(r.market_median_eur)}`
        : null,
    medianNegative: Number(r.price_delta_pct ?? 0) < 0,
    score: r.score,
    breakdown: r.breakdown ?? [],
    isNew: r.is_new,
    priceDrop: dropped ? `${eur(r.first_price)} → ${eur(r.price_eur)}` : null,
    imageUrl: r.image_url,
    verdict: r.verdict,
    aiScore: r.ai_score,
    risks: r.risks ?? [],
    inspect: r.inspect ?? [],
    flag: r.flag,
    openedAt: r.opened_at,
  };
}

const field =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const pick = (key: string, allowed: string[]) =>
    allowed.includes(String(params[key])) ? String(params[key]) : "";

  const sort = SORTS[String(params.sort)] ? String(params.sort) : "score";
  const country = pick("country", COUNTRIES);
  const fuel = pick("fuel", FUELS);
  const gearbox = pick("gearbox", GEARBOXES);
  const generation = pick("generation", TARGET_GENERATIONS);
  const bandKey = (String(params.band) in BANDS ? String(params.band) : "medium") as BandKey;
  const band = BANDS[bandKey];
  const view =
    params.view === "starred" ? "starred" : params.view === "hidden" ? "hidden" : "main";
  const yearFrom = num(params.yearFrom);
  const yearTo = num(params.yearTo);
  const powerMin = num(params.powerMin);

  const sql = db();
  const where: string[] = ["l.is_active", "l.generation = any($1)"];
  const args: unknown[] = [TARGET_GENERATIONS];
  const add = (clause: (i: number) => string, value: unknown) => {
    args.push(value);
    where.push(clause(args.length));
  };

  if (view === "main") where.push("(f.flag is null or f.flag = 'starred')");
  if (view === "starred") where.push("f.flag = 'starred'");
  if (view === "hidden") where.push("f.flag = 'hidden'");
  if (view === "main" && band.max !== null) {
    args.push(band.min, band.max);
    where.push(`l.price_eur between $${args.length - 1} and $${args.length}`);
  }

  if (country) add((i) => `l.country = $${i}`, country);
  if (generation) add((i) => `l.generation = $${i}`, generation);
  if (fuel) add((i) => `l.fuel = $${i}`, fuel);
  if (gearbox) add((i) => `l.transmission = $${i}`, gearbox);
  if (yearFrom) add((i) => `l.year >= $${i}`, yearFrom);
  if (yearTo) add((i) => `l.year <= $${i}`, yearTo);
  if (powerMin) add((i) => `l.power_kw >= $${i}`, powerMin);

  const rows = (await sql.query(
    `select l.id, l.source, l.country, l.url, l.title, l.make, l.model, l.generation,
            l.year, l.mileage_km, l.fuel, l.transmission, l.power_kw, l.price_eur,
            l.location, l.image_url,
            (l.first_seen > now() - interval '24 hours') as is_new,
            e.score, e.breakdown, e.ai_score, e.verdict, e.risks, e.inspect,
            e.market_median_eur, e.price_delta_pct,
            f.flag, f.opened_at,
            (select ph.price_eur from price_history ph
              where ph.listing_id = l.id order by ph.seen_at asc limit 1) as first_price
     from listings l
     left join evaluations e on e.listing_id = l.id
     left join user_flags f on f.listing_id = l.id
     where ${where.join(" and ")}
     order by ${SORTS[sort]}
     limit 150`,
    args,
  )) as Row[];

  const lastScan = (await sql.query(
    `select finished_at from scan_runs order by id desc limit 1`,
  )) as { finished_at: string }[];

  const cards = rows.map(toCard);

  // Chips shown above the results, one per active narrowing filter, each
  // removable by linking to the same query string with that param dropped.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) qs.set(k, v);
  }
  const chipHref = (key: string) => {
    const next = new URLSearchParams(qs);
    next.delete(key);
    return `/?${next.toString()}`;
  };
  const chips: { key: string; label: string }[] = [];
  if (generation) chips.push({ key: "generation", label: VARIANT_LABEL[generation] });
  if (fuel) chips.push({ key: "fuel", label: fuel });
  if (gearbox) chips.push({ key: "gearbox", label: gearbox });
  if (country) chips.push({ key: "country", label: country });
  if (bandKey !== "medium") chips.push({ key: "band", label: BANDS[bandKey].label });
  if (yearFrom) chips.push({ key: "yearFrom", label: `from ${yearFrom}` });
  if (yearTo) chips.push({ key: "yearTo", label: `to ${yearTo}` });
  if (powerMin) chips.push({ key: "powerMin", label: `${powerMin}+ kW` });

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">
              Offroad<span className="text-emerald-500">Deals</span>
            </h1>
            <p className="truncate text-xs text-neutral-500">
              Toyota Land Cruiser only — Prado 120 · 100 Series V8 · 80 Series
              {lastScan[0] ? ` · scanned ${ago(lastScan[0].finished_at)}` : ""}
            </p>
          </div>
          <nav className="flex rounded-lg border border-neutral-800 bg-neutral-900 p-0.5 text-sm">
            {(["main", "starred", "hidden"] as const).map((v) => (
              <a
                key={v}
                href={`/?view=${v}`}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  view === v
                    ? "bg-neutral-100 font-medium text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {v === "main" ? "Deals" : v === "starred" ? "★" : "Hidden"}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 lg:hidden">
        <details className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-semibold text-neutral-200">
            Filters
            <a href={`/?view=${view}`} className="text-xs font-medium text-emerald-500 hover:underline">
              Clear all
            </a>
          </summary>
          <div className="mt-3.5">
            <FilterForm>
              <input type="hidden" name="view" value={view} />
              <FilterField label="Variant">
                <select name="generation" defaultValue={generation} className={field}>
                  <option value="">All 3 variants</option>
                  {TARGET_VARIANTS.map((v) => (
                    <option key={v.generation} value={v.generation}>{v.label}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Fuel">
                <select name="fuel" defaultValue={fuel} className={field}>
                  <option value="">Any fuel</option>
                  {FUELS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Gearbox">
                <select name="gearbox" defaultValue={gearbox} className={field}>
                  <option value="">Any gearbox</option>
                  {GEARBOXES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Country">
                <select name="country" defaultValue={country} className={field}>
                  <option value="">All countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Price band">
                <select name="band" defaultValue={bandKey} className={field}>
                  {Object.entries(BANDS).map(([key, b]) => (
                    <option key={key} value={key}>{b.label}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Year">
                <div className="flex gap-1.5">
                  <input
                    type="number" name="yearFrom" placeholder="from" min={1960} max={2030}
                    defaultValue={yearFrom ?? ""} className={field}
                  />
                  <input
                    type="number" name="yearTo" placeholder="to" min={1960} max={2030}
                    defaultValue={yearTo ?? ""} className={field}
                  />
                </div>
              </FilterField>
              <FilterField label="Min power (kW)">
                <input
                  type="number" name="powerMin" placeholder="kW" min={20} max={600}
                  defaultValue={powerMin ?? ""} className={field}
                />
              </FilterField>
            </FilterForm>
          </div>
        </details>
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-200">Filters</span>
              <a href={`/?view=${view}`} className="text-xs font-medium text-emerald-500 hover:underline">
                Clear all
              </a>
            </div>

            <FilterForm>
              <input type="hidden" name="view" value={view} />

              <FilterField label="Variant">
                <select name="generation" defaultValue={generation} className={field}>
                  <option value="">All 3 variants</option>
                  {TARGET_VARIANTS.map((v) => (
                    <option key={v.generation} value={v.generation}>{v.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Fuel">
                <select name="fuel" defaultValue={fuel} className={field}>
                  <option value="">Any fuel</option>
                  {FUELS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Gearbox">
                <select name="gearbox" defaultValue={gearbox} className={field}>
                  <option value="">Any gearbox</option>
                  {GEARBOXES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Country">
                <select name="country" defaultValue={country} className={field}>
                  <option value="">All countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Price band">
                <select name="band" defaultValue={bandKey} className={field}>
                  {Object.entries(BANDS).map(([key, b]) => (
                    <option key={key} value={key}>{b.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Year">
                <div className="flex gap-1.5">
                  <input
                    type="number" name="yearFrom" placeholder="from" min={1960} max={2030}
                    defaultValue={yearFrom ?? ""} className={field}
                  />
                  <input
                    type="number" name="yearTo" placeholder="to" min={1960} max={2030}
                    defaultValue={yearTo ?? ""} className={field}
                  />
                </div>
              </FilterField>

              <FilterField label="Min power (kW)">
                <input
                  type="number" name="powerMin" placeholder="kW" min={20} max={600}
                  defaultValue={powerMin ?? ""} className={field}
                />
              </FilterField>
            </FilterForm>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">
                {cards.length} listing{cards.length === 1 ? "" : "s"}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <FilterChip key={c.key} label={c.label} href={chipHref(c.key)} />
                ))}
              </div>
            </div>

            <FilterForm>
              <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                <input type="hidden" name="view" value={view} />
                {generation ? <input type="hidden" name="generation" value={generation} /> : null}
                {fuel ? <input type="hidden" name="fuel" value={fuel} /> : null}
                {gearbox ? <input type="hidden" name="gearbox" value={gearbox} /> : null}
                {country ? <input type="hidden" name="country" value={country} /> : null}
                {bandKey !== "medium" ? <input type="hidden" name="band" value={bandKey} /> : null}
                Sort:
                <select
                  name="sort"
                  defaultValue={sort}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-200 outline-none focus:border-neutral-500"
                >
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </FilterForm>
          </div>

          <ul className="space-y-3">
            {cards.map((card) => (
              <ListingCard key={card.id} card={card} />
            ))}
          </ul>

          {cards.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-2 text-center">
              <p className="text-3xl">🏜️</p>
              <p className="text-sm font-medium text-neutral-300">Nothing matches these filters</p>
              <p className="text-xs text-neutral-500">
                Loosen a filter, or wait for the next scan.
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
