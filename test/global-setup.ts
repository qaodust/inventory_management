import "dotenv/config";
import { execSync } from "node:child_process";
import { Client } from "pg";

export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.example's TEST_DATABASE_URL " +
        "line into .env and point it at a ?schema=test on your dev database."
    );
  }
  if (testUrl === appUrl) {
    throw new Error(
      "TEST_DATABASE_URL must not be identical to DATABASE_URL — refusing " +
        "to run tests against real business data."
    );
  }

  const url = new URL(testUrl);
  const schema = url.searchParams.get("schema");
  if (!schema) {
    throw new Error("TEST_DATABASE_URL must include a ?schema= query param.");
  }

  // Ensure the schema namespace exists before `prisma migrate deploy`
  // tries to create tables inside it.
  const bareUrl = new URL(testUrl);
  bareUrl.searchParams.delete("schema");
  const client = new Client({ connectionString: bareUrl.toString() });
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await client.end();

  // Replay the same committed migration history into the test schema.
  // Prisma's CLI (unlike @prisma/adapter-pg at runtime) natively
  // understands the ?schema= query param.
  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
}
