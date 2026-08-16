import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, HttpError } from "@/lib/auth";
import { ok, rateLimit, route } from "@/lib/api";
import { registerSchema, ageFrom } from "@/lib/validation";
import { attributeSignup } from "@/lib/affiliate";
import { MIN_AGE, REFERRAL_COOKIE } from "@/lib/constants";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);

  const input = registerSchema.parse(await req.json());

  const birthDate = new Date(input.birthDate);
  if (ageFrom(birthDate) < MIN_AGE) {
    throw new HttpError(400, `ההרשמה מותרת מגיל ${MIN_AGE} ומעלה בלבד`);
  }

  const exists = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (exists) throw new HttpError(409, "כתובת האימייל הזו כבר רשומה");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      profile: {
        create: {
          displayName: input.displayName,
          birthDate,
          gender: input.gender,
          seeking: input.seeking,
          city: input.city,
          goal: input.goal,
          completedAt: new Date(),
        },
      },
    },
    select: { id: true },
  });

  const jar = await cookies();
  await attributeSignup({
    userId: user.id,
    code: jar.get(REFERRAL_COOKIE)?.value ?? null,
    clickId: jar.get(`${REFERRAL_COOKIE}_click`)?.value ?? null,
  });

  await createSession(user.id);
  return ok({ id: user.id });
});
