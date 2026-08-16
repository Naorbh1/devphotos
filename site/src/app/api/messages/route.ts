import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { messageSchema } from "@/lib/validation";
import { areBlocked, otherParticipant } from "@/lib/matching";
import { publish } from "@/lib/events";

export const runtime = "nodejs";

/** היסטוריית שיחה. `after` מאפשר משיכת הודעות חדשות בלבד. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) throw new HttpError(400, "חסר מזהה שיחה");

  const other = await otherParticipant(conversationId, user.id);
  if (!other) throw new HttpError(404, "השיחה לא נמצאה");

  const after = url.searchParams.get("after");
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      senderId: true,
      type: true,
      body: true,
      photoId: true,
      createdAt: true,
      readAt: true,
    },
  });

  return ok({ messages });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`msg:${user.id}`, 120, 60 * 1000);

  const input = messageSchema.parse(await req.json());
  const other = await otherParticipant(input.conversationId, user.id);
  if (!other) throw new HttpError(404, "השיחה לא נמצאה");
  if (await areBlocked(user.id, other)) throw new HttpError(403, "לא ניתן לשלוח הודעות בשיחה הזו");

  const recipient = await prisma.user.findUnique({
    where: { id: other },
    select: { status: true },
  });
  if (!recipient || recipient.status !== "ACTIVE") {
    throw new HttpError(403, "המשתמש אינו פעיל");
  }

  // תמונה נשלחת רק אם היא של השולח ולא שויכה כבר להודעה אחרת
  if (input.photoId) {
    const photo = await prisma.photo.findUnique({
      where: { id: input.photoId },
      select: { userId: true, kind: true, messages: { select: { id: true }, take: 1 } },
    });
    if (!photo || photo.userId !== user.id || photo.kind !== "MESSAGE" || photo.messages.length) {
      throw new HttpError(400, "התמונה אינה זמינה לשליחה");
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: user.id,
      type: input.photoId ? "IMAGE" : "TEXT",
      body: input.body?.trim() || null,
      photoId: input.photoId ?? null,
    },
    select: {
      id: true,
      senderId: true,
      type: true,
      body: true,
      photoId: true,
      createdAt: true,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  publish([user.id, other], {
    type: "message",
    conversationId: input.conversationId,
    message: { ...message, createdAt: message.createdAt.toISOString() },
  });

  return ok({ message }, { status: 201 });
});

/** סימון הודעות הצד השני כנקראו */
export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const { conversationId } = (await req.json()) as { conversationId?: string };
  if (!conversationId) throw new HttpError(400, "חסר מזהה שיחה");

  const other = await otherParticipant(conversationId, user.id);
  if (!other) throw new HttpError(404, "השיחה לא נמצאה");

  const now = new Date();
  const { count } = await prisma.message.updateMany({
    where: { conversationId, senderId: other, readAt: null },
    data: { readAt: now },
  });

  if (count > 0) {
    publish([other], {
      type: "read",
      conversationId,
      readerId: user.id,
      at: now.toISOString(),
    });
  }

  return ok({ updated: count });
});
