import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAgorot } from "@/lib/affiliate";
import AffiliateRow from "@/components/admin/AffiliateRow";
import CommissionQueue from "@/components/admin/CommissionQueue";

export default async function AdminAffiliatesPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/admin");

  const affiliates = await prisma.affiliate.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      status: true,
      ratePercent: true,
      signupBountyAgorot: true,
      payoutNotes: true,
      createdAt: true,
      user: { select: { email: true, profile: { select: { displayName: true } } } },
      _count: { select: { clicks: true, referrals: true } },
    },
  });

  const sums = await prisma.commission.groupBy({
    by: ["affiliateId", "status"],
    _sum: { amountAgorot: true },
  });

  const totals = new Map<string, Record<string, number>>();
  for (const row of sums) {
    const entry = totals.get(row.affiliateId) ?? {};
    entry[row.status] = row._sum.amountAgorot ?? 0;
    totals.set(row.affiliateId, entry);
  }

  const pending = await prisma.commission.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      type: true,
      amountAgorot: true,
      status: true,
      createdAt: true,
      affiliate: { select: { code: true } },
    },
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-bold">שותפים</h2>
        {affiliates.length === 0 ? (
          <p className="card p-8 text-center text-ink-600">עוד אין בקשות הצטרפות.</p>
        ) : (
          <ul className="space-y-2">
            {affiliates.map((affiliate) => (
              <AffiliateRow
                key={affiliate.id}
                affiliate={{
                  id: affiliate.id,
                  code: affiliate.code,
                  status: affiliate.status,
                  ratePercent: affiliate.ratePercent,
                  signupBountyAgorot: affiliate.signupBountyAgorot,
                  payoutNotes: affiliate.payoutNotes,
                  email: affiliate.user.email,
                  displayName: affiliate.user.profile?.displayName ?? "—",
                  clicks: affiliate._count.clicks,
                  referrals: affiliate._count.referrals,
                  pendingLabel: formatAgorot(totals.get(affiliate.id)?.PENDING ?? 0),
                  paidLabel: formatAgorot(totals.get(affiliate.id)?.PAID ?? 0),
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">עמלות לטיפול</h2>
        <CommissionQueue
          commissions={pending.map((c) => ({
            id: c.id,
            code: c.affiliate.code,
            type: c.type,
            amountLabel: formatAgorot(c.amountAgorot),
            status: c.status,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
