"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Affiliate = {
  id: string;
  code: string;
  status: string;
  ratePercent: number;
  signupBountyAgorot: number;
  payoutNotes: string;
  email: string;
  displayName: string;
  clicks: number;
  referrals: number;
  pendingLabel: string;
  paidLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין לאישור",
  ACTIVE: "פעיל",
  SUSPENDED: "מושהה",
};

export default function AffiliateRow({ affiliate }: { affiliate: Affiliate }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: affiliate.id, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "הפעולה נכשלה");
      return;
    }
    router.refresh();
  }

  async function editTerms() {
    const rate = prompt("אחוז עמלה (0-100):", String(affiliate.ratePercent));
    if (rate === null) return;
    const bounty = prompt(
      "בונוס הרשמה באגורות (0 = ללא):",
      String(affiliate.signupBountyAgorot),
    );
    if (bounty === null) return;
    await patch({ ratePercent: Number(rate), signupBountyAgorot: Number(bounty) });
  }

  return (
    <li className="card flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-56 flex-1">
        <p className="font-semibold">
          <span className="font-mono" dir="ltr">
            /r/{affiliate.code}
          </span>{" "}
          <span className="chip">{STATUS_LABEL[affiliate.status] ?? affiliate.status}</span>
        </p>
        <p className="text-xs text-ink-500">
          {affiliate.displayName} · {affiliate.email}
        </p>
        <p className="text-xs text-ink-500">
          {affiliate.clicks} קליקים · {affiliate.referrals} הרשמות · {affiliate.ratePercent}% עמלה ·
          ממתין {affiliate.pendingLabel} · שולם {affiliate.paidLabel}
        </p>
        {affiliate.payoutNotes && (
          <p className="text-xs text-ink-500">פרטי תשלום: {affiliate.payoutNotes}</p>
        )}
        {error && <p className="text-xs text-brand-700">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={editTerms}>
          תנאים
        </button>
        {affiliate.status !== "ACTIVE" ? (
          <button className="btn-primary" disabled={busy} onClick={() => patch({ status: "ACTIVE" })}>
            אישור
          </button>
        ) : (
          <button
            className="btn-ghost text-brand-700"
            disabled={busy}
            onClick={() => patch({ status: "SUSPENDED" })}
          >
            השהיה
          </button>
        )}
      </div>
    </li>
  );
}
