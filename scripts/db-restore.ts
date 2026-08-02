import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/db-restore.ts <backup-file.json>");
  console.error(
    "Before restoring, recreate the schema on the target database with: npx prisma db push"
  );
  process.exit(1);
}

type Dump = Record<string, Record<string, unknown>[]> & {
  _meta?: { generatedAt: string; tables: string[] };
};

/** Kahn's algorithm: returns tables ordered so every parent precedes its children. */
function topologicalOrder(
  tables: string[],
  edges: { parent: string; child: string }[]
): string[] {
  const inDegree = new Map(tables.map((t) => [t, 0]));
  const children = new Map<string, string[]>(tables.map((t) => [t, []]));

  for (const { parent, child } of edges) {
    if (parent === child) continue; // self-referential FK: not a table-ordering concern
    if (!inDegree.has(parent) || !inDegree.has(child)) continue;
    children.get(parent)!.push(child);
    inDegree.set(child, inDegree.get(child)! + 1);
  }

  const queue = tables.filter((t) => inDegree.get(t) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const table = queue.shift()!;
    order.push(table);
    for (const child of children.get(table) ?? []) {
      inDegree.set(child, inDegree.get(child)! - 1);
      if (inDegree.get(child) === 0) queue.push(child);
    }
  }

  if (order.length < tables.length) {
    const stuck = tables.filter((t) => !order.includes(t));
    throw new Error(
      `Circular foreign-key dependency among table(s): ${stuck.join(", ")}. ` +
        "Restore requires manual intervention (e.g. deferring constraints by hand)."
    );
  }

  return order;
}

async function main() {
  const dump: Dump = JSON.parse(readFileSync(path, "utf-8"));
  const tableNames = Object.keys(dump).filter((k) => k !== "_meta");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: fkEdges } = await client.query<{
      child: string;
      parent: string;
    }>(
      `select cl_child.relname as child, cl_parent.relname as parent
       from pg_constraint con
       join pg_class cl_child on cl_child.oid = con.conrelid
       join pg_class cl_parent on cl_parent.oid = con.confrelid
       join pg_namespace ns on ns.oid = cl_child.relnamespace
       where con.contype = 'f' and ns.nspname = 'public'`
    );

    const order = topologicalOrder(
      tableNames,
      fkEdges.map((e) => ({ parent: e.parent, child: e.child }))
    );

    await client.query("BEGIN");

    for (const table of order) {
      const rows = dump[table];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(", ");
      for (const row of rows) {
        const values = columns.map((c) => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `insert into "${table}" (${columnList}) values (${placeholders})`,
          values
        );
      }
      console.log(`Restored ${rows.length} row(s) into "${table}"`);
    }

    // Resync any serial/identity sequences so future inserts don't collide
    // with the restored rows (no-op for tables using default-generated ids
    // like cuid(), which is what this schema currently uses).
    for (const table of order) {
      const { rows: serialColumns } = await client.query<{
        column_name: string;
      }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and column_default like 'nextval(%'`,
        [table]
      );
      for (const { column_name } of serialColumns) {
        await client.query(
          `select setval(
             pg_get_serial_sequence('"${table}"', '${column_name}'),
             coalesce((select max("${column_name}") from "${table}"), 1),
             true
           )`
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `Restore complete: ${order.length} table(s) processed in dependency order.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(
      "Restore failed and was rolled back atomically — no partial data was written."
    );
    console.error(
      "If this is a 'relation does not exist' error, run `npx prisma db push` " +
        "against the target database first to recreate the schema."
    );
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
