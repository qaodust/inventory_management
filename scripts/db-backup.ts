import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // A single REPEATABLE READ, READ ONLY transaction gives every table read
  // in this backup the same consistent point-in-time snapshot, instead of
  // each table being read independently against a moving target.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");

  let tableNames: string[];
  const dump: Record<string, unknown[]> = {};
  try {
    const { rows: tables } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`
    );
    tableNames = tables.map((t) => t.table_name);

    for (const table of tableNames) {
      const { rows } = await client.query(`select * from "${table}"`);
      dump[table] = rows;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      tables: tableNames,
    },
    ...dump,
  };

  mkdirSync("backups", { recursive: true });
  const path = `backups/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(path, JSON.stringify(output, null, 2));
  console.log(
    `Backed up ${tableNames.length} table(s) to ${path} (consistent snapshot)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
