"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AffiliateApplyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/affiliate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        payoutNotes: form.get("payoutNotes") || "",
      }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "השליחה נכשלה");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">קוד השותף שלי</label>
        <input
          id="code"
          name="code"
          className="field font-mono"
          dir="ltr"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-z0-9-]+"
          placeholder="my-code"
        />
        <p className="mt-1 text-xs text-ink-500">
          אותיות לועזיות קטנות, ספרות ומקף. הקישור שלכם יהיה /r/הקוד־שלכם
        </p>
      </div>

      <div>
        <label className="label" htmlFor="payoutNotes">פרטים לתשלום (לא חובה)</label>
        <textarea
          id="payoutNotes"
          name="payoutNotes"
          className="field"
          rows={3}
          maxLength={500}
          placeholder="איך נוח לכם לקבל תשלום, מספר עוסק וכו'"
        />
      </div>

      {error && <p className="text-sm text-brand-700">{error}</p>}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "שולח..." : "שליחת בקשה"}
      </button>
    </form>
  );
}
