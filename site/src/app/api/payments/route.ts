import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { commissionForPayment } from "@/lib/affiliate";
import { PLANS } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * תשלום מדומה. אין כאן חיוב אמיתי — המטרה היא להריץ מקצה לקצה את
 * שרשרת העמלות של תוכנית השותפים. לחיבור סליקה אמיתית ראה README.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { plan } = (await req.json()) as { plan?: string };
  const chosen = PLANS.find((p) => p.id === plan);
  if (!chosen) throw new HttpError(400, "מסלול לא קיים");

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      plan: chosen.id,
      amountAgorot: chosen.amountAgorot,
      provider: "mock",
      status: "PAID",
    },
    select: { id: true, amountAgorot: true },
  });

  await commissionForPayment(payment.id);
  return ok({ paymentId: payment.id, amountAgorot: payment.amountAgorot }, { status: 201 });
});
