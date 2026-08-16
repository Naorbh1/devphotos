import { prisma } from "@/lib/db";
import { HttpError, requireRole } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

export const PATCH = route(async (req: Request) => {
  const staff = await requireRole("ADMIN", "MODERATOR");
  const { id, status, reason } = (await req.json()) as {
    id?: string;
    status?: "ACTIVE" | "SUSPENDED" | "BANNED";
    reason?: string;
  };
  if (!id || !status) throw new HttpError(400, "בקשה לא תקינה");
  if (id === staff.id) throw new HttpError(400, "אי אפשר לשנות את הסטטוס של עצמך");

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new HttpError(404, "המשתמש לא נמצא");
  if (target.role !== "USER" && staff.role !== "ADMIN") {
    throw new HttpError(403, "רק מנהל ראשי יכול לשנות סטטוס של צוות");
  }

  await prisma.user.update({
    where: { id },
    data: { status, statusReason: status === "ACTIVE" ? null : reason || null },
  });

  // אין צורך לגעת ב-isVisible: החיפוש והפרופיל הציבורי מסננים לפי סטטוס החשבון,
  // וכך העדפת הנראות של המשתמש נשמרת כשמחזירים לו גישה.
  return ok({ ok: true });
});
