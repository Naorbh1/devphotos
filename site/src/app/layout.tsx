import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: `${SITE_NAME} — הכרויות בישראל`,
  description: "אתר הכרויות: חיפוש לפי עיר, גיל וסוג הקשר שמחפשים, עם צ'אט בזמן אמת.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user
    ? await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { displayName: true },
      })
    : null;

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh font-sans antialiased">
        <SiteHeader
          user={user ? { id: user.id, role: user.role, name: profile?.displayName ?? "" } : null}
        />
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-12 border-t border-ink-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-ink-500">
            <p>
              © {new Date().getFullYear()} {SITE_NAME}. השירות מיועד לבני 18 ומעלה בלבד.
            </p>
            <p>
              נתקלתם בפרופיל מטריד או מזויף? יש כפתור דיווח בכל פרופיל ובכל שיחה.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
