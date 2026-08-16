import { prisma } from "@/lib/db";
import { HttpError, requireRole } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

const NEXT_TIMESTAMP: Record<string, "approvedAt" | "paidAt" | null> = {
  APPROVED: "approvedAt",
  PAID: "paidAt",
  REVERSED: null,
};

export const PATCH = route(async (req: Request) => {
  await requireRole("ADMIN");
  const { ids, status } = (await req.json()) as { ids?: string[]; status?: string };
  if (!ids?.length || !status || !(status in NEXT_TIMESTAMP)) {
    throw new HttpError(400, "בקשה לא תקינה");
  }

  const field = NEXT_TIMESTAMP[status];
  await prisma.commission.updateMany({
    where: { id: { in: ids } },
    data: {
      status: status as "APPROVED" | "PAID" | "REVERSED",
      ...(field ? { [field]: new Date() } : {}),
    },
  });

  return ok({ updated: ids.length });
});
