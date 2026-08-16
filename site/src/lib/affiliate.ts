import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";

/** גיבוב כתובת IP — מאפשר ספירת קליקים ייחודיים בלי לשמור IP גולמי */
export function hashIp(ip: string): string {
  const salt = process.env.AUTH_SECRET || "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** רושם קליק על קישור שותף ומחזיר את מזהה הקליק לשמירה בעוגייה */
export async function recordClick(opts: {
  code: string;
  ip: string;
  userAgent: string;
  landingPath: string;
}): Promise<string | null> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: opts.code.toLowerCase() },
    select: { id: true, status: true },
  });
  if (!affiliate || affiliate.status !== "ACTIVE") return null;

  const click = await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      ipHash: hashIp(opts.ip),
      userAgent: opts.userAgent.slice(0, 255),
      landingPath: opts.landingPath.slice(0, 255),
    },
    select: { id: true },
  });
  return click.id;
}

/**
 * משייך משתמש חדש לשותף שהפנה אותו. נקרא פעם אחת, בהרשמה.
 * שותף לא מזוכה על הפניה עצמית.
 */
export async function attributeSignup(opts: {
  userId: string;
  code: string | null;
  clickId: string | null;
}) {
  if (!opts.code) return;

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: opts.code.toLowerCase() },
    select: { id: true, userId: true, status: true, signupBountyAgorot: true },
  });
  if (!affiliate || affiliate.status !== "ACTIVE") return;
  if (affiliate.userId === opts.userId) return;

  const existing = await prisma.referral.findUnique({ where: { userId: opts.userId } });
  if (existing) return;

  // הקליק משויך רק אם הוא באמת שייך לאותו שותף ועוד לא נוצל
  let clickId: string | null = null;
  if (opts.clickId) {
    const click = await prisma.affiliateClick.findUnique({
      where: { id: opts.clickId },
      select: { id: true, affiliateId: true, referral: { select: { id: true } } },
    });
    if (click && click.affiliateId === affiliate.id && !click.referral) clickId = click.id;
  }

  const referral = await prisma.referral.create({
    data: { affiliateId: affiliate.id, userId: opts.userId, clickId },
    select: { id: true },
  });

  if (affiliate.signupBountyAgorot > 0) {
    await prisma.commission.create({
      data: {
        affiliateId: affiliate.id,
        referralId: referral.id,
        type: "SIGNUP",
        amountAgorot: affiliate.signupBountyAgorot,
        note: "בונוס הרשמה",
      },
    });
  }
}

/** יוצר עמלה על תשלום של משתמש מופנה. נקרא אחרי שתשלום נרשם. */
export async function commissionForPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, userId: true, amountAgorot: true, status: true },
  });
  if (!payment || payment.status !== "PAID") return;

  const referral = await prisma.referral.findUnique({
    where: { userId: payment.userId },
    select: { id: true, affiliate: { select: { id: true, status: true, ratePercent: true } } },
  });
  if (!referral || referral.affiliate.status !== "ACTIVE") return;

  const amount = Math.round((payment.amountAgorot * referral.affiliate.ratePercent) / 100);
  if (amount <= 0) return;

  await prisma.commission.upsert({
    where: { paymentId: payment.id },
    create: {
      affiliateId: referral.affiliate.id,
      referralId: referral.id,
      paymentId: payment.id,
      type: "PAYMENT",
      amountAgorot: amount,
      note: `${referral.affiliate.ratePercent}% מתשלום`,
    },
    update: {},
  });
}

export function formatAgorot(agorot: number): string {
  return `₪${(agorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
