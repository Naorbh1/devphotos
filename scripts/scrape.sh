#!/usr/bin/env bash
#
# עוטף את maps/search.py בממשק פוזיציוני קצר:
#
#   ./scripts/scrape.sh "<שאילתה>" <lat> <lng> <radius_km> [דגלים נוספים...]
#
# דוגמאות:
#   ./scripts/scrape.sh "coffee shops in Austin TX" 30.2672 -97.7431 5
#   ./scripts/scrape.sh "מסעדות" 32.0853 34.7818 3 --grid 3 --auto-split
#   ./scripts/scrape.sh "מוסך" 31.2530 34.7915 8 --dry-run
#
# כל דגל נוסף מועבר כמו שהוא ל-maps/search.py (ומנצח את ברירות המחדל כאן).
# הפלט נשמר אוטומטית ל-$OUT_DIR (ברירת מחדל: out/) גם ב-CSV וגם ב-JSON.
#
# משתני סביבה:
#   GOOGLE_MAPS_API_KEY  (חובה)
#   SCRAPE_LANGUAGE      ברירת מחדל: en
#   SCRAPE_REGION        ברירת מחדל: US
#   SCRAPE_TIER          ברירת מחדל: contact   (basic | contact | full)
#   OUT_DIR              ברירת מחדל: out
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-python3}"
LANGUAGE="${SCRAPE_LANGUAGE:-en}"
REGION="${SCRAPE_REGION:-US}"
TIER="${SCRAPE_TIER:-contact}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/out}"

usage() {
  sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() { printf '%s\n' "$*" >&2; exit 1; }

is_number() { [[ "$1" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; }

if [[ $# -eq 0 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

# ארבעת הארגומנטים הראשונים נקראים פוזיציונית, לפני כל פענוח דגלים -
# כך lng שלילי כמו -97.7431 לא מתפרש כדגל.
[[ $# -ge 4 ]] || die "חסרים ארגומנטים.
שימוש: $0 \"<שאילתה>\" <lat> <lng> <radius_km> [דגלים נוספים...]
להסבר מלא: $0 --help"

QUERY="$1"; LAT="$2"; LNG="$3"; RADIUS="$4"
shift 4

[[ -n "$QUERY" ]] || die "השאילתה ריקה."
is_number "$LAT"    || die "lat חייב להיות מספר (התקבל: '$LAT')."
is_number "$LNG"    || die "lng חייב להיות מספר (התקבל: '$LNG')."
is_number "$RADIUS" || die "radius_km חייב להיות מספר (התקבל: '$RADIUS')."

# טווחים חוקיים - נבדקים כאן ולא מול ה-API, כדי לא לבזבז קריאה בתשלום.
awk -v v="$LAT" 'BEGIN{exit !(v >= -90 && v <= 90)}'    || die "lat חייב להיות בטווח -90..90 (התקבל: $LAT)."
awk -v v="$LNG" 'BEGIN{exit !(v >= -180 && v <= 180)}'  || die "lng חייב להיות בטווח -180..180 (התקבל: $LNG)."
awk -v v="$RADIUS" 'BEGIN{exit !(v > 0 && v <= 500)}'   || die "radius_km חייב להיות בין 0 ל-500 (התקבל: $RADIUS)."

[[ -n "${GOOGLE_MAPS_API_KEY:-}" ]] || die "לא נמצא מפתח API.
הגדירו: export GOOGLE_MAPS_API_KEY=\"...\"
ראו maps/README.md להפעלת Places API (New) ו-Geocoding API."

command -v "$PYTHON" >/dev/null 2>&1 || die "לא נמצא $PYTHON. התקינו Python 3 או הגדירו PYTHON=<נתיב>."
"$PYTHON" -c 'import requests' 2>/dev/null \
  || die "חסרה חבילת requests. הריצו: pip install -r maps/requirements.txt"

# שם קובץ קריא מהשאילתה. נעשה ב-Python ולא ב-sed/tr כדי לשמור על אותיות
# עברית (ב-locale C המחלקה [:alnum:] לא מכסה אותן, וכל שאילתה בעברית הייתה
# מתקצרת לאותו שם קובץ).
slug="$("$PYTHON" - "$QUERY" <<'PYSLUG'
import re, sys, unicodedata
q = sys.argv[1] if len(sys.argv) > 1 else ""
# מסירים תווים שאינם אותיות/ספרות בכל שפה, ומאחדים רצפים למקף אחד.
cleaned = "".join(
    ch if (unicodedata.category(ch)[0] in "LN") else " " for ch in q.lower()
)
slug = re.sub(r"\s+", "-", cleaned.strip())[:60].strip("-")
print(slug or "scrape")
PYSLUG
)"
[[ -n "$slug" ]] || slug="scrape"
stamp="$(date +%Y%m%d-%H%M%S)"
base="$OUT_DIR/${slug}-${stamp}"

mkdir -p "$OUT_DIR"

printf 'שאילתה: %s\nמרכז: %s,%s  רדיוס: %s ק"מ  שפה/אזור: %s/%s  מפלס: %s\n' \
  "$QUERY" "$LAT" "$LNG" "$RADIUS" "$LANGUAGE" "$REGION" "$TIER" >&2

# הדגלים של המשתמש באים אחרונים בכוונה - argparse נותן עדיפות לאחרון,
# ולכן אפשר לדרוס כל ברירת מחדל שנקבעה כאן (כולל --csv/--json).
exec "$PYTHON" "$REPO_ROOT/maps/search.py" "$QUERY" \
  --center "${LAT},${LNG}" \
  --radius "$RADIUS" \
  --language "$LANGUAGE" \
  --region "$REGION" \
  --tier "$TIER" \
  --csv "${base}.csv" \
  --json "${base}.json" \
  "$@"
