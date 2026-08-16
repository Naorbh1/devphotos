"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LikeButton({
  userId,
  initialLiked,
  showPass = true,
}: {
  userId: string;
  initialLiked: boolean;
  showPass?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "like" | "pass") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "הפעולה נכשלה");
      return;
    }
    if (action === "like") {
      setLiked(true);
      if (data.matched) setMatched(data.conversationId);
    } else {
      router.refresh();
    }
  }

  if (matched) {
    return (
      <a href={`/messages/${matched}`} className="btn-primary w-full">
        יש התאמה! לשיחה →
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          className={liked ? "btn-secondary flex-1" : "btn-primary flex-1"}
          disabled={busy || liked}
          onClick={() => send("like")}
        >
          {liked ? "סימנת לייק ✓" : "לייק"}
        </button>
        {showPass && !liked && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => send("pass")}
          >
            דילוג
          </button>
        )}
      </div>
      {error && <p className="text-xs text-brand-700">{error}</p>}
    </div>
  );
}
