/**
 * Fetch one URL through Bright Data and save the HTML to disk. Run via the
 * `inspect` workflow, which uploads the file as an artifact. This is how
 * parsers for blocked sites get written against real markup without the
 * API key ever leaving CI.
 */
import { writeFileSync } from "node:fs";
import { fetchViaBrightdata } from "../lib/scrape/brightdata";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: tsx scripts/inspect-page.ts <url>");
    process.exit(1);
  }

  const html = await fetchViaBrightdata(url);
  writeFileSync("inspected.html", html);
  console.log(`saved ${html.length} bytes from ${url}`);
}

main().catch((err) => {
  console.error("fetch failed:", err.message);
  process.exit(1);
});
