import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "הודעות" };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      lastMessageAt: true,
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, type: true, senderId: true, readAt: true },
      },
    },
  });

  const otherIds = conversations.map((c) => (c.userAId === user.id ? c.userBId : c.userAId));
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: otherIds } },
    select: {
      userId: true,
      displayName: true,
      user: {
        select: {
          photos: {
            where: { kind: "PROFILE", status: "APPROVED" },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  const byId = new Map(profiles.map((p) => [p.userId, p]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">הודעות</h1>

      {conversations.length === 0 ? (
        <p className="card p-8 text-center text-ink-600">
          אין עדיין שיחות. שיחה נפתחת אחרי התאמה הדדית.
        </p>
      ) : (
        <ul className="card divide-y divide-ink-200">
          {conversations.map((conversation) => {
            const otherId =
              conversation.userAId === user.id ? conversation.userBId : conversation.userAId;
            const other = byId.get(otherId);
            const last = conversation.messages[0];
            const unread = last && last.senderId !== user.id && !last.readAt;

            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 p-3 transition hover:bg-ink-50"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-full bg-ink-100">
                    {other?.user.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/${other.user.photos[0].id}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{other?.displayName ?? "משתמש"}</p>
                    <p className="truncate text-sm text-ink-600">
                      {last
                        ? last.type === "IMAGE"
                          ? "📷 תמונה"
                          : last.body
                        : "עוד לא נשלחו הודעות"}
                    </p>
                  </div>
                  {unread && <span className="size-2.5 shrink-0 rounded-full bg-brand-500" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
