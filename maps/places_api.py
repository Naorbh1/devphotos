#!/usr/bin/env python3
"""
שכבת גישה משותפת ל-Google Places API (New) ול-Geocoding API.

הקובץ הזה לא נועד להרצה ישירה - הוא ה"מנוע" שמשמש את maps/search.py
ואת maps/details.py: אימות, field masks לפי מפלס חיוב, ניסיונות חוזרים עם
backoff, מטמון מקומי (כדי לא לשלם פעמיים על אותה שאילתה), וספירת קריאות.

הערה חשובה: הכלים כאן משתמשים ב-API הרשמי של Google ולא מגרדים את ממשק
המשתמש של maps.google.com. גירוד ה-HTML של Maps מפר את תנאי השימוש של Google,
נשבר בכל שינוי עיצוב וחוסם IP-ים - ה-API הרשמי מחזיר את אותם נתונים בצורה
יציבה ומותרת.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("חסרה חבילת requests. הריצו: pip install -r maps/requirements.txt", file=sys.stderr)
    sys.exit(1)

PLACES_BASE = "https://places.googleapis.com/v1"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

DEFAULT_LANGUAGE = os.environ.get("GOOGLE_MAPS_LANGUAGE", "he")
DEFAULT_REGION = os.environ.get("GOOGLE_MAPS_REGION", "IL")
DEFAULT_CACHE_DIR = os.environ.get("GOOGLE_MAPS_CACHE", ".maps_cache")

# תקרת התוצאות של Text Search: 20 לעמוד, 3 עמודים לכל שאילתה.
PAGE_SIZE = 20
MAX_PAGES = 3
MAX_PER_QUERY = PAGE_SIZE * MAX_PAGES

# קילומטר אחד במעלות רוחב (קו האורך מתוקן לפי cos(lat) בהמשך).
KM_PER_DEGREE = 111.32

# השדות מחולקים למפלסים לפי אופן החיוב של Places API. כל מפלס גבוה יותר
# מייקר את המחיר לאלף קריאות, ולכן שווה לבקש רק את מה שצריך באמת.
#   basic    - זהות, כתובת, מיקום, סוג (המפלס הזול)
#   contact  - מוסיף טלפון, אתר, דירוג ושעות פתיחה
#   full     - מוסיף ביקורות ותקציר עריכה (המפלס היקר)
FIELD_TIERS: dict[str, list[str]] = {
    "basic": [
        "id",
        "displayName",
        "formattedAddress",
        "shortFormattedAddress",
        "location",
        "googleMapsUri",
        "primaryType",
        "primaryTypeDisplayName",
        "types",
        "businessStatus",
    ],
    "contact": [
        "nationalPhoneNumber",
        "internationalPhoneNumber",
        "websiteUri",
        "rating",
        "userRatingCount",
        "priceLevel",
        "regularOpeningHours",
    ],
    "full": [
        "editorialSummary",
        "reviews",
    ],
}
TIER_ORDER = ["basic", "contact", "full"]


def fields_for_tier(tier: str) -> list[str]:
    """כל השדות עד המפלס המבוקש ועד בכלל."""
    if tier not in TIER_ORDER:
        raise ValueError(f"מפלס לא מוכר: {tier} (אפשרויות: {', '.join(TIER_ORDER)})")
    fields: list[str] = []
    for name in TIER_ORDER[: TIER_ORDER.index(tier) + 1]:
        fields.extend(FIELD_TIERS[name])
    return fields


class PlacesError(RuntimeError):
    """שגיאה שהוחזרה מה-API (או כשל רשת שלא השתקם אחרי ניסיונות חוזרים)."""


class PlacesClient:
    def __init__(
        self,
        api_key: str | None = None,
        language: str = DEFAULT_LANGUAGE,
        region: str = DEFAULT_REGION,
        cache_dir: str | None = DEFAULT_CACHE_DIR,
        min_interval: float = 0.0,
        max_retries: int = 4,
        quiet: bool = False,
    ):
        self.api_key = api_key or os.environ.get("GOOGLE_MAPS_API_KEY", "")
        if not self.api_key:
            raise PlacesError(
                "לא נמצא מפתח API. הגדירו GOOGLE_MAPS_API_KEY (ראו maps/README.md)."
            )
        self.language = language
        self.region = region
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.min_interval = min_interval
        self.max_retries = max_retries
        self.quiet = quiet
        self.session = requests.Session()
        self._last_call = 0.0
        # ספירת קריאות בתשלום (לא כולל פגיעות מטמון) לצורך דיווח עלות.
        self.calls: dict[str, int] = {}
        self.cache_hits = 0

    # ---------- תשתית ----------

    def _log(self, message: str) -> None:
        if not self.quiet:
            print(message, file=sys.stderr, flush=True)

    def _cache_path(self, key_parts: Any) -> Path | None:
        if not self.cache_dir:
            return None
        blob = json.dumps(key_parts, sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:32]
        return self.cache_dir / f"{digest}.json"

    def _throttle(self) -> None:
        if self.min_interval <= 0:
            return
        wait = self.min_interval - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)

    def _request(self, method: str, url: str, label: str, **kwargs) -> dict:
        """שולח בקשה עם ניסיונות חוזרים על 429 ועל שגיאות שרת."""
        delay = 2.0
        last_error = ""
        for attempt in range(self.max_retries + 1):
            self._throttle()
            try:
                response = self.session.request(method, url, timeout=30, **kwargs)
                self._last_call = time.monotonic()
            except requests.RequestException as exc:
                last_error = f"שגיאת רשת: {exc}"
            else:
                if response.status_code == 200:
                    self.calls[label] = self.calls.get(label, 0) + 1
                    return response.json()
                last_error = f"HTTP {response.status_code}: {response.text[:400]}"
                # 4xx שאינו 429 לא ישתפר בניסיון נוסף - עוצרים מיד.
                if response.status_code != 429 and response.status_code < 500:
                    raise PlacesError(last_error)
                retry_after = response.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    delay = max(delay, float(retry_after))
            if attempt < self.max_retries:
                self._log(f"  ניסיון חוזר ({attempt + 1}/{self.max_retries}) בעוד {delay:.0f}ש: {last_error[:120]}")
                time.sleep(delay)
                delay *= 2
        raise PlacesError(f"הבקשה נכשלה אחרי {self.max_retries} ניסיונות. {last_error}")

    # ---------- Geocoding ----------

    def geocode(self, address: str) -> tuple[float, float, str]:
        """הופך שם מקום ('תל אביב', 'רחוב הרצל 5 חיפה') לקואורדינטות."""
        params = {
            "address": address,
            "key": self.api_key,
            "language": self.language,
            "region": self.region.lower(),
        }
        cache_path = self._cache_path(["geocode", params["address"], self.language, self.region])
        if cache_path and cache_path.exists():
            self.cache_hits += 1
            data = json.loads(cache_path.read_text(encoding="utf-8"))
        else:
            data = self._request("GET", GEOCODE_URL, "geocoding", params=params)
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

        status = data.get("status")
        if status != "OK" or not data.get("results"):
            raise PlacesError(
                f"לא הצלחתי לאתר את '{address}' (status={status}). "
                f"{data.get('error_message', '')}".strip()
            )
        top = data["results"][0]
        loc = top["geometry"]["location"]
        return loc["lat"], loc["lng"], top.get("formatted_address", address)

    # ---------- Places: Text Search ----------

    def search_text(
        self,
        query: str,
        *,
        tier: str = "contact",
        rectangle: tuple[float, float, float, float] | None = None,
        circle: tuple[float, float, float] | None = None,
        included_type: str | None = None,
        strict_type: bool = False,
        min_rating: float | None = None,
        open_now: bool = False,
        rank: str | None = None,
        max_results: int = MAX_PER_QUERY,
        use_cache: bool = True,
    ) -> list[dict]:
        """
        Text Search עם דפדוף אוטומטי. מחזיר עד 60 תוצאות לשאילתה - זו תקרה
        של ה-API עצמו, ולכן לכיסוי רחב יותר משתמשים בחלוקה לתאים (ראו search.py).

        rectangle: (south, west, north, east) - הגבלה קשיחה לתיבה.
        circle:    (lat, lng, radius_meters) - העדפה רכה סביב נקודה.
        """
        field_names = fields_for_tier(tier)
        field_mask = ",".join(f"places.{f}" for f in field_names) + ",nextPageToken"

        body: dict[str, Any] = {
            "textQuery": query,
            "languageCode": self.language,
            "regionCode": self.region,
            "pageSize": min(PAGE_SIZE, max_results),
        }
        if rectangle:
            south, west, north, east = rectangle
            body["locationRestriction"] = {
                "rectangle": {
                    "low": {"latitude": south, "longitude": west},
                    "high": {"latitude": north, "longitude": east},
                }
            }
        elif circle:
            lat, lng, radius = circle
            body["locationBias"] = {
                "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius)}
            }
        if included_type:
            body["includedType"] = included_type
            if strict_type:
                body["strictTypeFiltering"] = True
        if min_rating is not None:
            body["minRating"] = min_rating
        if open_now:
            body["openNow"] = True
        if rank:
            body["rankPreference"] = rank

        places: list[dict] = []
        page_token: str | None = None
        for _ in range(MAX_PAGES):
            page_body = dict(body)
            if page_token:
                page_body["pageToken"] = page_token
            data = self._call_places(
                f"{PLACES_BASE}/places:searchText",
                page_body,
                field_mask,
                label=f"searchText[{tier}]",
                use_cache=use_cache,
            )
            places.extend(data.get("places", []))
            page_token = data.get("nextPageToken")
            if not page_token or len(places) >= max_results:
                break
        return places[:max_results]

    # ---------- Places: Nearby Search ----------

    def search_nearby(
        self,
        lat: float,
        lng: float,
        radius_m: float,
        *,
        tier: str = "contact",
        included_types: list[str] | None = None,
        rank: str = "POPULARITY",
        max_results: int = PAGE_SIZE,
        use_cache: bool = True,
    ) -> list[dict]:
        """Nearby Search - מחזיר עד 20 תוצאות, בלי דפדוף (מגבלת ה-API)."""
        field_names = fields_for_tier(tier)
        field_mask = ",".join(f"places.{f}" for f in field_names)
        body: dict[str, Any] = {
            "languageCode": self.language,
            "regionCode": self.region,
            "maxResultCount": min(PAGE_SIZE, max_results),
            "rankPreference": rank,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": float(radius_m),
                }
            },
        }
        if included_types:
            body["includedTypes"] = included_types
        data = self._call_places(
            f"{PLACES_BASE}/places:searchNearby",
            body,
            field_mask,
            label=f"searchNearby[{tier}]",
            use_cache=use_cache,
        )
        return data.get("places", [])[:max_results]

    # ---------- Places: Place Details ----------

    def place_details(
        self,
        place_id: str,
        *,
        tier: str = "full",
        use_cache: bool = True,
    ) -> dict:
        """פרטי מקום מלאים לפי place_id (כולל ביקורות במפלס full)."""
        field_mask = ",".join(fields_for_tier(tier))
        place_id = place_id.removeprefix("places/")
        url = f"{PLACES_BASE}/places/{place_id}"
        params = {"languageCode": self.language, "regionCode": self.region}
        cache_path = self._cache_path(["details", place_id, field_mask, params])
        if use_cache and cache_path and cache_path.exists():
            self.cache_hits += 1
            return json.loads(cache_path.read_text(encoding="utf-8"))
        data = self._request(
            "GET",
            url,
            f"placeDetails[{tier}]",
            params=params,
            headers={"X-Goog-Api-Key": self.api_key, "X-Goog-FieldMask": field_mask},
        )
        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return data

    # ---------- פנימי ----------

    def _call_places(
        self, url: str, body: dict, field_mask: str, *, label: str, use_cache: bool
    ) -> dict:
        cache_path = self._cache_path([url, body, field_mask])
        if use_cache and cache_path and cache_path.exists():
            self.cache_hits += 1
            return json.loads(cache_path.read_text(encoding="utf-8"))
        data = self._request(
            "POST",
            url,
            label,
            json=body,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": field_mask,
            },
        )
        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return data

    # ---------- דיווח ----------

    def usage_report(self) -> str:
        if not self.calls:
            return f"לא בוצעו קריאות בתשלום (פגיעות מטמון: {self.cache_hits})."
        lines = [f"קריאות API בתשלום (פגיעות מטמון: {self.cache_hits}):"]
        for label, count in sorted(self.calls.items()):
            lines.append(f"  {label:<26} {count}")
        total_label = 'סה"כ'
        lines.append(f"  {total_label:<26} {sum(self.calls.values())}")
        lines.append(
            "  המחיר לאלף קריאות משתנה לפי המפלס (basic/contact/full) - "
            "ראו את מחירון Places API המעודכן של Google."
        )
        return "\n".join(lines)


# ---------- עזרי גאומטריה לחלוקה לתאים ----------


def bbox_from_center(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """תיבה חוסמת (south, west, north, east) סביב נקודה ברדיוס נתון בק\"מ."""
    d_lat = radius_km / KM_PER_DEGREE
    d_lng = radius_km / (KM_PER_DEGREE * max(math.cos(math.radians(lat)), 0.01))
    return (lat - d_lat, lng - d_lng, lat + d_lat, lng + d_lng)


