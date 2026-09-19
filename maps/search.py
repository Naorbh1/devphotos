#!/usr/bin/env python3
"""
איסוף עסקים מ-Google Maps לפי שאילתה ואזור, וייצוא ל-CSV/JSON.

הכלי משתמש ב-Places API הרשמי (Text Search). מכיוון שכל שאילתה מחזירה לכל
היותר 60 תוצאות, לכיסוי אזור שלם הכלי מחלק את השטח לרשת תאים, שולח שאילתה
נפרדת לכל תא ומאחד את התוצאות ללא כפילויות. תא ש"מתמלא" (מחזיר 60 תוצאות)
מפוצל אוטומטית לארבעה תאים קטנים יותר - כך מגיעים למאות עסקים באזור צפוף.

שימוש:
    export GOOGLE_MAPS_API_KEY=...

    # חיפוש פשוט סביב עיר
    python maps/search.py "מסעדות" --location "תל אביב" --radius 5 --csv out.csv

    # כיסוי מלא של אזור צפוף: רשת 3x3 עם פיצול אוטומטי
    python maps/search.py "מספרה" --location "תל אביב" --radius 15 --grid 3 --auto-split

    # סינון וייצוא
    python maps/search.py "בית קפה" --center 32.0853,34.7818 --radius 3 \
        --type cafe --min-rating 4 --max-results 300 --csv cafes.csv --json cafes.json

    # לראות כמה זה יעלה לפני ששולחים קריאות בתשלום
    python maps/search.py "מוסך" --location "באר שבע" --radius 8 --grid 3 --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from places_api import (  # noqa: E402 - אחרי תיקון sys.path, כדי לאפשר הרצה מכל תיקייה
    MAX_PER_QUERY,
    TIER_ORDER,
    PlacesClient,
    PlacesError,
    bbox_from_center,
    bbox_width_km,
    flatten_place,
    split_bbox,
    write_csv,
    write_json,
)

# תא קטן מזה כבר לא שווה לפצל - העלות עולה והתוצאות חוזרות על עצמן.
MIN_TILE_KM = 0.4


def parse_center(value: str) -> tuple[float, float]:
    try:
        lat_str, lng_str = value.split(",")
        return float(lat_str), float(lng_str)
    except ValueError:
        raise argparse.ArgumentTypeError("--center צריך להיות בפורמט lat,lng (למשל 32.0853,34.7818)")


def collect(
    client: PlacesClient,
    query: str,
    tiles: list[tuple[float, float, float, float]],
    args: argparse.Namespace,
) -> list[dict]:
    """
    עובר על התאים, אוסף תוצאות ומאחד לפי place_id (סדר הגילוי נשמר).
    התור מחזיק זוגות של (תא, עומק פיצול) כדי להגביל את עומק הפיצול האוטומטי.
    """
    found: dict[str, dict] = {}
    queue: list[tuple[tuple[float, float, float, float], int]] = [(t, 0) for t in tiles]
    processed = 0

    while queue:
        tile, tile_depth = queue.pop(0)
        processed += 1
        try:
            places = client.search_text(
                query,
                tier=args.tier,
                rectangle=tile,
                included_type=args.type,
                strict_type=args.strict_type,
                min_rating=args.min_rating,
                open_now=args.open_now,
                rank=args.rank,
                use_cache=not args.no_cache,
            )
        except PlacesError as exc:
            print(f"\n  תא נכשל, ממשיך הלאה: {exc}", file=sys.stderr)
            continue

        for place in places:
            pid = place.get("id")
            if pid and pid not in found:
                found[pid] = place

        print(
            f"\r[{processed} תאים נסרקו, {len(queue)} בתור] נאספו {len(found)} עסקים ייחודיים...",
            end="",
            file=sys.stderr,
            flush=True,
        )

        # תא שהחזיר את התקרה כנראה "חתך" תוצאות - מפצלים אותו לארבעה.
        if (
            args.auto_split
            and len(places) >= MAX_PER_QUERY
            and tile_depth < args.max_depth
            and bbox_width_km(tile) > MIN_TILE_KM
        ):
            queue.extend((sub, tile_depth + 1) for sub in split_bbox(tile, 2))

        if args.max_results and len(found) >= args.max_results:
            break

    print(file=sys.stderr)
    places = list(found.values())
    return places[: args.max_results] if args.max_results else places


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="איסוף עסקים מ-Google Maps (Places API) לפי שאילתה ואזור",
    )
    parser.add_argument("query", help='מה לחפש, למשל "מסעדה איטלקית" או "מוסך"')

    where = parser.add_argument_group("אזור החיפוש")
    where.add_argument("--location", help='שם מקום לחיפוש סביבו, למשל "חיפה" (מתורגם לקואורדינטות)')
    where.add_argument("--center", type=parse_center, help="קואורדינטות מרכז בפורמט lat,lng")
    where.add_argument("--radius", type=float, default=5.0, help='רדיוס האזור בק"מ (ברירת מחדל: 5)')
    where.add_argument("--grid", type=int, default=1, help="חלוקה לרשת NxN תאים (ברירת מחדל: 1)")
    where.add_argument(
        "--auto-split",
        action="store_true",
        help="פיצול אוטומטי של תאים שהגיעו לתקרת 60 התוצאות (מומלץ לאזורים צפופים)",
    )
    where.add_argument("--max-depth", type=int, default=3, help="עומק פיצול אוטומטי מקסימלי (ברירת מחדל: 3)")

    filters = parser.add_argument_group("סינון")
    filters.add_argument("--type", help="סינון לסוג מקום של Places, למשל restaurant או dentist")
    filters.add_argument("--strict-type", action="store_true", help="סינון סוג קשיח (רק התאמה מדויקת)")
    filters.add_argument("--min-rating", type=float, help="דירוג מינימלי (0.0-5.0)")
    filters.add_argument("--open-now", action="store_true", help="רק עסקים שפתוחים כרגע")
    filters.add_argument(
        "--rank",
        choices=["RELEVANCE", "DISTANCE"],
        help="סדר דירוג התוצאות (ברירת המחדל של ה-API: רלוונטיות)",
    )
    filters.add_argument(
        "--max-results", type=int, default=0, help="עצירה אחרי N עסקים ייחודיים (0 = בלי הגבלה)"
    )

    out = parser.add_argument_group("פלט והתנהגות")
    out.add_argument("--tier", choices=TIER_ORDER, default="contact", help="אילו שדות לבקש (ברירת מחדל: contact)")
    out.add_argument("--csv", dest="csv_path", help="נתיב לייצוא CSV (נפתח נכון ב-Excel)")
    out.add_argument("--json", dest="json_path", help="נתיב לייצוא JSON גולמי (קלט ל-maps/details.py)")
    out.add_argument("--language", help="קוד שפה לתוצאות (ברירת מחדל: he)")
    out.add_argument("--region", help="קוד מדינה (ברירת מחדל: IL)")
    out.add_argument("--qps", type=float, default=0.0, help="הגבלת קצב: מקסימום קריאות בשנייה (0 = בלי הגבלה)")
    out.add_argument("--no-cache", action="store_true", help="בלי מטמון מקומי (ישלם שוב על אותן שאילתות)")
    out.add_argument("--dry-run", action="store_true", help="הדפסת תוכנית החיפוש בלי לשלוח קריאות בתשלום")
    return parser


def print_results(rows: list[dict], query: str, label: str) -> None:
    print("\n" + "=" * 70)
    print(f"שאילתה: {query}  |  אזור: {label}  |  עסקים ייחודיים: {len(rows)}")
    print("=" * 70)
    for row in rows[:15]:
        rating = f"{row['rating']}★ ({row['reviews_count']} ביקורות)" if row["rating"] != "" else "אין דירוג"
        print(f"  {row['name']} — {row['address']}")
        print(f"     {rating}  {row['phone'] or 'אין טלפון'}  {row['website']}".rstrip())
    if len(rows) > 15:
        print(f"  ... ועוד {len(rows) - 15} עסקים (ראו את קובץ הייצוא)")


def main() -> int:
    args = build_parser().parse_args()

    if not args.location and not args.center:
        print("חובה לציין --location או --center", file=sys.stderr)
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
        if args.center:
            lat, lng = args.center
            label = f"{lat:.4f},{lng:.4f}"
        else:
            lat, lng, label = client.geocode(args.location)
    except PlacesError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    bbox = bbox_from_center(lat, lng, args.radius)
    tiles = split_bbox(bbox, max(1, args.grid))

    print(
        f'חיפוש "{args.query}" סביב {label} '
        f'(רדיוס {args.radius} ק"מ, {len(tiles)} תאים, מפלס {args.tier})',
        file=sys.stderr,
    )

    if args.dry_run:
        print("--dry-run: התאים שהיו נסרקים (south, west, north, east):", file=sys.stderr)
        for tile in tiles:
            print("  " + ", ".join(f"{v:.5f}" for v in tile), file=sys.stderr)
        print(
            f'עד {len(tiles) * MAX_PER_QUERY} תוצאות, עד {len(tiles) * 3} קריאות בתשלום '
            "(לפני פיצול אוטומטי). לא נשלחו קריאות.",
            file=sys.stderr,
        )
        return 0

    places = collect(client, args.query, tiles, args)
    rows = [flatten_place(p) for p in places]
    print_results(rows, args.query, label)

    if args.csv_path:
        write_csv(rows, args.csv_path)
        print(f"\nנשמרו {len(rows)} שורות ל-{args.csv_path}")
    if args.json_path:
        write_json(places, args.json_path)
        print(f"ה-JSON הגולמי נשמר ל-{args.json_path}")
    if not args.csv_path and not args.json_path:
        print("\n(טיפ: הוסיפו --csv out.csv או --json out.json כדי לשמור את התוצאות)")

    print("\n" + client.usage_report(), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
