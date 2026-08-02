# Database backup & restore (disaster recovery only)

Per [`planning-decisions.md`](../planning-decisions.md), this is a
disaster-recovery mechanism only — there is no user-facing "export my
data" feature. This exists so the owners don't lose the business's
inventory/sales data to an accident or a Railway outage.

## Railway's own backups

Railway offers dashboard-based Postgres backups (snapshot-based,
restorable from the Postgres service's **Backups** tab), but
availability depends on plan tier and wasn't confirmed as part of this
setup — check the dashboard directly for the current plan's backup
retention/restore options.

## Portable backup/restore scripts (verified, plan-independent)

Because the dashboard feature's availability is uncertain, this repo
also has two small scripts (`scripts/db-backup.ts`,
`scripts/db-restore.ts`) that back up and restore every table via
plain SQL over the `pg` driver — no Postgres CLI tools (`pg_dump`)
required, no dependency on Railway's plan.

These scripts only ever handle **data**. Schema (tables, columns,
constraints, indexes) is not part of the backup file — it already
lives in git as `prisma/schema.prisma` plus the committed migration
history under `prisma/migrations/`, and is reproduced on a target
database with `npx prisma migrate deploy`. Restoring into a fresh
database is always a two-step process: recreate the schema, then
restore the data.

### Take a backup

```bash
npx tsx scripts/db-backup.ts
```

Reads every table in the `public` schema inside a single
`REPEATABLE READ, READ ONLY` transaction — so the dump is one
consistent point-in-time snapshot, not a set of independently-read
tables that could drift relative to each other under concurrent
writes — and writes the result to a timestamped JSON file under
`backups/` (gitignored — these contain real business data, don't
commit them). Copy that file somewhere safe (not just this machine)
after running it.

### Restore from a backup

```bash
# 1. Recreate the schema on the target database (fresh Railway Postgres,
#    or any database that doesn't already have these tables). This
#    replays the committed migration history in prisma/migrations/,
#    unlike `db push` which only ever applies the current schema.prisma
#    with no history:
npx prisma migrate deploy

# 2. Restore the data:
npx tsx scripts/db-restore.ts backups/backup-<timestamp>.json
```

The restore script:

- Reads the target database's actual foreign-key constraints and
  inserts tables in dependency order (parents before children), so it
  is safe against relational schemas — not just the trivial Phase 0
  table. A genuine circular FK dependency between two tables is
  detected and reported explicitly rather than attempted; a
  self-referential FK within a single table (e.g. a manager-employee
  column pointing at the same table) is a known limitation — table
  order is fine, but row insertion order within that one table isn't
  guaranteed.
- Runs the entire restore as one transaction. If any row fails to
  insert (including a primary-key conflict on a target table that
  isn't actually empty), the whole restore rolls back atomically and
  the script exits non-zero — it never reports success after a
  partial restore, and it never silently drops conflicting rows.
  Because of this, restoring into a database that already has
  overlapping rows will fail loudly by design; the supported scenario
  is restoring into a freshly-schema'd, empty database.
- Resyncs any `serial`/`identity` sequences after a successful
  restore. This is a no-op today since the current schema uses
  `cuid()` ids (no sequences), but it means the script won't need
  revisiting once a future schema introduces auto-incrementing keys.

### Tested restore procedure (verified 2026-08-02)

Verified against the live Railway Postgres instance, using a
relational schema (not just the trivial `ConnectivityCheck` table):

1. Created two temporary tables outside the committed Prisma schema —
   `_drill_parent` and `_drill_child`, with `_drill_child` having a
   `references` foreign key back to `_drill_parent` — and seeded 2
   parent rows and 3 child rows.
2. Ran `db-backup.ts` — produced a JSON dump containing
   `_drill_parent`, `_drill_child`, and the existing
   `ConnectivityCheck` table, backed up as one consistent snapshot.
3. Ran `TRUNCATE ... CASCADE` on all three tables (simulating total
   data loss).
4. Ran `db-restore.ts` against that dump.
5. Confirmed:
   - `_drill_parent` was inserted before `_drill_child` (dependency
     order derived from the live FK constraint, not source-file
     order).
   - Every restored child row's `parent_id` pointed at a row that
     existed in `_drill_parent` at insert time — the foreign key was
     never violated during the restore.
   - All three tables' restored contents matched the pre-truncate data
     exactly (byte-for-byte row comparison).
6. Dropped the two temporary tables, leaving the schema as it was
   before the drill.

This confirms the backup/restore round-trip works end-to-end against
the live Railway Postgres instance, including a real foreign-key
relationship and an atomic, dependency-ordered restore — not just the
single trivial table used in the original Phase 0 verification.

**Note:** this drill was run when step 1 of the restore procedure was
still `npx prisma db push` (pre-Phase-0.5). The schema-recreation
mechanism has since changed to `npx prisma migrate deploy`
(versioned migrations, see `prisma/migrations/`); the data-restore
half of the drill (steps 2-6 above) is unaffected, but the drill
hasn't been re-run against the new schema-recreation step and should
be before relying on it in a real disaster.

## Recommended cadence

Not yet automated. Before real business data accumulates (Phase 4+),
consider a scheduled job (e.g., a Railway cron service) that runs
`db-backup.ts` and uploads the result somewhere durable outside
Railway.

## Known limitations

- Data-only: schema must be recreated separately via
  `npx prisma migrate deploy` before restoring data (see above).
- Row order within a single self-referential table isn't guaranteed
  during restore.
- A genuine circular foreign-key dependency across two or more tables
  is rejected with an explicit error rather than handled automatically
  — none exist in the current schema.
- This is not a substitute for point-in-time recovery. For that,
  rely on Railway's own Postgres backups if available on the current
  plan.
