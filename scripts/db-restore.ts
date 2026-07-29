import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/db-restore.ts <backup-file.json>");
  process.exit(1);
}

async function main() {
  const dump: Record<string, Record<string, unknown>[]> = JSON.parse(
    readFileSync(path, "utf-8")
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const [table, rows] of Object.entries(dump)) {
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const columnList = columns.map((c) => `"${c}"`).join(", ");
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `insert into "${table}" (${columnList}) values (${placeholders})
         on conflict do nothing`,
        values
      );
    }
    console.log(`Restored ${rows.length} row(s) into "${table}"`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
