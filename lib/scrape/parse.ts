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

/**
 * Engine power, always normalised to kW.
 *
 * The trap: in Polish ads "KM" is horsepower (konie mechaniczne) while "km"
 * is mileage, so the horsepower branch is deliberately case-sensitive and kW
 * is matched first.
 */
export function parsePower(text: string): number | undefined {
  const kw = text.match(/(\d{2,4})[\s.]*kw\b/i);
  if (kw) {
    const value = parseInt(kw[1], 10);
    if (value >= 20 && value <= 600) return value;
  }

  const hp = text.match(/(\d{2,4})\s*(?:KM|PS|ps\b|[Hh][Pp]|[Cc][Vv]|[Kk][Ss])\b/);
  if (hp) {
    const value = Math.round(parseInt(hp[1], 10) * 0.7355);
    if (value >= 20 && value <= 600) return value;
  }
  return undefined;
}

// LPG is checked before petrol on purpose: a "benzinas / dujos" car is a
// converted one, and that is the more useful fact about it.
const FUEL_PATTERNS: [RegExp, string][] = [
  [/dyzel|diesel|dīzel|dyzelis|diisel|dízel|nafta|\btd\b|\btdi\b|\bdci\b|\bcrdi\b|\bhdi\b|d4d|\bdid\b/i, "diesel"],
  [/\blpg\b|dujos|gāze|gaze|gaas|autogas|benzin\s*\/\s*duj|benzin\s*\/\s*gaz/i, "lpg"],
  [/benzin|petrol|bensiin|bensiini|benzīns|benzyna|gasoline/i, "petrol"],
  [/hybrid|hibrid|hybridi/i, "hybrid"],
  [/electric|elektri|elektro/i, "electric"],
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
