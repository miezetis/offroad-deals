import { db } from "@/lib/db";
import { FilterForm } from "./filter-form";
import { ListingCard, type CardData } from "./listing-card";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  score: "e.score desc nulls last",
  price: "l.price_eur asc",
  newest: "l.first_seen desc",
  mileage: "l.mileage_km asc nulls last",
  power: "l.power_kw desc nulls last",
  year: "l.year desc nulls last",
};

const COUNTRIES = ["EE", "LV", "LT", "FI", "PL", "SK", "DE"];
const FUELS = ["diesel", "petrol", "lpg", "hybrid", "electric"];
const GEARBOXES = ["manual", "automatic"];

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
  first_seen: string;
  score: number | null;
  ai_score: number | null;
  verdict: string | null;
  risks: string[] | null;
  inspect: string[] | null;
  market_median_eur: string | null;
  price_delta_pct: string | null;
  landed_cost_eur: string | null;
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

function toCard(r: Row, dayAgo: number): CardData {
  const chips: string[] = [];
  chips.push(`${r.make} ${r.model}${r.generation ? ` ${r.generation}` : ""}`);
  if (r.year) chips.push(String(r.year));
  if (r.mileage_km) chips.push(`${Math.round(r.mileage_km / 1000)} tkm`);
  if (r.power_kw) chips.push(`${r.power_kw} kW / ${Math.round(r.power_kw / 0.7355)} hp`);
  if (r.fuel) chips.push(r.fuel);
  if (r.transmission) chips.push(r.transmission);
  chips.push(r.location ? `${r.country} · ${r.location.slice(0, 24)}` : r.country);
  chips.push(r.source);

  const dropped = r.first_price != null && Number(r.price_eur) < Number(r.first_price) - 1;

  return {
    id: r.id,
    url: r.url,
    title: r.title,
    chips,
    price: eur(r.price_eur),
    landed: r.landed_cost_eur ? eur(r.landed_cost_eur) : null,
    median:
      r.market_median_eur && r.price_delta_pct
        ? `${Math.round(Number(r.price_delta_pct))}% vs median ${eur(r.market_median_eur)}`
        : null,
    medianNegative: Number(r.price_delta_pct ?? 0) < 0,
    score: r.score,
    isNew: new Date(r.first_seen).getTime() > dayAgo,
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
  "shrink-0 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const pick = (key: string, allowed: string[]) =>
    allowed.includes(String(params[key])) ? String(params[key]) : "";

  const sort = SORTS[String(params.sort)] ? String(params.sort) : "score";
  const country = pick("country", COUNTRIES);
  const fuel = pick("fuel", FUELS);
  const gearbox = pick("gearbox", GEARBOXES);
  const model = typeof params.model === "string" ? params.model : "";
  const band = params.band === "all" ? "all" : "budget";
  const view =
    params.view === "starred" ? "starred" : params.view === "hidden" ? "hidden" : "main";
  const yearFrom = num(params.yearFrom);
  const yearTo = num(params.yearTo);
  const powerMin = num(params.powerMin);

  const sql = db();
  const where: string[] = ["l.is_active"];
  const args: unknown[] = [];
  const add = (clause: (i: number) => string, value: unknown) => {
    args.push(value);
    where.push(clause(args.length));
  };

  if (view === "main") where.push("(f.flag is null or f.flag = 'starred')");
  if (view === "starred") where.push("f.flag = 'starred'");
  if (view === "hidden") where.push("f.flag = 'hidden'");
  if (band === "budget" && view === "main")
    where.push("coalesce(e.landed_cost_eur, l.price_eur) between 3500 and 13000");

  if (country) add((i) => `l.country = $${i}`, country);
  if (model) add((i) => `(l.make || ' ' || l.model) ilike $${i}`, `%${model}%`);
  if (fuel) add((i) => `l.fuel = $${i}`, fuel);
  if (gearbox) add((i) => `l.transmission = $${i}`, gearbox);
  if (yearFrom) add((i) => `l.year >= $${i}`, yearFrom);
  if (yearTo) add((i) => `l.year <= $${i}`, yearTo);
  if (powerMin) add((i) => `l.power_kw >= $${i}`, powerMin);

  const rows = (await sql.query(
    `select l.id, l.source, l.country, l.url, l.title, l.make, l.model, l.generation,
            l.year, l.mileage_km, l.fuel, l.transmission, l.power_kw, l.price_eur,
            l.location, l.image_url, l.first_seen,
            e.score, e.ai_score, e.verdict, e.risks, e.inspect,
            e.market_median_eur, e.price_delta_pct, e.landed_cost_eur,
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

  const models = (await sql.query(
    `select distinct make || ' ' || model as name from listings where is_active order by 1`,
  )) as { name: string }[];

  const lastScan = (await sql.query(
    `select finished_at from scan_runs order by id desc limit 1`,
  )) as { finished_at: string }[];

  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const cards = rows.map((r) => toCard(r, dayAgo));

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-black">
      <header className="sticky top-0 z-10 border-b border-neutral-800/70 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">
              Offroad<span className="text-emerald-500">Deals</span>
            </h1>
            <p className="truncate text-xs text-neutral-500">
              {cards.length} shown · Toyota &amp; Subaru · 7 countries
              {lastScan[0] ? ` · scanned ${ago(lastScan[0].finished_at)}` : ""}
            </p>
          </div>
          <nav className="flex rounded-lg border border-neutral-800 bg-neutral-900/80 p-0.5 text-sm">
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

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
        <FilterForm>
          <input type="hidden" name="view" value={view} />
          <select name="sort" defaultValue={sort} className={field} aria-label="Sort">
            <option value="score">Best score</option>
            <option value="price">Cheapest</option>
            <option value="newest">Newest listed</option>
            <option value="mileage">Lowest km</option>
            <option value="power">Most power</option>
            <option value="year">Newest year</option>
          </select>
          <select name="model" defaultValue={model} className={`${field} max-w-44`} aria-label="Model">
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
          <select name="fuel" defaultValue={fuel} className={field} aria-label="Fuel">
            <option value="">Any fuel</option>
            {FUELS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select name="gearbox" defaultValue={gearbox} className={field} aria-label="Gearbox">
            <option value="">Any gearbox</option>
            {GEARBOXES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select name="country" defaultValue={country} className={field} aria-label="Country">
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="number" name="yearFrom" placeholder="year from" min={1960} max={2030}
            defaultValue={yearFrom ?? ""} className={`${field} w-24`}
          />
          <input
            type="number" name="yearTo" placeholder="year to" min={1960} max={2030}
            defaultValue={yearTo ?? ""} className={`${field} w-24`}
          />
          <input
            type="number" name="powerMin" placeholder="min kW" min={20} max={600}
            defaultValue={powerMin ?? ""} className={`${field} w-24`}
          />
          <select name="band" defaultValue={band} className={field} aria-label="Price band">
            <option value="budget">3.5k-13k landed</option>
            <option value="all">All prices</option>
          </select>
          <a
            href={`/?view=${view}`}
            className="shrink-0 self-center px-2 text-sm text-neutral-500 hover:text-neutral-300"
          >
            reset
          </a>
        </FilterForm>

        <ul className="mt-4 space-y-3">
          {cards.map((card) => (
            <ListingCard key={card.id} card={card} />
          ))}
        </ul>

        {cards.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-3xl">🏜️</p>
            <p className="text-sm font-medium text-neutral-300">Nothing matches these filters</p>
            <p className="text-xs text-neutral-500">
              Loosen a filter, or wait for the next hourly scan.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
