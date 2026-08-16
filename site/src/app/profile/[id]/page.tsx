import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GENDER_LABELS, GOAL_LABELS } from "@/lib/constants";
import { ageFrom } from "@/lib/validation";
import { pair } from "@/lib/matching";
import LikeButton from "@/components/LikeButton";
import SafetyActions from "@/components/SafetyActions";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { id } = await params;
  if (id === viewer.id) redirect("/me");

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewer.id, blockedId: id },
        { blockerId: id, blockedId: viewer.id },
      ],
    },
    select: { blockerId: true },
  });
  if (blocked) notFound();

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      lastActiveAt: true,
      profile: true,
      photos: {
        where: { kind: "PROFILE", status: "APPROVED" },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      },
    },
  });
  if (!target || target.status !== "ACTIVE" || !target.profile?.isVisible) notFound();

  const profile = target.profile;
  const [userAId, userBId] = pair(viewer.id, target.id);

  const [myLike, match] = await Promise.all([
    prisma.like.findUnique({
      where: { fromUserId_toUserId: { fromUserId: viewer.id, toUserId: target.id } },
      select: { isLike: true },
    }),
    prisma.match.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true },
    }),
  ]);

  const conversation = match
    ? await prisma.conversation.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        select: { id: true },
      })
    : null;

  const facts: [string, string][] = [
    ["גיל", String(ageFrom(profile.birthDate))],
    ["מגדר", GENDER_LABELS[profile.gender] ?? profile.gender],
    ["עיר", profile.city],
    ["מחפש/ת", GOAL_LABELS[profile.goal] ?? profile.goal],
  ];
  if (profile.heightCm) facts.push(["גובה", `${profile.heightCm} ס"מ`]);
  if (profile.hasKids !== null) facts.push(["ילדים", profile.hasKids ? "יש" : "אין"]);
  if (profile.smokes !== null) facts.push(["עישון", profile.smokes ? "מעשן/ת" : "לא מעשן/ת"]);

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="card aspect-[4/5] overflow-hidden bg-ink-100">
          {target.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${target.photos[0].id}`}
              alt={`תמונת הפרופיל של ${profile.displayName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              אין תמונה
            </div>
          )}
        </div>

        {target.photos.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {target.photos.slice(1).map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={`/api/media/${photo.id}`}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <header>
          <h1 className="text-3xl font-extrabold">
            {profile.displayName} <span className="text-ink-500">{ageFrom(profile.birthDate)}</span>
          </h1>
          <p className="text-ink-600">
            {profile.city} · {GOAL_LABELS[profile.goal] ?? profile.goal}
          </p>
        </header>

        {conversation ? (
          <Link href={`/messages/${conversation.id}`} className="btn-primary">
            יש ביניכם התאמה — לשיחה
          </Link>
        ) : (
          <LikeButton userId={target.id} initialLiked={myLike?.isLike === true} />
        )}

        {profile.bio && (
          <section className="card p-4">
            <h2 className="mb-2 font-bold">קצת עליי</h2>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">
              {profile.bio}
            </p>
          </section>
        )}

        <section className="card p-4">
          <h2 className="mb-3 font-bold">פרטים</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-ink-500">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SafetyActions userId={target.id} />
      </div>
    </div>
  );
}
