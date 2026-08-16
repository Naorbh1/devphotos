import { prisma } from "@/lib/db";
import { formatAgorot } from "@/lib/affiliate";

export default async function AdminOverviewPage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    users,
    newUsers,
    visibleProfiles,
    pendingPhotos,
    openReports,
    matches,
    messages,
    affiliates,
    revenue,
    owed,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.profile.count({ where: { isVisible: true } }),
    prisma.photo.count({ where: { kind: "PROFILE", status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.match.count(),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.affiliate.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountAgorot: true } }),
    prisma.commission.aggregate({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amountAgorot: true },
    }),
  ]);

  const stats: [string, string][] = [
    ["משתמשים פעילים", users.toLocaleString("he-IL")],
    ["נרשמו ב-7 ימים", newUsers.toLocaleString("he-IL")],
    ["פרופילים גלויים", visibleProfiles.toLocaleString("he-IL")],
    ["תמונות בהמתנה", pendingPhotos.toLocaleString("he-IL")],
    ["דיווחים פתוחים", openReports.toLocaleString("he-IL")],
    ["התאמות", matches.toLocaleString("he-IL")],
    ["הודעות ב-7 ימים", messages.toLocaleString("he-IL")],
    ["שותפים פעילים", affiliates.toLocaleString("he-IL")],
    ["הכנסות (מדומה)", formatAgorot(revenue._sum.amountAgorot ?? 0)],
    ["עמלות לתשלום", formatAgorot(owed._sum.amountAgorot ?? 0)],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(([label, value]) => (
        <div key={label} className="card p-4">
          <p className="text-sm text-ink-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold">{value}</p>
        </div>
      ))}
    </div>
  );
}
