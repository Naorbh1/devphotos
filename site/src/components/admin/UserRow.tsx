"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  statusReason: string | null;
  displayName: string;
  age: number | null;
  city: string;
  isVisible: boolean;
  createdAt: string;
  lastActiveAt: string;
  reports: number;
  photos: number;
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "פעיל",
  SUSPENDED: "מושעה",
  BANNED: "חסום",
  DELETED: "נמחק",
};

export default function UserRow({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: "ACTIVE" | "SUSPENDED" | "BANNED") {
    const reason =
      status === "ACTIVE" ? "" : (prompt("סיבה (תוצג למשתמש בכניסה):", "") ?? "");
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, status, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "הפעולה נכשלה");
      return;
    }
    router.refresh();
  }

  return (
    <li className="card flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-56 flex-1">
        <p className="font-semibold">
          <Link href={`/profile/${user.id}`} className="hover:underline">
            {user.displayName}
          </Link>{" "}
          {user.age !== null && <span className="text-ink-500">{user.age}</span>}{" "}
          {user.role !== "USER" && <span className="chip bg-brand-50 text-brand-700">{user.role}</span>}
        </p>
        <p className="text-xs text-ink-500">
          {user.email} · {user.city} · נרשם {new Date(user.createdAt).toLocaleDateString("he-IL")}
        </p>
        <p className="text-xs text-ink-500">
          {user.photos} תמונות · {user.reports} דיווחים · פעילות אחרונה{" "}
          {new Date(user.lastActiveAt).toLocaleDateString("he-IL")}
          {!user.isVisible && " · מוסתר מחיפוש"}
        </p>
        {user.statusReason && <p className="text-xs text-brand-700">{user.statusReason}</p>}
        {error && <p className="text-xs text-brand-700">{error}</p>}
      </div>

      <span
        className={
          user.status === "ACTIVE" ? "chip bg-green-100 text-green-800" : "chip bg-brand-100 text-brand-800"
        }
      >
        {STATUS_LABEL[user.status] ?? user.status}
      </span>

      <div className="flex gap-2">
        {user.status === "ACTIVE" ? (
          <>
            <button className="btn-secondary" disabled={busy} onClick={() => setStatus("SUSPENDED")}>
              השעיה
            </button>
            <button className="btn-ghost text-brand-700" disabled={busy} onClick={() => setStatus("BANNED")}>
              חסימה
            </button>
          </>
        ) : (
          <button className="btn-secondary" disabled={busy} onClick={() => setStatus("ACTIVE")}>
            החזרת גישה
          </button>
        )}
      </div>
    </li>
  );
}
