import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, HttpError, verifyPassword } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const input = loginSchema.parse(await req.json());
  rateLimit(`login:${ip}:${input.email}`, 10, 15 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, status: true, statusReason: true },
  });

  // אותה הודעה לשני המקרים — כדי לא לחשוף אילו כתובות רשומות
  const generic = "אימייל או סיסמה שגויים";
  if (!user) throw new HttpError(401, generic);
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, generic);
  }
  if (user.status === "BANNED" || user.status === "DELETED") {
    throw new HttpError(403, user.statusReason || "החשבון נחסם");
  }
  if (user.status === "SUSPENDED") {
    throw new HttpError(403, user.statusReason || "החשבון מושעה זמנית");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  await createSession(user.id);
  return ok({ id: user.id });
});
