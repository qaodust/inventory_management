import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await requireSession();
  return prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
}
