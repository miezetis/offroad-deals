import { fetchPage } from "../http";
import type { RawListing, Source } from "../types";

/**
 * otomoto.pl (Poland). Everything lives in the __NEXT_DATA__ blob as
 * structured GraphQL results: exact mileage, normalised fuel and gearbox.
 * The richest source of the whole set.
 */
const MODEL_PATHS = [
  "toyota/land-cruiser",
  "toyota/rav4",
  "toyota/4runner",
  "subaru/forester",
  "subaru/outback",
];

type OtomotoNode = {
  id: string;
  title: string;
  url: string;
  createdAt?: string;
  shortDescription?: string;
  location?: { city?: { name?: string }; region?: { name?: string } };
  price?: { amount?: { units?: number; currencyCode?: string } };
  parameters?: { key: string; value?: string; displayValue?: string }[];
  thumbnail?: { x1?: string };
};

export function extractEdges(html: string): OtomotoNode[] {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return [];

  const data = JSON.parse(m[1]);
  const urql = data?.props?.pageProps?.urqlState ?? {};
  for (const entry of Object.values(urql) as { data?: unknown }[]) {
    const d = typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data;
    const edges = (d as { advertSearch?: { edges?: { node: OtomotoNode }[] } })?.advertSearch
      ?.edges;
    if (edges?.length) return edges.map((e) => e.node);
  }
  return [];
}

export function toListing(node: OtomotoNode): RawListing | undefined {
  const units = node.price?.amount?.units;
  const currency = node.price?.amount?.currencyCode;
  if (!units || (currency !== "PLN" && currency !== "EUR")) return undefined;

  const param = (key: string) => node.parameters?.find((p) => p.key === key)?.value;

  return {
    sourceId: node.id,
    url: node.url,
    title: `${node.title} ${node.shortDescription ?? ""}`.trim().slice(0, 200),
    price: units,
    currency,
    year: param("year") ? parseInt(param("year")!, 10) : undefined,
    mileageKm: param("mileage") ? parseInt(param("mileage")!, 10) : undefined,
    fuel: param("fuel_type"),
    transmission: param("gearbox"),
    // engine_power is in KM (Polish horsepower), normalise to kW.
    powerKw: param("engine_power")
      ? Math.round(parseInt(param("engine_power")!, 10) * 0.7355)
      : undefined,
    location: [node.location?.city?.name, node.location?.region?.name]
      .filter(Boolean)
      .join(", "),
    imageUrl: node.thumbnail?.x1,
    snippet: node.shortDescription,
  };
}

export const otomoto: Source = {
  name: "otomoto",
  country: "PL",
  expectedMinimum: 50,
  async scan(maxPages) {
    const all: RawListing[] = [];
    const sort = "search%5Border%5D=created_at_first%3Adesc";
    for (const path of MODEL_PATHS) {
      for (let page = 1; page <= maxPages; page++) {
        try {
          const html = await fetchPage(
            `https://www.otomoto.pl/osobowe/${path}?${sort}&page=${page}`,
          );
          const nodes = extractEdges(html);
          for (const node of nodes) {
            const listing = toListing(node);
            if (listing) all.push(listing);
          }
          if (nodes.length < 30) break;
        } catch {
          break;
        }
      }
    }
    return all;
  },
};
