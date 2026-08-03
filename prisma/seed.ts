import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureOwner(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Skipping ${email} — account already exists.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, passwordHash, name } });
  console.log(`Created account for ${email}.`);
}

async function main() {
  await ensureOwner(
    requireEnv("OWNER1_EMAIL"),
    requireEnv("OWNER1_PASSWORD"),
    "Owner 1"
  );
  await ensureOwner(
    requireEnv("OWNER2_EMAIL"),
    requireEnv("OWNER2_PASSWORD"),
    "Owner 2"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
