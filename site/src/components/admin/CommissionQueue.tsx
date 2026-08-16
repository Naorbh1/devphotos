"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Commission = {
  id: string;
  code: string;
  type: string;
  amountLabel: string;
  status: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "ממתין לאישור",
  APPROVED: "אושר לתשלום",
};

export default function CommissionQueue({ commissions }: { commissions: Commission[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (commissions.length === 0) {
    return <p className="card p-8 text-center text-ink-600">אין עמלות שממתינות לטיפול.</p>;
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function apply(status: "APPROVED" | "PAID" | "REVERSED") {
    if (selected.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/admin/commissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, status }),
    });
    setBusy(false);
    if (res.ok) {
      setSelected([]);
      router.refresh();
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 p-3 text-sm">
        <span className="text-ink-600">{selected.length} נבחרו</span>
        <button className="btn-secondary" disabled={busy || !selected.length} onClick={() => apply("APPROVED")}>
          אישור לתשלום
        </button>
        <button className="btn-primary" disabled={busy || !selected.length} onClick={() => apply("PAID")}>
          סימון כשולם
        </button>
        <button
          className="btn-ghost text-brand-700"
          disabled={busy || !selected.length}
          onClick={() => apply("REVERSED")}
        >
          ביטול
        </button>
      </div>

      <table className="w-full text-right text-sm">
        <thead className="bg-ink-50 text-ink-600">
          <tr>
            <th className="p-3"></th>
            <th className="p-3 font-medium">שותף</th>
            <th className="p-3 font-medium">סוג</th>
            <th className="p-3 font-medium">סכום</th>
            <th className="p-3 font-medium">סטטוס</th>
            <th className="p-3 font-medium">תאריך</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200">
          {commissions.map((c) => (
            <tr key={c.id}>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
              </td>
              <td className="p-3 font-mono" dir="ltr">
                {c.code}
              </td>
              <td className="p-3">{c.type === "SIGNUP" ? "הרשמה" : "תשלום"}</td>
              <td className="p-3 font-medium">{c.amountLabel}</td>
              <td className="p-3">{STATUS_LABEL[c.status] ?? c.status}</td>
              <td className="p-3">{new Date(c.createdAt).toLocaleDateString("he-IL")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
