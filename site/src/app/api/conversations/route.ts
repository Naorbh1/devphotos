import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { areBlocked, pair } from "@/lib/matching";

export const runtime = "nodejs";

/** פותח (או מחזיר) שיחה מול משתמש שיש איתו התאמה */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId || userId === user.id) throw new HttpError(400, "בקשה לא תקינה");
  if (await areBlocked(user.id, userId)) throw new HttpError(403, "לא ניתן לפתוח שיחה עם המשתמש הזה");

  const [userAId, userBId] = pair(user.id, userId);

  const match = await prisma.match.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  });
  if (!match) throw new HttpError(403, "אפשר להתכתב רק אחרי התאמה הדדית");

  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
    select: { id: true },
  });

  return ok({ conversationId: conversation.id });
});
