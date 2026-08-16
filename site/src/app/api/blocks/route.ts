import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId || userId === user.id) throw new HttpError(400, "בקשה לא תקינה");

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
    create: { blockerId: user.id, blockedId: userId },
    update: {},
  });

  return ok({ ok: true });
});

export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) throw new HttpError(400, "חסר מזהה משתמש");

  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
  return ok({ ok: true });
});
