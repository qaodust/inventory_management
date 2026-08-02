import { afterAll, afterEach } from "vitest";
import { resetTestDb, testPrisma } from "./db";

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
