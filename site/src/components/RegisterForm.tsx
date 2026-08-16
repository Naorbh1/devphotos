"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CITIES, GENDER_LABELS, GOAL_LABELS, MIN_AGE, SEEKING_LABELS } from "@/lib/constants";

export default function RegisterForm({
  defaultCity,
  defaultGoal,
}: {
  defaultCity?: string;
  defaultGoal?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // התאריך המאוחר ביותר שעדיין מאפשר הרשמה
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - MIN_AGE);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        displayName: form.get("displayName"),
        birthDate: form.get("birthDate"),
        gender: form.get("gender"),
        seeking: form.get("seeking"),
        city: form.get("city"),
        goal: form.get("goal"),
        acceptTerms: form.get("acceptTerms") === "on",
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "ההרשמה נכשלה");
      setBusy(false);
      return;
    }

    router.replace("/me");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="displayName">
          שם תצוגה
        </label>
        <input id="displayName" name="displayName" className="field" required maxLength={40} />
      </div>

      <div>
        <label className="label" htmlFor="email">
          אימייל
        </label>
        <input id="email" name="email" type="email" className="field" required autoComplete="email" />
      </div>

      <div>
        <label className="label" htmlFor="password">
          סיסמה
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-ink-500">לפחות 8 תווים.</p>
      </div>

      <div>
        <label className="label" htmlFor="birthDate">
          תאריך לידה
        </label>
        <input
          id="birthDate"
          name="birthDate"
          type="date"
          className="field"
          required
          max={maxBirthDate.toISOString().slice(0, 10)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="gender">
            אני
          </label>
          <select id="gender" name="gender" className="field" required defaultValue="">
            <option value="" disabled>
              בחרו
            </option>
            {Object.entries(GENDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="seeking">
            מחפש/ת
          </label>
          <select id="seeking" name="seeking" className="field" required defaultValue="">
            <option value="" disabled>
              בחרו
            </option>
            {Object.entries(SEEKING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="city">
            עיר מגורים
          </label>
          <select id="city" name="city" className="field" required defaultValue={defaultCity || ""}>
            <option value="" disabled>
              בחרו
            </option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="goal">
            מה מחפשים
          </label>
          <select id="goal" name="goal" className="field" required defaultValue={defaultGoal || ""}>
            <option value="" disabled>
              בחרו
            </option>
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" name="acceptTerms" className="mt-1" required />
        <span>
          אני מאשר/ת שאני בן/בת {MIN_AGE} ומעלה, ומסכים/ה לתנאי השימוש ולמדיניות הפרטיות.
        </span>
      </label>

      {error && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
        {busy ? "רגע..." : "יצירת חשבון"}
      </button>
    </form>
  );
}
