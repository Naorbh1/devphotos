import { prisma } from "@/lib/db";
import { HttpError, requireRole } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

export const PATCH = route(async (req: Request) => {
  await requireRole("ADMIN");
  const { id, status, ratePercent, signupBountyAgorot } = (await req.json()) as {
    id?: string;
    status?: "PENDING" | "ACTIVE" | "SUSPENDED";
    ratePercent?: number;
    signupBountyAgorot?: number;
  };
  if (!id) throw new HttpError(400, "חסר מזהה שותף");

  if (ratePercent !== undefined && (ratePercent < 0 || ratePercent > 100)) {
    throw new HttpError(400, "אחוז העמלה חייב להיות בין 0 ל-100");
  }
  if (signupBountyAgorot !== undefined && signupBountyAgorot < 0) {
    throw new HttpError(400, "בונוס ההרשמה לא יכול להיות שלילי");
  }

  await prisma.affiliate.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(ratePercent !== undefined ? { ratePercent: Math.round(ratePercent) } : {}),
      ...(signupBountyAgorot !== undefined
        ? { signupBountyAgorot: Math.round(signupBountyAgorot) }
        : {}),
    },
  });

  return ok({ ok: true });
});
