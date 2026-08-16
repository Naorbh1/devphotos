import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/validation";
import PhotoModerationCard from "@/components/admin/PhotoModerationCard";

export default async function AdminPhotosPage() {
  const photos = await prisma.photo.findMany({
    where: { kind: "PROFILE", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 60,
    select: {
      id: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          profile: { select: { displayName: true, birthDate: true, city: true } },
        },
      },
    },
  });

  if (photos.length === 0) {
    return <p className="card p-8 text-center text-ink-600">אין תמונות שממתינות לאישור. 🎉</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-600">
        {photos.length} תמונות ממתינות. תמונה מאושרת מתפרסמת מיד; תמונה שנדחתה לא מוצגת לאחרים
        והמשתמש רואה את הסיבה.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <PhotoModerationCard
            key={photo.id}
            photo={{
              id: photo.id,
              uploadedAt: photo.createdAt.toISOString(),
              userId: photo.user.id,
              email: photo.user.email,
              displayName: photo.user.profile?.displayName ?? "—",
              age: photo.user.profile ? ageFrom(photo.user.profile.birthDate) : null,
              city: photo.user.profile?.city ?? "—",
            }}
          />
        ))}
      </div>
    </div>
  );
}
