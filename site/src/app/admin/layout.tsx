import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "ניהול" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") redirect("/");

  const [pendingPhotos, openReports] = await Promise.all([
    prisma.photo.count({ where: { kind: "PROFILE", status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);

  const tabs: { href: string; label: string; badge?: number; adminOnly?: boolean }[] = [
    { href: "/admin", label: "סקירה" },
    { href: "/admin/photos", label: "תמונות", badge: pendingPhotos },
    { href: "/admin/reports", label: "דיווחים", badge: openReports },
    { href: "/admin/users", label: "משתמשים" },
    { href: "/admin/affiliates", label: "שותפים", adminOnly: true },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">פאנל ניהול</h1>
      <nav className="flex flex-wrap gap-2 border-b border-ink-200 pb-3">
        {tabs
          .filter((tab) => !tab.adminOnly || user.role === "ADMIN")
          .map((tab) => (
            <Link key={tab.href} href={tab.href} className="btn-secondary">
              {tab.label}
              {tab.badge ? (
                <span className="chip bg-brand-100 text-brand-800">{tab.badge}</span>
              ) : null}
            </Link>
          ))}
      </nav>
      {children}
    </div>
  );
}
