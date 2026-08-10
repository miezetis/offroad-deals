/**
 * Locale-tolerant field parsers. European sites disagree about everything:
 * "5 490", "5.990", "5,990", "12 500 km", "125 tkm", "125 tūkst."
 */

/** "5 490 €", "5.990", "31 400 PLN" -> 5490, 5990, 31400 */
export function parsePrice(text: string): number | undefined {
  const cleaned = text
    .replace(/[^0-9.,\s]/g, "")
    .trim()
    // Thousands separators: spaces always, dot/comma only when followed by
    // exactly three digits (so "5.990" is 5990 but "0,28" stays fractional).
    .replace(/[\s ]/g, "")
    .replace(/[.,](?=\d{3}(\D|$))/g, "");
  const value = parseFloat(cleaned.replace(",", "."));
  if (!isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

/** "230 000 km", "230000", "230 tkm", "230 tūkst. km" -> km */
export function parseMileage(text: string): number | undefined {
  const t = text.toLowerCase().replace(/[\s ]/g, "");
  const m = t.match(/(\d[\d.,]*)(tkm|tūkst|tukst|tys|tis)?/);
  if (!m) return undefined;
  let value = parseFloat(m[1].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!isFinite(value) || value <= 0) return undefined;
  if (m[2]) value *= 1000;
  // Sites listing mileage in thousands without saying so: a 4x4 with "230"
  // on the clock is 230 thousand, not 230 km.
  if (value < 1000) value *= 1000;
  return Math.round(value);
}

/** First plausible model year anywhere in the text. */
export function parseYear(text: string): number | undefined {
  const m = text.match(/(?:^|\D)((?:19[6-9]|20[0-2])\d)(?:\D|$)/);
  if (!m) return undefined;
  const year = parseInt(m[1], 10);
  const max = new Date().getFullYear() + 1;
  return year >= 1960 && year <= max ? year : undefined;
}

const FUEL_PATTERNS: [RegExp, string][] = [
  [/dyzel|diesel|dīzel|dyzelis|diisel|td\b|tdi\b|dci\b|crdi\b|hdi\b/i, "diesel"],
  [/benzin|petrol|bensiin|bensiini|benzīns|gasoline/i, "petrol"],
  [/\blpg\b|dujos|gāze|gaas|autogas/i, "lpg"],
  [/hybrid|hibrid/i, "hybrid"],
  [/electric|elektri/i, "electric"],
];

export function parseFuel(text: string): string | undefined {
  for (const [re, fuel] of FUEL_PATTERNS) if (re.test(text)) return fuel;
  return undefined;
}

const TRANSMISSION_PATTERNS: [RegExp, string][] = [
  [/automat|automaat|automāt|autom\.|\bat\b|tiptronic/i, "automatic"],
  [/mechanin|manual|manuaal|mehān|mechanicz|schaltgetriebe|käsivaihteinen|man\./i, "manual"],
];

export function parseTransmission(text: string): string | undefined {
  for (const [re, t] of TRANSMISSION_PATTERNS) if (re.test(text)) return t;
  return undefined;
}
