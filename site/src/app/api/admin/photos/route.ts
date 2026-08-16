import { prisma } from "@/lib/db";
import { HttpError, requireRole } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { deleteImage } from "@/lib/storage";

export const runtime = "nodejs";

/** אישור / דחיית תמונת פרופיל בתור המודרציה */
export const PATCH = route(async (req: Request) => {
  const staff = await requireRole("ADMIN", "MODERATOR");
  const { id, action, reason } = (await req.json()) as {
    id?: string;
    action?: "approve" | "reject" | "delete";
    reason?: string;
  };
  if (!id || !action) throw new HttpError(400, "בקשה לא תקינה");

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { id: true, userId: true, storageKey: true, kind: true },
  });
  if (!photo) throw new HttpError(404, "התמונה לא נמצאה");

  if (action === "delete") {
    await prisma.photo.delete({ where: { id: photo.id } });
    await deleteImage(photo.storageKey);
    return ok({ ok: true });
  }

  const approved = action === "approve";
  await prisma.photo.update({
    where: { id: photo.id },
    data: {
      status: approved ? "APPROVED" : "REJECTED",
      moderatedById: staff.id,
      moderatedAt: new Date(),
      rejectionReason: approved ? null : reason || "התמונה אינה עומדת בכללי האתר",
    },
  });

  // אם אין עדיין תמונה ראשית — התמונה שאושרה הופכת לראשית
  if (approved && photo.kind === "PROFILE") {
    const hasPrimary = await prisma.photo.findFirst({
      where: { userId: photo.userId, kind: "PROFILE", isPrimary: true, status: "APPROVED" },
      select: { id: true },
    });
    if (!hasPrimary) {
      await prisma.photo.updateMany({
        where: { userId: photo.userId, kind: "PROFILE" },
        data: { isPrimary: false },
      });
      await prisma.photo.update({ where: { id: photo.id }, data: { isPrimary: true } });
    }
  }

  return ok({ ok: true });
});
