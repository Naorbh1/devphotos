import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { affiliateApplySchema } from "@/lib/validation";

export const runtime = "nodejs";

const RESERVED_CODES = ["admin", "api", "login", "register", "search", "me", "messages", "affiliate"];

/** הצטרפות לתוכנית השותפים. הבקשה ממתינה לאישור מנהל. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = affiliateApplySchema.parse(await req.json());

  if (RESERVED_CODES.includes(input.code)) throw new HttpError(400, "הקוד הזה שמור, בחרו אחר");

  const existing = await prisma.affiliate.findUnique({ where: { userId: user.id } });
  if (existing) throw new HttpError(409, "כבר קיימת בקשה או חשבון שותף");

  const taken = await prisma.affiliate.findUnique({ where: { code: input.code } });
  if (taken) throw new HttpError(409, "הקוד הזה כבר תפוס");

  const affiliate = await prisma.affiliate.create({
    data: { userId: user.id, code: input.code, payoutNotes: input.payoutNotes },
    select: { id: true, code: true, status: true },
  });

  return ok(affiliate, { status: 201 });
});
