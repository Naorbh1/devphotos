import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { areBlocked, like, pass } from "@/lib/matching";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`like:${user.id}`, 300, 60 * 60 * 1000);

  const { userId, action } = (await req.json()) as { userId?: string; action?: string };
  if (!userId) throw new HttpError(400, "חסר מזהה משתמש");
  if (userId === user.id) throw new HttpError(400, "אי אפשר לסמן לייק לעצמך");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, profile: { select: { isVisible: true } } },
  });
  if (!target || target.status !== "ACTIVE" || !target.profile?.isVisible) {
    throw new HttpError(404, "הפרופיל לא נמצא");
  }
  if (await areBlocked(user.id, userId)) throw new HttpError(403, "לא ניתן ליצור קשר עם המשתמש הזה");

  if (action === "pass") {
    await pass(user.id, userId);
    return ok({ matched: false });
  }
  return ok(await like(user.id, userId));
});
