"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAX_PROFILE_PHOTOS } from "@/lib/constants";

type Photo = {
  id: string;
  status: string;
  isPrimary: boolean;
  rejectionReason: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתינה לאישור",
  APPROVED: "מאושרת",
  REJECTED: "נדחתה",
};

export default function PhotoManager({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("file", file);
    form.set("kind", "PROFILE");

    const res = await fetch("/api/photos", { method: "POST", body: form });
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "ההעלאה נכשלה");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("למחוק את התמונה?")) return;
    setBusy(true);
    await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function setPrimary(id: string) {
    setBusy(true);
    const res = await fetch("/api/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <figure key={photo.id} className="overflow-hidden rounded-xl border border-ink-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${photo.id}`}
              alt=""
              className="aspect-square w-full object-cover"
            />
            <figcaption className="space-y-2 p-2 text-xs">
              <div className="flex items-center gap-1">
                <span
                  className={
                    photo.status === "APPROVED"
                      ? "chip bg-green-100 text-green-800"
                      : photo.status === "REJECTED"
                        ? "chip bg-brand-100 text-brand-800"
                        : "chip"
                  }
                >
                  {STATUS_LABEL[photo.status] ?? photo.status}
                </span>
                {photo.isPrimary && <span className="chip bg-brand-50 text-brand-700">ראשית</span>}
              </div>
              {photo.rejectionReason && (
                <p className="text-brand-700">{photo.rejectionReason}</p>
              )}
              <div className="flex gap-2">
                {!photo.isPrimary && photo.status === "APPROVED" && (
                  <button
                    type="button"
                    className="text-ink-600 hover:underline"
                    onClick={() => setPrimary(photo.id)}
                    disabled={busy}
                  >
                    קבע כראשית
                  </button>
                )}
                <button
                  type="button"
                  className="text-brand-700 hover:underline"
                  onClick={() => remove(photo.id)}
                  disabled={busy}
                >
                  מחיקה
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {photos.length < MAX_PROFILE_PHOTOS && (
        <div>
          <label className="btn-secondary cursor-pointer">
            {busy ? "מעלה..." : "העלאת תמונה"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={upload}
              disabled={busy}
            />
          </label>
          <p className="mt-1 text-xs text-ink-500">
            JPG, PNG או WebP · עד 8MB · עד {MAX_PROFILE_PHOTOS} תמונות
          </p>
        </div>
      )}

      {error && <p className="text-sm text-brand-700">{error}</p>}
    </div>
  );
}
