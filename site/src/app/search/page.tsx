import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchProfiles, type SearchParams } from "@/lib/search";
import { searchSchema } from "@/lib/validation";
import SearchFilters from "@/components/SearchFilters";
import ProfileCard from "@/components/ProfileCard";

export const metadata = { title: "חיפוש" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = await searchParams;
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { seeking: true, city: true, prefMinAge: true, prefMaxAge: true },
  });

  // בלי פרמטרים בכתובת — ממלאים מהעדפות הפרופיל
  const hasQuery = Object.keys(raw).length > 0;
  const defaults = {
    gender:
      profile?.seeking === "MEN" ? "MALE" : profile?.seeking === "WOMEN" ? "FEMALE" : "ANY",
    minAge: String(profile?.prefMinAge ?? 18),
    maxAge: String(profile?.prefMaxAge ?? 99),
  };

  const parsed = searchSchema.safeParse(hasQuery ? raw : defaults);
  const params = (parsed.success ? parsed.data : searchSchema.parse({})) as SearchParams;

  const { results, total, pages } = await searchProfiles(user.id, params);

  const pageLink = (page: number) => {
    const qs = new URLSearchParams();
    qs.set("gender", params.gender);
    if (params.city) qs.set("city", params.city);
    qs.set("minAge", String(params.minAge));
    qs.set("maxAge", String(params.maxAge));
    qs.set("goal", params.goal);
    if (params.withPhoto) qs.set("withPhoto", "true");
    qs.set("page", String(page));
    return `/search?${qs}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">חיפוש</h1>
        <p className="text-sm text-ink-600">{total.toLocaleString("he-IL")} פרופילים מתאימים</p>
      </div>

      <SearchFilters params={params} />

      {results.length === 0 ? (
        <div className="card p-8 text-center text-ink-600">
          <p className="font-semibold">לא נמצאו תוצאות</p>
          <p className="mt-1 text-sm">נסו להרחיב את טווח הגילאים או לבטל את סינון העיר.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <ProfileCard key={r.userId} profile={r} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          {params.page > 1 && (
            <Link href={pageLink(params.page - 1)} className="btn-secondary">
              הקודם
            </Link>
          )}
          <span className="text-sm text-ink-600">
            עמוד {params.page} מתוך {pages}
          </span>
          {params.page < pages && (
            <Link href={pageLink(params.page + 1)} className="btn-secondary">
              הבא
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
