import "server-only";
import { prisma } from "./db";
import { publish } from "./events";

/** זוג משתמשים נשמר תמיד בסדר קבוע, כדי שהאילוץ הייחודי יתפוס את שני הכיוונים */
export function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function areBlocked(a: string, b: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return block !== null;
}

/**
 * רושם לייק. אם הצד השני כבר עשה לייק — נוצרת התאמה ושיחה,
 * ושני הצדדים מקבלים התראה.
 */
export async function like(fromUserId: string, toUserId: string) {
  const [userAId, userBId] = pair(fromUserId, toUserId);

  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId, isLike: true },
    update: { isLike: true },
  });

  const reciprocal = await prisma.like.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
    select: { isLike: true },
  });
  if (!reciprocal?.isLike) return { matched: false as const };

  const match = await prisma.match.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
  });

  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
  });

  publish([fromUserId], { type: "match", matchId: match.id, withUserId: toUserId });
  publish([toUserId], { type: "match", matchId: match.id, withUserId: fromUserId });

  return { matched: true as const, matchId: match.id, conversationId: conversation.id };
}

export async function pass(fromUserId: string, toUserId: string) {
  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId } },
    create: { fromUserId, toUserId, isLike: false },
    update: { isLike: false },
  });
}

/** מוודא שהמשתמש משתתף בשיחה, ומחזיר את מזהה הצד השני */
export async function otherParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userAId: true, userBId: true },
  });
  if (!conversation) return null;
  if (conversation.userAId === userId) return conversation.userBId;
  if (conversation.userBId === userId) return conversation.userAId;
  return null;
}
