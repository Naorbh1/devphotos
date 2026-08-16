import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { reportSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`report:${user.id}`, 20, 60 * 60 * 1000);

  const input = reportSchema.parse(await req.json());
  if (input.reportedUserId === user.id) throw new HttpError(400, "אי אפשר לדווח על עצמך");

  const target = await prisma.user.findUnique({
    where: { id: input.reportedUserId },
    select: { id: true },
  });
  if (!target) throw new HttpError(404, "המשתמש לא נמצא");

  await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: input.reportedUserId,
      reason: input.reason,
      details: input.details,
      messageId: input.messageId ?? null,
      photoId: input.photoId ?? null,
    },
  });

  return ok({ ok: true }, { status: 201 });
});
