import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { deleteImage, storeImage } from "@/lib/storage";
import { MAX_PROFILE_PHOTOS } from "@/lib/constants";

export const runtime = "nodejs";

/** העלאת תמונה. kind=PROFILE נכנסת לתור אישור; kind=MESSAGE נשלחת בצ'אט. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`upload:${user.id}`, 30, 60 * 60 * 1000);

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "MESSAGE" ? "MESSAGE" : "PROFILE";
  if (!(file instanceof File)) throw new HttpError(400, "לא צורף קובץ");

  if (kind === "PROFILE") {
    const count = await prisma.photo.count({ where: { userId: user.id, kind: "PROFILE" } });
    if (count >= MAX_PROFILE_PHOTOS) {
      throw new HttpError(400, `אפשר להעלות עד ${MAX_PROFILE_PHOTOS} תמונות פרופיל`);
    }
  }

  const stored = await storeImage(file, kind === "MESSAGE" ? 1280 : 1600);

  const isFirstProfilePhoto =
    kind === "PROFILE" &&
    (await prisma.photo.count({ where: { userId: user.id, kind: "PROFILE" } })) === 0;

  const photo = await prisma.photo.create({
    data: {
      userId: user.id,
      kind,
      ...stored,
      isPrimary: isFirstProfilePhoto,
      // תמונות בצ'אט מוצגות מיד למשתתפים, אך נסקרות בפאנל הניהול לפי דיווח
      status: kind === "MESSAGE" ? "APPROVED" : "PENDING",
    },
    select: { id: true, status: true, isPrimary: true, width: true, height: true },
  });

  return ok(photo, { status: 201 });
});

/** מחיקת תמונת פרופיל של המשתמש */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "חסר מזהה תמונה");

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { id: true, userId: true, storageKey: true, isPrimary: true, kind: true },
  });
  // תמונה שכבר נשלחה בצ'אט לא נמחקת כאן — היא חלק מהיסטוריית השיחה של שני הצדדים
  if (!photo || photo.userId !== user.id || photo.kind !== "PROFILE") {
    throw new HttpError(404, "התמונה לא נמצאה");
  }

  await prisma.photo.delete({ where: { id: photo.id } });
  await deleteImage(photo.storageKey);

  if (photo.isPrimary) {
    const next = await prisma.photo.findFirst({
      where: { userId: user.id, kind: "PROFILE" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  return ok({ ok: true });
});

/** קביעת תמונה ראשית */
export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const { id } = (await req.json()) as { id?: string };
  if (!id) throw new HttpError(400, "חסר מזהה תמונה");

  const photo = await prisma.photo.findUnique({
    where: { id },
    select: { id: true, userId: true, kind: true, status: true },
  });
  if (!photo || photo.userId !== user.id || photo.kind !== "PROFILE") {
    throw new HttpError(404, "התמונה לא נמצאה");
  }
  if (photo.status !== "APPROVED") {
    throw new HttpError(400, "אפשר לקבוע כתמונה ראשית רק תמונה שאושרה");
  }

  await prisma.$transaction([
    prisma.photo.updateMany({
      where: { userId: user.id, kind: "PROFILE" },
      data: { isPrimary: false },
    }),
    prisma.photo.update({ where: { id: photo.id }, data: { isPrimary: true } }),
  ]);

  return ok({ ok: true });
});
