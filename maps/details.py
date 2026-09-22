#!/usr/bin/env python3
"""
העשרת עסקים שנאספו ב-maps/search.py בפרטים מלאים: טלפון, אתר, שעות פתיחה,
דירוג, תקציר וביקורות (עד 5 ביקורות לעסק - זו מגבלת ה-API).

הקריאות כאן יקרות יותר מחיפוש, ולכן הכלי עובד על רשימה מסוננת: קודם אוספים
ומסננים עם search.py, ואז מעשירים רק את מה שרלוונטי.

שימוש:
    export GOOGLE_MAPS_API_KEY=...

    # העשרת קובץ שנוצר ב-search.py --json
    python maps/details.py --input cafes.json --csv cafes_full.csv --json cafes_full.json

    # העשרה של עסקים בודדים לפי place_id
    python maps/details.py ChIJN1t_tDeuEmsRUsoyG83frY4

    # בלי ביקורות (מפלס זול יותר) ורק 50 הראשונים
    python maps/details.py --input cafes.json --tier contact --limit 50 --csv out.csv
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from places_api import (  # noqa: E402 - אחרי תיקון sys.path, כדי לאפשר הרצה מכל תיקייה
    CSV_COLUMNS,
    TIER_ORDER,
    PlacesClient,
    PlacesError,
    flatten_place,
    write_csv,
    write_json,
)

REVIEW_COLUMNS = ["reviews_text"]


def load_place_ids(path: str) -> list[str]:
    """קורא place_id-ים מקובץ JSON של search.py, מרשימת מזהים או מ-CSV."""
    text = Path(path).read_text(encoding="utf-8-sig")
    if path.endswith(".csv"):
        import csv

        rows = list(csv.DictReader(text.splitlines()))
        return [r["place_id"] for r in rows if r.get("place_id")]

    data = json.loads(text)
    if isinstance(data, list) and data and isinstance(data[0], str):
        return data
    if isinstance(data, list):
        return [p["id"] for p in data if isinstance(p, dict) and p.get("id")]
    raise PlacesError(f"לא זיהיתי place_id-ים בקובץ {path}")


def format_reviews(place: dict, max_reviews: int) -> str:
    """מרכז את הביקורות לעמודה אחת קריאה ב-CSV."""
    parts = []
    for review in (place.get("reviews") or [])[:max_reviews]:
        rating = review.get("rating", "")
        author = (review.get("authorAttribution") or {}).get("displayName", "אנונימי")
        body = (review.get("originalText") or review.get("text") or {}).get("text", "").strip()
        body = " ".join(body.split())
        parts.append(f"[{rating}★ {author}] {body}")
    return " || ".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description="העשרת עסקים מ-Google Maps בפרטים מלאים וביקורות")
    parser.add_argument("place_ids", nargs="*", help="place_id-ים להעשרה (חלופה ל---input)")
    parser.add_argument("--input", help="קובץ JSON/CSV מ-maps/search.py")
    parser.add_argument("--tier", choices=TIER_ORDER, default="full", help="אילו שדות לבקש (ברירת מחדל: full)")
    parser.add_argument("--limit", type=int, default=0, help="העשרת N העסקים הראשונים בלבד (0 = הכל)")
    parser.add_argument("--max-reviews", type=int, default=5, help="מקסימום ביקורות לעסק ב-CSV (ברירת מחדל: 5)")
    parser.add_argument("--csv", dest="csv_path", help="נתיב לייצוא CSV")
    parser.add_argument("--json", dest="json_path", help="נתיב לייצוא JSON גולמי")
    parser.add_argument("--language", help="קוד שפה (ברירת מחדל: he)")
    parser.add_argument("--region", help="קוד מדינה (ברירת מחדל: IL)")
    parser.add_argument("--qps", type=float, default=0.0, help="הגבלת קצב: מקסימום קריאות בשנייה")
    parser.add_argument("--no-cache", action="store_true", help="בלי מטמון מקומי")
    args = parser.parse_args()

    if not args.input and not args.place_ids:
        print("חובה לציין --input <קובץ> או place_id-ים בשורת הפקודה", file=sys.stderr)
        return 2

    client_kwargs: dict = {"min_interval": 1.0 / args.qps if args.qps > 0 else 0.0}
    if args.language:
        client_kwargs["language"] = args.language
    if args.region:
        client_kwargs["region"] = args.region
    if args.no_cache:
        client_kwargs["cache_dir"] = None

    try:
        client = PlacesClient(**client_kwargs)
        place_ids = list(args.place_ids)
        if args.input:
            place_ids.extend(load_place_ids(args.input))
    except PlacesError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    # שמירה על סדר הקלט בלי כפילויות, כדי לא לשלם פעמיים על אותו עסק.
    seen: set[str] = set()
    ordered = [pid for pid in place_ids if not (pid in seen or seen.add(pid))]
    if args.limit:
        ordered = ordered[: args.limit]

    if not ordered:
        print("לא נמצאו place_id-ים להעשרה.", file=sys.stderr)
        return 1

    print(f"מעשיר {len(ordered)} עסקים (מפלס {args.tier})...", file=sys.stderr)
    enriched: list[dict] = []
    failed: list[tuple[str, str]] = []
    for i, pid in enumerate(ordered, 1):
        try:
            place = client.place_details(pid, tier=args.tier, use_cache=not args.no_cache)
            enriched.append(place)
        except PlacesError as exc:
            failed.append((pid, str(exc)))
        print(f"\r[{i}/{len(ordered)}] הושלמו, {len(failed)} נכשלו...", end="", file=sys.stderr, flush=True)
    print(file=sys.stderr)

    # כל הבקשות נכשלו: הרצה כושלת, לא "אין פרטים". לא כותבים קובץ מטעה.
    if failed and not enriched:
        print(
            f"\nההעשרה נכשלה: כל {len(failed)} הבקשות החזירו שגיאה.\n"
            f"השגיאה הראשונה: {failed[0][1]}",
            file=sys.stderr,
        )
        print(client.usage_report(), file=sys.stderr)
        return 1

    rows = []
    for place in enriched:
        row = flatten_place(place)
        row["reviews_text"] = format_reviews(place, args.max_reviews)
        rows.append(row)

    print("\n" + "=" * 70)
    print(f"הועשרו {len(rows)} עסקים מתוך {len(ordered)}")
    print("=" * 70)
    for row in rows[:10]:
        print(f"  {row['name']} — {row['rating'] or '?'}★  {row['phone'] or 'אין טלפון'}  {row['website']}".rstrip())
        if row["opening_hours"]:
            print(f"     שעות: {row['opening_hours'][:90]}")
    if len(rows) > 10:
        print(f"  ... ועוד {len(rows) - 10} עסקים (ראו את קובץ הייצוא)")

    if args.csv_path:
        write_csv(rows, args.csv_path, columns=CSV_COLUMNS + REVIEW_COLUMNS)
        print(f"\nנשמרו {len(rows)} שורות ל-{args.csv_path}")
    if args.json_path:
        write_json(enriched, args.json_path)
        print(f"ה-JSON הגולמי נשמר ל-{args.json_path}")
    if not args.csv_path and not args.json_path:
        print("\n(טיפ: הוסיפו --csv out.csv או --json out.json כדי לשמור את התוצאות)")

    if failed:
        print(f"\n{len(failed)} עסקים נכשלו. דוגמה: {failed[0][0]} — {failed[0][1][:150]}", file=sys.stderr)
    print("\n" + client.usage_report(), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
