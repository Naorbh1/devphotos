import { prisma } from "@/lib/db";
import { HttpError, requireRole } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

export const PATCH = route(async (req: Request) => {
  const staff = await requireRole("ADMIN", "MODERATOR");
  const { id, status, resolution } = (await req.json()) as {
    id?: string;
    status?: "RESOLVED" | "DISMISSED";
    resolution?: string;
  };
  if (!id || (status !== "RESOLVED" && status !== "DISMISSED")) {
    throw new HttpError(400, "בקשה לא תקינה");
  }

  await prisma.report.update({
    where: { id },
    data: {
      status,
      handledById: staff.id,
      handledAt: new Date(),
      resolution: resolution || null,
    },
  });

  return ok({ ok: true });
});
