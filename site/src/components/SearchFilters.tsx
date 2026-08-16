"use client";

import { useRouter } from "next/navigation";
import { CITIES, GOAL_LABELS, MAX_AGE, MIN_AGE } from "@/lib/constants";
import type { SearchParams } from "@/lib/search";

export default function SearchFilters({ params }: { params: SearchParams }) {
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const qs = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value) qs.set(key, value);
    }
    qs.set("page", "1");
    router.push(`/search?${qs}`);
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div>
        <label className="label" htmlFor="gender">
          מגדר
        </label>
        <select id="gender" name="gender" className="field" defaultValue={params.gender}>
          <option value="ANY">הכול</option>
          <option value="FEMALE">נשים</option>
          <option value="MALE">גברים</option>
          <option value="OTHER">אחר</option>
        </select>
      </div>

      <div>
        <label className="label" htmlFor="city">
          עיר
        </label>
        <select id="city" name="city" className="field" defaultValue={params.city}>
          <option value="">כל הארץ</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="minAge">
          מגיל
        </label>
        <input
          id="minAge"
          name="minAge"
          type="number"
          className="field"
          min={MIN_AGE}
          max={MAX_AGE}
          defaultValue={params.minAge}
        />
      </div>

      <div>
        <label className="label" htmlFor="maxAge">
          עד גיל
        </label>
        <input
          id="maxAge"
          name="maxAge"
          type="number"
          className="field"
          min={MIN_AGE}
          max={MAX_AGE}
          defaultValue={params.maxAge}
        />
      </div>

      <div>
        <label className="label" htmlFor="goal">
          סוג קשר
        </label>
        <select id="goal" name="goal" className="field" defaultValue={params.goal}>
          <option value="ANY">הכול</option>
          {Object.entries(GOAL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            name="withPhoto"
            value="true"
            defaultChecked={params.withPhoto}
          />
          עם תמונה בלבד
        </label>
        <button type="submit" className="btn-primary">
          חיפוש
        </button>
      </div>
    </form>
  );
}
