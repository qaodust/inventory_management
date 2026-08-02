import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.connectivityCheck.count();
    return Response.json({ ok: true });
  } catch {
    // Deliberately no error detail in the response — this route is
    // reachable pre-auth (Phase 1 hasn't landed yet), so it must not leak
    // connection info or stack traces, only whether the DB is reachable.
    return Response.json({ ok: false }, { status: 503 });
  }
}
