"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_REASONS } from "@/lib/constants";

export default function SafetyActions({
  userId,
  messageId,
  compact = false,
}: {
  userId: string;
  messageId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId: userId,
        reason: form.get("reason"),
        details: form.get("details") || "",
        messageId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setOpen(false);
    setStatus(res.ok ? "הדיווח נשלח לצוות. תודה." : data.error || "שליחת הדיווח נכשלה");
  }

  async function block() {
    if (!confirm("לחסום את המשתמש? לא תראו זה את זה יותר באתר.")) return;
    setBusy(true);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/search");
      router.refresh();
    } else {
      setStatus("החסימה נכשלה");
    }
  }

  return (
    <div className={compact ? "" : "card p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={() => setOpen((v) => !v)}>
          דיווח
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={block} disabled={busy}>
          חסימה
        </button>
        {status && <span className="text-sm text-ink-600">{status}</span>}
      </div>

      {open && (
        <form onSubmit={submitReport} className="mt-3 space-y-3 border-t border-ink-200 pt-3">
          <div>
            <label className="label" htmlFor="reason">
              סיבת הדיווח
            </label>
            <select id="reason" name="reason" className="field" required defaultValue="">
              <option value="" disabled>
                בחרו סיבה
              </option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="details">
              פרטים (לא חובה)
            </label>
            <textarea id="details" name="details" className="field" rows={3} maxLength={1000} />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            שליחת דיווח
          </button>
        </form>
      )}
    </div>
  );
}
