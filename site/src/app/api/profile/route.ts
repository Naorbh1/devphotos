import { prisma } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/auth";
import { ok, route } from "@/lib/api";
import { profileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const input = profileSchema.parse(await req.json());

  if (input.prefMinAge > input.prefMaxAge) {
    throw new HttpError(400, "טווח הגילאים לא תקין");
  }

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      displayName: input.displayName,
      city: input.city,
      bio: input.bio,
      goal: input.goal,
      seeking: input.seeking,
      heightCm: input.heightCm ?? null,
      hasKids: input.hasKids ?? null,
      smokes: input.smokes ?? null,
      prefMinAge: input.prefMinAge,
      prefMaxAge: input.prefMaxAge,
      prefCities: input.prefCities.join(","),
      isVisible: input.isVisible,
    },
  });

  return ok({ ok: true });
});
