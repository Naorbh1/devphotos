import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAgorot } from "@/lib/affiliate";
import { PLANS, SITE_NAME } from "@/lib/constants";
import AffiliateApplyForm from "@/components/AffiliateApplyForm";
import CopyField from "@/components/CopyField";

export const metadata = { title: "תוכנית שותפים" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין לאישור",
  APPROVED: "אושר לתשלום",
  PAID: "שולם",
  REVERSED: "בוטל",
};

export default async function AffiliatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      code: true,
      status: true,
      ratePercent: true,
      signupBountyAgorot: true,
      createdAt: true,
    },
  });

  if (!affiliate) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold">תוכנית השותפים</h1>
          <p className="mt-1 text-ink-600">
            מקבלים קישור אישי, מפנים אנשים ל{SITE_NAME}, ומקבלים אחוז מכל תשלום שלהם.
            הייחוס נשמר 30 יום מרגע הקליק.
          </p>
        </header>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">איך זה עובד</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-ink-700">
            <li>בוחרים קוד אישי — הוא מופיע בקישור שלכם.</li>
            <li>הצוות מאשר את הבקשה (בדרך כלל תוך יום עסקים).</li>
            <li>מפרסמים את הקישור. כל קליק והרשמה נספרים בלוח הבקרה שלכם.</li>
            <li>כשמופנה שלכם משלם — נרשמת לכם עמלה.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-500">
            אין תשלום על הפניה עצמית, ועמלה על תשלום שבוטל מתבטלת בהתאם.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">הצטרפות</h2>
          <AffiliateApplyForm />
        </div>
      </div>
    );
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const link = `${protocol}://${host}/r/${affiliate.code}`;

  const [clicks, referrals, commissions, grouped] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
    prisma.referral.count({ where: { affiliateId: affiliate.id } }),
    prisma.commission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        amountAgorot: true,
        status: true,
        note: true,
        createdAt: true,
      },
    }),
    prisma.commission.groupBy({
      by: ["status"],
      where: { affiliateId: affiliate.id },
      _sum: { amountAgorot: true },
    }),
  ]);

  const totals = Object.fromEntries(
    grouped.map((g) => [g.status, g._sum.amountAgorot ?? 0]),
  ) as Record<string, number>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold">תוכנית השותפים</h1>
        <p className="text-sm text-ink-600">
          סטטוס:{" "}
          {affiliate.status === "ACTIVE"
            ? "פעיל"
            : affiliate.status === "PENDING"
              ? "ממתין לאישור הצוות"
              : "מושהה"}{" "}
          · עמלה {affiliate.ratePercent}% מכל תשלום
          {affiliate.signupBountyAgorot > 0 &&
            ` · בונוס הרשמה ${formatAgorot(affiliate.signupBountyAgorot)}`}
        </p>
      </header>

      {affiliate.status !== "ACTIVE" && (
        <p className="card border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          {affiliate.status === "PENDING"
            ? "הבקשה שלכם ממתינה לאישור. הקישור יתחיל לצבור קליקים רק לאחר האישור."
            : "החשבון מושהה. לפרטים נוספים פנו לצוות."}
        </p>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">הקישור שלי</h2>
        <CopyField value={link} />
        <p className="text-xs text-ink-500">
          אפשר להוסיף יעד פנימי: <code>{link}?to=/search</code>
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="קליקים" value={clicks.toLocaleString("he-IL")} />
        <Stat label="נרשמו דרככם" value={referrals.toLocaleString("he-IL")} />
        <Stat label="ממתין לאישור" value={formatAgorot(totals.PENDING ?? 0)} />
        <Stat label="שולם" value={formatAgorot(totals.PAID ?? 0)} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-ink-200 p-4 text-lg font-bold">העמלות שלי</h2>
        {commissions.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-600">עוד אין עמלות.</p>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="p-3 font-medium">תאריך</th>
                <th className="p-3 font-medium">סוג</th>
                <th className="p-3 font-medium">סכום</th>
                <th className="p-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">{c.createdAt.toLocaleDateString("he-IL")}</td>
                  <td className="p-3">{c.type === "SIGNUP" ? "הרשמה" : c.note || "תשלום"}</td>
                  <td className="p-3 font-medium">{formatAgorot(c.amountAgorot)}</td>
                  <td className="p-3">{STATUS_LABEL[c.status] ?? c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-2 text-lg font-bold">מסלולי התשלום באתר</h2>
        <ul className="space-y-1 text-sm text-ink-700">
          {PLANS.map((plan) => (
            <li key={plan.id}>
              {plan.label} — {formatAgorot(plan.amountAgorot)} (עמלה שלכם:{" "}
              {formatAgorot(Math.round((plan.amountAgorot * affiliate.ratePercent) / 100))})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
