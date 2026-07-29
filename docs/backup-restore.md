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

### Take a backup

```bash
npx tsx scripts/db-backup.ts
```

Writes every row from every table in the `public` schema to a
timestamped JSON file under `backups/` (gitignored — these contain
real business data, don't commit them). Copy that file somewhere safe
(not just this machine) after running it.

### Restore from a backup

```bash
npx tsx scripts/db-restore.ts backups/backup-<timestamp>.json
```

Re-inserts every row from the dump (`on conflict do nothing`, so it's
safe to run against a database that already has some matching rows).
Restoring into an empty database (e.g., a freshly provisioned Railway
Postgres instance after the old one was lost) is the primary disaster
scenario this covers.

### Tested restore procedure (verified 2026-07-29)

1. Seeded two rows into a table.
2. Ran `db-backup.ts` — produced a JSON dump.
3. Deleted all rows from the table (simulating data loss).
4. Ran `db-restore.ts` against that dump.
5. Confirmed the restored rows matched the originals exactly (same
   IDs, values, and timestamps).

This confirms the backup/restore round-trip works end-to-end against
the live Railway Postgres instance.

## Recommended cadence

Not yet automated. Before real business data accumulates (Phase 4+),
consider a scheduled job (e.g., a Railway cron service) that runs
`db-backup.ts` and uploads the result somewhere durable outside
Railway.
