import Link from "next/link";
import { prisma } from "@/lib/db";
import ReportRow from "@/components/admin/ReportRow";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status === "all" ? {} : { status: "OPEN" as const };

  const reports = await prisma.report.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      resolution: true,
      messageId: true,
      photoId: true,
      message: { select: { body: true, type: true, photoId: true } },
      reporter: { select: { id: true, email: true } },
      reportedUser: {
        select: {
          id: true,
          email: true,
          status: true,
          profile: { select: { displayName: true, city: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Link href="/admin/reports" className="btn-secondary">
          פתוחים
        </Link>
        <Link href="/admin/reports?status=all" className="btn-ghost">
          הכול
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="card p-8 text-center text-ink-600">אין דיווחים להצגה.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={{
                id: report.id,
                reason: report.reason,
                details: report.details,
                status: report.status,
                resolution: report.resolution,
                createdAt: report.createdAt.toISOString(),
                reporterEmail: report.reporter.email,
                reportedUserId: report.reportedUser.id,
                reportedEmail: report.reportedUser.email,
                reportedName: report.reportedUser.profile?.displayName ?? "—",
                reportedStatus: report.reportedUser.status,
                photoId: report.photoId ?? report.message?.photoId ?? null,
                messageBody: report.message?.body ?? null,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
