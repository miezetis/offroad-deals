import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../lib/db";

async function main() {
  const sql = db();
  const schema = readFileSync(join(process.cwd(), "lib/schema.sql"), "utf8");

  // neon's http driver rejects multi-statement strings, so apply them one by one.
  const statements = schema
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
    console.log("ok:", statement.split("\n")[0].slice(0, 70));
  }

  console.log(`\napplied ${statements.length} statements`);
}

main();
