"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CITIES, GOAL_LABELS, MAX_AGE, MIN_AGE, SEEKING_LABELS } from "@/lib/constants";

type ProfileInput = {
  displayName: string;
  city: string;
  bio: string;
  goal: string;
  seeking: string;
  heightCm: number | null;
  hasKids: boolean | null;
  smokes: boolean | null;
  prefMinAge: number;
  prefMaxAge: number;
  isVisible: boolean;
};

/** "" = לא ציינתי, "yes"/"no" = ערך מפורש */
function triState(value: boolean | null): string {
  return value === null ? "" : value ? "yes" : "no";
}

function parseTriState(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export default function ProfileForm({ profile }: { profile: ProfileInput }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);

    const form = new FormData(event.currentTarget);
    const heightRaw = form.get("heightCm");

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        city: form.get("city"),
        bio: form.get("bio") || "",
        goal: form.get("goal"),
        seeking: form.get("seeking"),
        heightCm: heightRaw ? Number(heightRaw) : null,
        hasKids: parseTriState(form.get("hasKids")),
        smokes: parseTriState(form.get("smokes")),
        prefMinAge: Number(form.get("prefMinAge")),
        prefMaxAge: Number(form.get("prefMaxAge")),
        prefCities: [],
        isVisible: form.get("isVisible") === "on",
      }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "השמירה נכשלה");
      return;
    }
    setStatus("הפרופיל נשמר");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="displayName">
            שם תצוגה
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field"
            required
            maxLength={40}
            defaultValue={profile.displayName}
          />
        </div>
        <div>
          <label className="label" htmlFor="city">
            עיר מגורים
          </label>
          <select id="city" name="city" className="field" defaultValue={profile.city}>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="bio">
          קצת עליי
        </label>
        <textarea
          id="bio"
          name="bio"
          className="field"
          rows={4}
          maxLength={1000}
          defaultValue={profile.bio}
          placeholder="מה חשוב לכם שידעו עליכם?"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="goal">
            מה אני מחפש/ת
          </label>
          <select id="goal" name="goal" className="field" defaultValue={profile.goal}>
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="seeking">
            מעוניין/ת להכיר
          </label>
          <select id="seeking" name="seeking" className="field" defaultValue={profile.seeking}>
            {Object.entries(SEEKING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="heightCm">
            גובה (ס&quot;מ)
          </label>
          <input
            id="heightCm"
            name="heightCm"
            type="number"
            className="field"
            min={120}
            max={230}
            defaultValue={profile.heightCm ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="hasKids">
            ילדים
          </label>
          <select id="hasKids" name="hasKids" className="field" defaultValue={triState(profile.hasKids)}>
            <option value="">לא מציין/ת</option>
            <option value="yes">יש</option>
            <option value="no">אין</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="smokes">
            עישון
          </label>
          <select id="smokes" name="smokes" className="field" defaultValue={triState(profile.smokes)}>
            <option value="">לא מציין/ת</option>
            <option value="yes">מעשן/ת</option>
            <option value="no">לא מעשן/ת</option>
          </select>
        </div>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label">טווח הגילאים שמעניין אותי</legend>
        <div>
          <label className="label" htmlFor="prefMinAge">
            מגיל
          </label>
          <input
            id="prefMinAge"
            name="prefMinAge"
            type="number"
            className="field"
            min={MIN_AGE}
            max={MAX_AGE}
            defaultValue={profile.prefMinAge}
          />
        </div>
        <div>
          <label className="label" htmlFor="prefMaxAge">
            עד גיל
          </label>
          <input
            id="prefMaxAge"
            name="prefMaxAge"
            type="number"
            className="field"
            min={MIN_AGE}
            max={MAX_AGE}
            defaultValue={profile.prefMaxAge}
          />
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="isVisible" defaultChecked={profile.isVisible} />
        הפרופיל שלי גלוי בחיפוש
      </label>

      {error && <p className="text-sm text-brand-700">{error}</p>}
      {status && <p className="text-sm text-green-700">{status}</p>}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "שומר..." : "שמירה"}
      </button>
    </form>
  );
}
