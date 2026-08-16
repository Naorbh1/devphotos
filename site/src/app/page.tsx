import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE_NAME, CITIES, GOAL_LABELS } from "@/lib/constants";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/search");

  const [members, cities] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.profile.groupBy({
      by: ["city"],
      where: { isVisible: true },
      _count: { city: true },
      orderBy: { _count: { city: "desc" } },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-12 py-6">
      <section className="text-center">
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          מחפשים מישהו <span className="text-brand-600">באמת</span>?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-600">
          {SITE_NAME} מחבר בין אנשים לפי מה שבאמת חשוב: איפה אתם גרים, באיזה גיל,
          ואיזה סוג קשר אתם מחפשים. הרשמה חינם, {members.toLocaleString("he-IL")} משתמשים פעילים.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            הרשמה חינם
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            כבר יש לי חשבון
          </Link>
        </div>
        <p className="mt-3 text-xs text-ink-500">השירות מיועד לבני 18 ומעלה בלבד.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "חיפוש מדויק",
            body: "סינון לפי עיר מגורים, טווח גילאים, מגדר וסוג הקשר שמחפשים — בלי לגלול אינסוף פרופילים לא רלוונטיים.",
          },
          {
            title: "צ'אט בזמן אמת",
            body: "אחרי התאמה הדדית נפתחת שיחה. אפשר לשלוח הודעות ותמונות, ולראות מתי ההודעה נקראה.",
          },
          {
            title: "מרחב בטוח",
            body: "כל תמונת פרופיל עוברת אישור לפני שהיא מתפרסמת, ובכל פרופיל ושיחה יש כפתורי חסימה ודיווח.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">מחפשים לפי אזור</h2>
        <div className="flex flex-wrap gap-2">
          {(cities.length ? cities.map((c) => c.city) : CITIES.slice(0, 8)).map((city) => (
            <Link key={city} href={`/register?city=${encodeURIComponent(city)}`} className="chip hover:bg-ink-200">
              הכרויות ב{city}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">מחפשים לפי סוג קשר</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(GOAL_LABELS).map(([key, label]) => (
            <Link key={key} href={`/register?goal=${key}`} className="chip hover:bg-ink-200">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