def split_bbox(bbox: tuple[float, float, float, float], n: int) -> list[tuple[float, float, float, float]]:
    """מחלק תיבה לרשת n x n תיבות קטנות."""
    south, west, north, east = bbox
    lat_step = (north - south) / n
    lng_step = (east - west) / n
    tiles = []
    for i in range(n):
        for j in range(n):
            tiles.append(
                (south + i * lat_step, west + j * lng_step, south + (i + 1) * lat_step, west + (j + 1) * lng_step)
            )
    return tiles


def bbox_width_km(bbox: tuple[float, float, float, float]) -> float:
    """רוחב התיבה בק\"מ (לפי הצלע הארוכה), לצורך החלטה אם כדאי לפצל אותה."""
    south, west, north, east = bbox
    mid_lat = (south + north) / 2
    height = (north - south) * KM_PER_DEGREE
    width = (east - west) * KM_PER_DEGREE * max(math.cos(math.radians(mid_lat)), 0.01)
    return max(height, width)


# ---------- שיטוח לטבלה ----------

CSV_COLUMNS = [
    "place_id",
    "name",
    "primary_type",
    "address",
    "lat",
    "lng",
    "phone",
    "phone_intl",
    "website",
    "maps_url",
    "rating",
    "reviews_count",
    "price_level",
    "business_status",
    "opening_hours",
    "types",
    "summary",
]


