"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Report = {
  id: string;
  reason: string;
  details: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  reporterEmail: string;
  reportedUserId: string;
  reportedEmail: string;
  reportedName: string;
  reportedStatus: string;
  photoId: string | null;
  messageBody: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "פתוח",
  RESOLVED: "טופל",
  DISMISSED: "נדחה",
};

export default function ReportRow({ report }: { report: Report }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function resolve(status: "RESOLVED" | "DISMISSED") {
    const resolution = prompt("הערת טיפול (לא חובה):", "") ?? "";
    setBusy(true);
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: report.id, status, resolution }),
    });
    setBusy(false);
    if (!res.ok) {
      setNote("הפעולה נכשלה");
      return;
    }
    router.refresh();
  }

  async function moderateUser(status: "SUSPENDED" | "BANNED" | "ACTIVE") {
    const reason =
      status === "ACTIVE" ? "" : (prompt("סיבה (תוצג למשתמש בכניסה):", report.reason) ?? "");
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: report.reportedUserId, status, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNote(data.error || "הפעולה נכשלה");
      return;
    }
    router.refresh();
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start gap-3">
        {report.photoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${report.photoId}`}
            alt=""
            className="size-24 rounded-lg bg-ink-100 object-cover"
          />
        )}

        <div className="min-w-64 flex-1 space-y-1 text-sm">
          <p className="font-semibold">
            {report.reason}{" "}
            <span className="chip">{STATUS_LABEL[report.status] ?? report.status}</span>
          </p>
          {report.details && <p className="text-ink-700">{report.details}</p>}
          {report.messageBody && (
            <p className="rounded-lg bg-ink-100 p-2 text-ink-700">״{report.messageBody}״</p>
          )}
          <p className="text-xs text-ink-500">
            על:{" "}
            <Link href={`/profile/${report.reportedUserId}`} className="hover:underline">
              {report.reportedName}
            </Link>{" "}
            ({report.reportedEmail}) · סטטוס משתמש: {report.reportedStatus}
          </p>
          <p className="text-xs text-ink-500">
            מדווח: {report.reporterEmail} · {new Date(report.createdAt).toLocaleString("he-IL")}
          </p>
          {report.resolution && (
            <p className="text-xs text-ink-500">הערת טיפול: {report.resolution}</p>
          )}
          {note && <p className="text-xs text-brand-700">{note}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {report.status === "OPEN" && (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => resolve("RESOLVED")}>
                סמן כטופל
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => resolve("DISMISSED")}>
                דחיית הדיווח
              </button>
            </>
          )}
          {report.reportedStatus === "ACTIVE" ? (
            <>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => moderateUser("SUSPENDED")}
              >
                השעיה
              </button>
              <button
                className="btn-ghost text-brand-700"
                disabled={busy}
                onClick={() => moderateUser("BANNED")}
              >
                חסימה
              </button>
            </>
          ) : (
            <button className="btn-secondary" disabled={busy} onClick={() => moderateUser("ACTIVE")}>
              החזרת גישה
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
