"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "ההתחברות נכשלה");
      setBusy(false);
      return;
    }

    router.replace("/search");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">אימייל</label>
        <input id="email" name="email" type="email" className="field" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">סיסמה</label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
        {busy ? "רגע..." : "כניסה"}
      </button>
    </form>
  );
}
