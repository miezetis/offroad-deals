/**
 * EUR conversion. Only Poland prices in a non-euro currency, so this is a
 * single daily rate with a stale-tolerant fallback: a day-old rate is fine for
 * deal hunting, a dead run because an FX API hiccuped is not.
 */

const FALLBACK_PLN_PER_EUR = 4.3;

let cached: { rate: number; fetchedAt: number } | undefined;

/** PLN amount -> EUR, using ECB reference rates via frankfurter.app. */
export async function plnToEur(amount: number): Promise<number> {
  if (!cached || Date.now() - cached.fetchedAt > 12 * 3600 * 1000) {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=PLN", {
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json()) as { rates?: { PLN?: number } };
      if (data.rates?.PLN) cached = { rate: data.rates.PLN, fetchedAt: Date.now() };
    } catch {
      // keep whatever we had
    }
  }
  return Math.round(amount / (cached?.rate ?? FALLBACK_PLN_PER_EUR));
}
