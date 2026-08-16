import Link from "next/link";
import { GOAL_LABELS } from "@/lib/constants";
import type { SearchResult } from "@/lib/search";
import LikeButton from "./LikeButton";

export default function ProfileCard({ profile }: { profile: SearchResult }) {
  return (
    <article className="card overflow-hidden">
      <Link href={`/profile/${profile.userId}`} className="block">
        <div className="aspect-[4/5] w-full bg-ink-100">
          {profile.photoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media/${profile.photoId}`}
              alt={`תמונת הפרופיל של ${profile.displayName}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              אין תמונה עדיין
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-2 p-4">
        <div className="flex items-baseline gap-2">
          <Link href={`/profile/${profile.userId}`} className="font-bold hover:underline">
            {profile.displayName}
          </Link>
          <span className="text-ink-500">{profile.age}</span>
        </div>
        <p className="text-sm text-ink-600">
          {profile.city} · {GOAL_LABELS[profile.goal] ?? profile.goal}
        </p>
        {profile.bio && (
          <p className="line-clamp-2 text-sm text-ink-600">{profile.bio}</p>
        )}
        <LikeButton userId={profile.userId} initialLiked={profile.liked} />
      </div>
    </article>
  );
}
