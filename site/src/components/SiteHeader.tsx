import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import LogoutButton from "./LogoutButton";

type Props = {
  user: { id: string; role: string; name: string } | null;
};

export default function SiteHeader({ user }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <Link href="/" className="ml-auto text-lg font-extrabold text-brand-600">
          {SITE_NAME}
        </Link>

        {user ? (
          <>
            <Link href="/search" className="btn-ghost">
              חיפוש
            </Link>
            <Link href="/likes" className="btn-ghost">
              התאמות
            </Link>
            <Link href="/messages" className="btn-ghost">
              הודעות
            </Link>
            <Link href="/affiliate" className="btn-ghost hidden sm:inline-flex">
              שותפים
            </Link>
            {(user.role === "ADMIN" || user.role === "MODERATOR") && (
              <Link href="/admin" className="btn-ghost text-brand-600">
                ניהול
              </Link>
            )}
            <Link href="/me" className="btn-secondary mr-1">
              {user.name || "הפרופיל שלי"}
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="btn-ghost">
              כניסה
            </Link>
            <Link href="/register" className="btn-primary">
              הרשמה חינם
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
