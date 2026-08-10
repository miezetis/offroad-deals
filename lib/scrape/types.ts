/** What every site adapter must return. One record per ad on a search page. */
export type RawListing = {
  /** Stable per-site ad id, e.g. the numeric id from the URL. */
  sourceId: string;
  url: string;
  title: string;
  /** Price in the currency the site displays. */
  price: number;
  currency: "EUR" | "PLN";
  year?: number;
  mileageKm?: number;
  fuel?: string;
  transmission?: string;
  /** Engine power in kW, normalised from whatever unit the site used. */
  powerKw?: number;
  location?: string;
  /**
   * Overrides the source's default country for this one row. Marktplaats.nl
   * carries the occasional cross-border ad (a Dutch exporter's stock parked
   * abroad); when the listing states a different country, that wins.
   */
  country?: string;
  imageUrl?: string;
  /** Short teaser text when the search page carries one. */
  snippet?: string;
};

export type Source = {
  /** Short slug used as the id prefix, e.g. "sslv". */
  name: string;
  country: string;
  /**
   * When present and false, the source is skipped entirely rather than
   * counted as broken. Used by the Bright Data sources when no key is set.
   */
  enabled?: () => boolean;
  /**
   * Fetch one round of search pages and return everything found.
   * Adapters do their own pagination internally, bounded by `maxPages`.
   */
  scan(maxPages: number): Promise<RawListing[]>;
  /**
   * Fewer rows than this in a healthy run means the parser broke or the site
   * changed. Triggers a health alert, not a hard failure.
   */
  expectedMinimum: number;
};
