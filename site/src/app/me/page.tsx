import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/validation";
import ProfileForm from "@/components/ProfileForm";
import PhotoManager from "@/components/PhotoManager";

export const metadata = { title: "הפרופיל שלי" };

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/register");

  const photos = await prisma.photo.findMany({
    where: { userId: user.id, kind: "PROFILE" },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      isPrimary: true,
      rejectionReason: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">הפרופיל שלי</h1>
        <p className="text-sm text-ink-600">
          {profile.displayName}, {ageFrom(profile.birthDate)} · {user.email}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold">התמונות שלי</h2>
        <p className="mb-4 text-sm text-ink-600">
          כל תמונה עוברת אישור של הצוות לפני שהיא מוצגת לאחרים. נתוני המצלמה (כולל מיקום)
          נמחקים מהתמונה בעת ההעלאה.
        </p>
        <PhotoManager
          photos={photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
        />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold">פרטי הפרופיל</h2>
        <ProfileForm
          profile={{
            displayName: profile.displayName,
            city: profile.city,
            bio: profile.bio,
            goal: profile.goal,
            seeking: profile.seeking,
            heightCm: profile.heightCm,
            hasKids: profile.hasKids,
            smokes: profile.smokes,
            prefMinAge: profile.prefMinAge,
            prefMaxAge: profile.prefMaxAge,
            isVisible: profile.isVisible,
          }}
        />
      </section>
    </div>
  );
}
