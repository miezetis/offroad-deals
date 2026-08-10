/**
 * Polite fetch: browser-shaped headers, one request at a time per host with a
 * randomised gap, bounded retries. Keeps us a well-behaved periodic visitor
 * rather than something worth blocking.
 */

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.6,pl;q=0.5",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1",
};

const MIN_GAP_MS = 1200;
const MAX_JITTER_MS = 1300;

const lastHitPerHost = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeDelay(host: string) {
  const last = lastHitPerHost.get(host) ?? 0;
  const gap = MIN_GAP_MS + Math.random() * MAX_JITTER_MS;
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  lastHitPerHost.set(host, Date.now());
}

export class FetchBlockedError extends Error {
  constructor(url: string, public status: number) {
    super(`blocked (${status}): ${url}`);
  }
}

/** GET a page as text, retrying transient failures, throwing on blocks. */
export async function fetchPage(url: string, tries = 3): Promise<string> {
  const host = new URL(url).host;

  for (let attempt = 1; ; attempt++) {
    await politeDelay(host);
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 403 || res.status === 429) {
        throw new FetchBlockedError(url, res.status);
      }
      if (!res.ok) throw new Error(`http ${res.status}: ${url}`);

      const body = await res.text();
      if (/just a moment|px-captcha|cf-browser-verification/i.test(body.slice(0, 5000))) {
        throw new FetchBlockedError(url, res.status);
      }
      return body;
    } catch (err) {
      // Blocks will not fix themselves mid-run; bail immediately so the
      // source gets flagged instead of burning retries.
      if (err instanceof FetchBlockedError || attempt >= tries) throw err;
      await sleep(2000 * attempt);
    }
  }
}
