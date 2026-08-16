import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fail, route } from "@/lib/api";
import { readImage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * מגיש תמונה מתוך תיקיית ההעלאות אחרי בדיקת הרשאה.
 * התמונות אינן נגישות ישירות מהדיסק — רק דרך הנתיב הזה.
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();
  if (!viewer) return fail(401, "נדרשת התחברות");

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      kind: true,
      status: true,
      storageKey: true,
      mime: true,
      user: { select: { status: true, profile: { select: { isVisible: true } } } },
    },
  });
  if (!photo) return fail(404, "התמונה לא נמצאה");

  const isOwner = photo.userId === viewer.id;
  const isStaff = viewer.role === "ADMIN" || viewer.role === "MODERATOR";
  let allowed = isOwner || isStaff;

  if (!allowed && photo.kind === "PROFILE") {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewer.id, blockedId: photo.userId },
          { blockerId: photo.userId, blockedId: viewer.id },
        ],
      },
      select: { id: true },
    });
    allowed =
      photo.status === "APPROVED" &&
      photo.user.status === "ACTIVE" &&
      photo.user.profile?.isVisible === true &&
      !blocked;
  }

  if (!allowed && photo.kind === "MESSAGE") {
    // רק משתתפי השיחה שבה נשלחה התמונה
    const message = await prisma.message.findFirst({
      where: {
        photoId: photo.id,
        deletedAt: null,
        conversation: { OR: [{ userAId: viewer.id }, { userBId: viewer.id }] },
      },
      select: { id: true },
    });
    allowed = message !== null;
  }

  if (!allowed) return fail(403, "אין הרשאה לצפות בתמונה");

  let data: Buffer;
  try {
    data = await readImage(photo.storageKey);
  } catch {
    return fail(404, "קובץ התמונה חסר");
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": photo.mime,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
});