def flatten_place(place: dict) -> dict:
    """הופך תשובת Places מקוננת לשורה שטוחה לייצוא CSV/גיליון."""
    location = place.get("location") or {}
    hours = place.get("regularOpeningHours") or {}
    return {
        "place_id": place.get("id", ""),
        "name": (place.get("displayName") or {}).get("text", ""),
        "primary_type": (place.get("primaryTypeDisplayName") or {}).get("text", place.get("primaryType", "")),
        "address": place.get("formattedAddress", ""),
        "lat": location.get("latitude", ""),
        "lng": location.get("longitude", ""),
        "phone": place.get("nationalPhoneNumber", ""),
        "phone_intl": place.get("internationalPhoneNumber", ""),
        "website": place.get("websiteUri", ""),
        "maps_url": place.get("googleMapsUri", ""),
        "rating": place.get("rating", ""),
        "reviews_count": place.get("userRatingCount", ""),
        "price_level": place.get("priceLevel", ""),
        "business_status": place.get("businessStatus", ""),
        "opening_hours": " | ".join(hours.get("weekdayDescriptions", [])),
        "types": ", ".join(place.get("types", [])),
        "summary": (place.get("editorialSummary") or {}).get("text", ""),
    }


def write_csv(rows: list[dict], path: str, columns: list[str] | None = None) -> None:
    """כותב CSV עם BOM כדי ש-Excel יציג עברית נכון."""
    import csv

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns or CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_json(data: Any, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
