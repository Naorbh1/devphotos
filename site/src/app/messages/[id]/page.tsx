import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { otherParticipant } from "@/lib/matching";
import Chat from "@/components/Chat";
import SafetyActions from "@/components/SafetyActions";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const otherId = await otherParticipant(id, user.id);
  if (!otherId) notFound();

  const [other, messages, blocked] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: otherId },
      select: {
        userId: true,
        displayName: true,
        user: {
          select: {
            status: true,
            photos: {
              where: { kind: "PROFILE", status: "APPROVED" },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.message.findMany({
      where: { conversationId: id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        senderId: true,
        type: true,
        body: true,
        photoId: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: otherId },
          { blockerId: otherId, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    }),
  ]);

  if (!other) notFound();

  const readOnly = blocked !== null || other.user.status !== "ACTIVE";
  const readOnlyReason = blocked
    ? blocked.blockerId === user.id
      ? "חסמתם את המשתמש הזה. אפשר לבטל את החסימה בפרופיל שלו."
      : "לא ניתן לשלוח הודעות בשיחה הזו."
    : "המשתמש אינו פעיל כרגע.";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="btn-ghost">
          ←
        </Link>
        <Link href={`/profile/${other.userId}`} className="flex items-center gap-2">
          <span className="size-9 overflow-hidden rounded-full bg-ink-100">
            {other.user.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${other.user.photos[0].id}`}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="font-bold">{other.displayName}</span>
        </Link>
        <div className="mr-auto">
          <SafetyActions userId={other.userId} compact />
        </div>
      </div>

      <Chat
        conversationId={id}
        meId={user.id}
        otherName={other.displayName}
        readOnly={readOnly}
        readOnlyReason={readOnlyReason}
        initialMessages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          readAt: m.readAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
