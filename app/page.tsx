import { db } from "@/lib/db";
import { clearFlag, hideListing, starListing } from "./actions";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  score: "e.score desc nulls last",
  price: "l.price_eur asc",
  newest: "l.first_seen desc",
  mileage: "l.mileage_km asc nulls last",
};

const COUNTRIES = ["EE", "LV", "LT", "FI", "PL", "SK", "DE"];

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
  first_price: string | null;
};

function eur(value: string | number | null | undefined) {
  if (value == null) return "?";
  return `${Math.round(Number(value)).toLocaleString("en-US").replace(/,/g, " ")} €`;
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-green-600";
  if (score >= 55) return "bg-yellow-600";
  return "bg-neutral-700";
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sort = SORTS[String(params.sort)] ? String(params.sort) : "score";
  const country = COUNTRIES.includes(String(params.country)) ? String(params.country) : "";
  const model = typeof params.model === "string" ? params.model : "";
  const band = params.band === "all" ? "all" : "budget";
  const view = params.view === "starred" ? "starred" : params.view === "hidden" ? "hidden" : "main";

  const sql = db();
  const where: string[] = ["l.is_active"];
  const args: unknown[] = [];

  if (view === "main") where.push("(f.flag is null or f.flag = 'starred')");
  if (view === "starred") where.push("f.flag = 'starred'");
  if (view === "hidden") where.push("f.flag = 'hidden'");
  if (band === "budget" && view === "main")
    where.push("coalesce(e.landed_cost_eur, l.price_eur) between 3500 and 13000");
  if (country) {
    args.push(country);
    where.push(`l.country = $${args.length}`);
  }
  if (model) {
    args.push(`%${model}%`);
    where.push(`(l.make || ' ' || l.model) ilike $${args.length}`);
  }

  const rows = (await sql.query(
    `select l.id, l.source, l.country, l.url, l.title, l.make, l.model, l.generation,
            l.year, l.mileage_km, l.fuel, l.transmission, l.price_eur, l.location,
            l.image_url, l.first_seen,
            e.score, e.ai_score, e.verdict, e.risks, e.inspect,
            e.market_median_eur, e.price_delta_pct, e.landed_cost_eur,
            f.flag,
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

  const dayAgo = Date.now() - 24 * 3600 * 1000;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Offroad Deals</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {rows.length} listings · EE LV LT FI PL SK DE · refreshed hourly
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          {(["main", "starred", "hidden"] as const).map((v) => (
            <a
              key={v}
              href={`/?view=${v}`}
              className={`rounded-md px-3 py-1.5 ${view === v ? "bg-neutral-100 text-neutral-900" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}
            >
              {v === "main" ? "Deals" : v === "starred" ? "Starred" : "Hidden"}
            </a>
          ))}
        </nav>
      </header>

      <form className="mt-4 flex flex-wrap items-center gap-2 text-sm" method="get">
        <input type="hidden" name="view" value={view} />
        <select name="sort" defaultValue={sort} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="score">Best score</option>
          <option value="price">Cheapest</option>
          <option value="newest">Newest</option>
          <option value="mileage">Lowest km</option>
        </select>
        <select name="country" defaultValue={country} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">All countries</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="model" defaultValue={model} className="max-w-48 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <select name="band" defaultValue={band} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="budget">Budget 3.5k-13k landed</option>
          <option value="all">All prices</option>
        </select>
        <button className="rounded-md bg-neutral-100 px-3 py-1.5 font-medium text-neutral-900 hover:bg-white">
          Apply
        </button>
      </form>

      <ul className="mt-6 space-y-3">
        {rows.map((r) => {
          const isNew = new Date(r.first_seen).getTime() > dayAgo;
          const dropped =
            r.first_price != null && Number(r.price_eur) < Number(r.first_price) - 1;
          return (
            <li key={r.id} className="flex gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-md bg-neutral-900 sm:block">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {r.score != null ? (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold text-white ${scoreColor(r.score)}`}>
                      {r.score}
                    </span>
                  ) : null}
                  {isNew ? (
                    <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white">new</span>
                  ) : null}
                  {dropped ? (
                    <span className="rounded bg-purple-600 px-1.5 py-0.5 text-xs font-medium text-white">
                      price drop {eur(r.first_price)} → {eur(r.price_eur)}
                    </span>
                  ) : null}
                  <a href={r.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
                    {r.title}
                  </a>
                </div>

                <p className="mt-1 text-sm text-neutral-400">
                  {r.make} {r.model}
                  {r.generation ? ` · ${r.generation}` : ""}
                  {r.year ? ` · ${r.year}` : ""}
                  {r.mileage_km ? ` · ${Math.round(r.mileage_km / 1000)} tkm` : ""}
                  {r.fuel ? ` · ${r.fuel}` : ""}
                  {r.transmission ? ` · ${r.transmission}` : ""}
                  {" · "}
                  {r.country}
                  {r.location ? ` (${r.location.slice(0, 30)})` : ""}
                  {" · "}
                  {r.source}
                </p>

                <p className="mt-1 text-sm">
                  <span className="text-lg font-semibold">{eur(r.price_eur)}</span>
                  {r.landed_cost_eur ? (
                    <span className="text-neutral-500"> · ~{eur(r.landed_cost_eur)} landed</span>
                  ) : null}
                  {r.market_median_eur && r.price_delta_pct ? (
                    <span className={Number(r.price_delta_pct) < 0 ? "text-green-500" : "text-neutral-500"}>
                      {" "}· {Math.round(Number(r.price_delta_pct))}% vs median {eur(r.market_median_eur)}
                    </span>
                  ) : null}
                </p>

                {r.verdict ? (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
                      AI verdict{r.ai_score != null ? ` (${r.ai_score}/100)` : ""}
                    </summary>
                    <div className="mt-2 space-y-2 rounded-md bg-neutral-900 p-3 text-neutral-300">
                      <p>{r.verdict}</p>
                      {r.risks?.length ? (
                        <p className="text-red-400">Risks: {r.risks.join(" · ")}</p>
                      ) : null}
                      {r.inspect?.length ? (
                        <p className="text-yellow-400">Inspect: {r.inspect.join(" · ")}</p>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                {r.flag ? (
                  <form action={clearFlag}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800" title="Restore">
                      undo
                    </button>
                  </form>
                ) : (
                  <>
                    <form action={starListing}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-yellow-500 hover:bg-neutral-800" title="Star">
                        ★
                      </button>
                    </form>
                    <form action={hideListing}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800" title="Hide">
                        ✕
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
          Nothing here. The next hourly scan may change that.
        </div>
      ) : null}
    </main>
  );
}
