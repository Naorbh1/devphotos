"""
ניהול לקוחות עסקיים (B2B) לשירות הפאנל: מפתחות API, תוכנית תמחור ומכסת
קרדיטים חודשית. מימוש מינימלי מבוסס קובץ JSON - מספיק ל-MVP עם מספר לקוחות
בודדים; בשלב הצמיחה יש להחליף באחסון אמיתי (Postgres/SQLite + טבלת שימוש).

קרדיט אחד = הרצה אחת של שאלה מול הפאנל (עד ~220 פרופילים).
"""
import json
from datetime import date
from pathlib import Path

CLIENTS_FILE = Path(__file__).parent / "clients.json"

PLANS = {
    # tier: (credits_per_month, price_ils)
    "report": {"credits_per_month": 1, "price_ils": 2000, "label": "דוח חד-פעמי"},
    "retainer": {"credits_per_month": 6, "price_ils": 6000, "label": "מנוי חודשי לסוכנויות"},
    "enterprise": {"credits_per_month": 20, "price_ils": 15000, "label": "מנוי Enterprise / White-label"},
}


def _load() -> dict:
    if not CLIENTS_FILE.exists():
        return {}
    with open(CLIENTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save(data: dict) -> None:
    with open(CLIENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_client(api_key: str) -> dict | None:
    return _load().get(api_key)


def _reset_if_new_month(client: dict) -> dict:
    this_month = date.today().strftime("%Y-%m")
    if client.get("period") != this_month:
        client["period"] = this_month
        client["credits_used"] = 0
    return client


def check_and_consume_credit(api_key: str) -> tuple[bool, str]:
    """בודק שללקוח יש קרדיט פנוי ומנכה יחידה אחת. מחזיר (הצלחה, הודעה)."""
    data = _load()
    client = data.get(api_key)
    if client is None:
        return False, "מפתח API לא מוכר"
    if not client.get("active", True):
        return False, "החשבון מושהה - יש ליצור קשר עם התמיכה"

    client = _reset_if_new_month(client)
    plan = PLANS.get(client["plan"])
    if plan is None:
        return False, f"תוכנית לא מוכרת: {client['plan']}"

    if client["credits_used"] >= plan["credits_per_month"]:
        return False, "מכסת הקרדיטים החודשית נוצלה - יש לשדרג תוכנית או להמתין לחידוש"

    client["credits_used"] += 1
    data[api_key] = client
    _save(data)
    return True, "אושר"


def credits_remaining(client: dict) -> int:
    client = _reset_if_new_month(dict(client))
    plan = PLANS[client["plan"]]
    return max(0, plan["credits_per_month"] - client["credits_used"])
