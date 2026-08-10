/**
 * Bright Data Web Unlocker for the sites that block plain fetches, which is
 * every Lithuanian and Estonian source plus mobile.de. Costs money per
 * request, so callers are expected to stay shallow and let the health
 * monitor complain when something breaks.
 */

const API = "https://api.brightdata.com/request";

export function brightdataAvailable() {
  return Boolean(process.env.BRIGHTDATA_API_KEY);
}

export async function fetchViaBrightdata(url: string): Promise<string> {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("BRIGHTDATA_API_KEY not set");

  const res = await fetch(API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      zone: process.env.BRIGHTDATA_ZONE ?? "web_unlocker1",
      url,
      format: "raw",
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    throw new Error(`brightdata ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.text();
}
