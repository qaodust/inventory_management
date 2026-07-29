import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: tables } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`
  );

  const dump: Record<string, unknown[]> = {};
  for (const { table_name } of tables) {
    const { rows } = await client.query(`select * from "${table_name}"`);
    dump[table_name] = rows;
  }

  await client.end();

  mkdirSync("backups", { recursive: true });
  const path = `backups/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(dump, null, 2));
  console.log(`Backed up ${tables.length} table(s) to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
