import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/validation";
import UserRow from "@/components/admin/UserRow";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { profile: { displayName: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      statusReason: true,
      createdAt: true,
      lastActiveAt: true,
      profile: { select: { displayName: true, birthDate: true, city: true, isVisible: true } },
      _count: { select: { reportsReceived: true, photos: true } },
    },
  });

  return (
    <div className="space-y-3">
      <form className="flex gap-2" action="/admin/users">
        <input
          name="q"
          className="field max-w-sm"
          placeholder="חיפוש לפי אימייל או שם"
          defaultValue={query}
        />
        <button type="submit" className="btn-secondary">
          חיפוש
        </button>
      </form>

      {users.length === 0 ? (
        <p className="card p-8 text-center text-ink-600">לא נמצאו משתמשים.</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={{
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                statusReason: user.statusReason,
                displayName: user.profile?.displayName ?? "—",
                age: user.profile ? ageFrom(user.profile.birthDate) : null,
                city: user.profile?.city ?? "—",
                isVisible: user.profile?.isVisible ?? false,
                createdAt: user.createdAt.toISOString(),
                lastActiveAt: user.lastActiveAt.toISOString(),
                reports: user._count.reportsReceived,
                photos: user._count.photos,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
