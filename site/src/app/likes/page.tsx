import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ageFrom } from "@/lib/validation";
import LikeButton from "@/components/LikeButton";

export const metadata = { title: "התאמות" };

type Card = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  photoId: string | null;
  conversationId?: string;
};

export default async function LikesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [matches, incoming, blocks] = await Promise.all([
    prisma.match.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      orderBy: { createdAt: "desc" },
      select: { userAId: true, userBId: true },
    }),
    prisma.like.findMany({
      where: { toUserId: user.id, isLike: true },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { fromUserId: true },
    }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excluded = new Set<string>();
  for (const b of blocks) {
    excluded.add(b.blockerId);
    excluded.add(b.blockedId);
  }
  excluded.delete(user.id);

  const matchedIds = matches
    .map((m) => (m.userAId === user.id ? m.userBId : m.userAId))
    .filter((id) => !excluded.has(id));

  const myLikes = await prisma.like.findMany({
    where: { fromUserId: user.id, isLike: true },
    select: { toUserId: true },
  });
  const likedByMe = new Set(myLikes.map((l) => l.toUserId));

  const pendingIds = incoming
    .map((l) => l.fromUserId)
    .filter((id) => !excluded.has(id) && !matchedIds.includes(id) && !likedByMe.has(id));

  const cards = await loadCards([...new Set([...matchedIds, ...pendingIds])], user.id);
  const matchedCards = matchedIds.map((id) => cards.get(id)).filter(Boolean) as Card[];
  const pendingCards = pendingIds.map((id) => cards.get(id)).filter(Boolean) as Card[];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-3 text-2xl font-extrabold">ההתאמות שלי</h1>
        {matchedCards.length === 0 ? (
          <p className="card p-6 text-center text-ink-600">
            עוד אין התאמות. סמנו לייק בחיפוש — כששני הצדדים מסמנים, נפתחת שיחה.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchedCards.map((card) => (
              <article key={card.userId} className="card overflow-hidden">
                <Link href={`/profile/${card.userId}`}>
                  <Photo id={card.photoId} name={card.displayName} />
                </Link>
                <div className="space-y-2 p-4">
                  <p className="font-bold">
                    {card.displayName} <span className="text-ink-500">{card.age}</span>
                  </p>
                  <p className="text-sm text-ink-600">{card.city}</p>
                  {card.conversationId && (
                    <Link href={`/messages/${card.conversationId}`} className="btn-primary w-full">
                      לשיחה
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">סימנו לכם לייק</h2>
        <p className="mb-3 text-sm text-ink-600">
          {pendingCards.length} אנשים שמחכים לתשובה שלכם. לייק חוזר פותח שיחה.
        </p>
        {pendingCards.length === 0 ? (
          <p className="card p-6 text-center text-ink-600">אין לייקים חדשים כרגע.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingCards.map((card) => (
              <article key={card.userId} className="card overflow-hidden">
                <Link href={`/profile/${card.userId}`}>
                  <Photo id={card.photoId} name={card.displayName} />
                </Link>
                <div className="space-y-2 p-4">
                  <p className="font-bold">
                    {card.displayName} <span className="text-ink-500">{card.age}</span>
                  </p>
                  <p className="text-sm text-ink-600">{card.city}</p>
                  <LikeButton userId={card.userId} initialLiked={false} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Photo({ id, name }: { id: string | null; name: string }) {
  return (
    <div className="aspect-[4/5] w-full bg-ink-100">
      {id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/media/${id}`}
          alt={`תמונת הפרופיל של ${name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-ink-400">אין תמונה</div>
      )}
    </div>
  );
}

async function loadCards(ids: string[], viewerId: string): Promise<Map<string, Card>> {
  if (ids.length === 0) return new Map();

  const [profiles, conversations] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: ids }, user: { status: "ACTIVE" } },
      select: {
        userId: true,
        displayName: true,
        birthDate: true,
        city: true,
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
    }),
    prisma.conversation.findMany({
      where: {
        OR: [
          { userAId: viewerId, userBId: { in: ids } },
          { userBId: viewerId, userAId: { in: ids } },
        ],
      },
      select: { id: true, userAId: true, userBId: true },
    }),
  ]);

  const convByUser = new Map(
    conversations.map((c) => [c.userAId === viewerId ? c.userBId : c.userAId, c.id]),
  );

  return new Map(
    profiles.map((p) => [
      p.userId,
      {
        userId: p.userId,
        displayName: p.displayName,
        age: ageFrom(p.birthDate),
        city: p.city,
        photoId: p.user.photos[0]?.id ?? null,
        conversationId: convByUser.get(p.userId),
      },
    ]),
  );
}
