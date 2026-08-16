"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  photo: {
    id: string;
    uploadedAt: string;
    userId: string;
    email: string;
    displayName: string;
    age: number | null;
    city: string;
  };
};

export default function PhotoModerationCard({ photo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "delete") {
    let reason: string | null = null;
    if (action === "reject") {
      reason = prompt("סיבת הדחייה (תוצג למשתמש):", "התמונה אינה עומדת בכללי האתר");
      if (reason === null) return;
    }
    if (action === "delete" && !confirm("למחוק את התמונה לצמיתות?")) return;

    setBusy(true);
    const res = await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, action, reason }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDone(data.error || "הפעולה נכשלה");
      return;
    }
    setDone(action === "approve" ? "אושרה" : action === "reject" ? "נדחתה" : "נמחקה");
    router.refresh();
  }

  if (done) {
    return (
      <div className="card flex items-center justify-center p-8 text-sm text-ink-600">{done}</div>
    );
  }

  return (
    <article className="card overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/media/${photo.id}`}
        alt=""
        className="aspect-square w-full bg-ink-100 object-contain"
      />
      <div className="space-y-2 p-3 text-sm">
        <p className="font-semibold">
          <Link href={`/admin/users?q=${encodeURIComponent(photo.email)}`} className="hover:underline">
            {photo.displayName}
          </Link>{" "}
          {photo.age !== null && <span className="text-ink-500">{photo.age}</span>}
        </p>
        <p className="text-xs text-ink-500">
          {photo.city} · {photo.email}
        </p>
        <p className="text-xs text-ink-500">
          הועלתה {new Date(photo.uploadedAt).toLocaleString("he-IL")}
        </p>
        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => act("approve")}>
            אישור
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => act("reject")}>
            דחייה
          </button>
          <button
            type="button"
            className="btn-ghost text-brand-700"
            disabled={busy}
            onClick={() => act("delete")}
          >
            מחיקה
          </button>
        </div>
      </div>
    </article>
  );
}
