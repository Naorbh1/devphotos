"""
שכבת ה-API העסקית (B2B) שהופכת את פאנל "חכמת ההמונים" לשירות בתשלום
ללקוחות חיצוניים: סוכנויות פרסום/שיווק, צוותי מוצר, יועצי תקשורת ועוד.

הרצה מקומית:
    export ANTHROPIC_API_KEY=...
    pip install -r service/requirements.txt
    uvicorn service.api:app --reload

שימוש (לקוח עם מפתח API):
    curl -X POST http://localhost:8000/v1/questions \\
      -H "X-API-Key: demo-key-please-replace" \\
      -H "Content-Type: application/json" \\
      -d '{"question": "האם כדאי להשיק את המוצר במחיר פרימיום או נגיש?"}'

התגובה כוללת report_id וקישור לדוח HTML מוכן להצגה ללקוח.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from fastapi.responses import HTMLResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from panel.ask import DEFAULT_MODEL, aggregate_results, run_panel  # noqa: E402
from service import clients  # noqa: E402
from service.reports import generate_report  # noqa: E402

PROFILES_FILE = Path(__file__).resolve().parent.parent / "panel" / "profiles.json"

app = FastAPI(
    title="Israeli Panel B2B API",
    description="שירות B2B להרצת 'פאנל דעת קהל סינתטי' עבור בדיקת מסרים, קונספטים ומוצרים.",
    version="1.0.0",
)


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    limit: int | None = Field(default=None, ge=1, le=300, description="הגבלת מספר פרופילים (לבדיקה)")


def _require_client(api_key: str | None) -> dict:
    if not api_key:
        raise HTTPException(status_code=401, detail="חסר header בשם X-API-Key")
    client = clients.get_client(api_key)
    if client is None:
        raise HTTPException(status_code=401, detail="מפתח API לא מוכר")
    return client


@app.get("/v1/me")
def me(x_api_key: str | None = Header(default=None)):
    client = _require_client(x_api_key)
    return {
        "name": client["name"],
        "plan": client["plan"],
        "credits_remaining": clients.credits_remaining(client),
    }


@app.post("/v1/questions")
async def ask_question(req: QuestionRequest, x_api_key: str | None = Header(default=None)):
    client = _require_client(x_api_key)

    ok, message = clients.check_and_consume_credit(x_api_key)
    if not ok:
        raise HTTPException(status_code=402, detail=message)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="השירות לא מוגדר כראוי (חסר ANTHROPIC_API_KEY בצד השרת)")

    import json

    with open(PROFILES_FILE, encoding="utf-8") as f:
        profiles = json.load(f)
    if req.limit:
        profiles = profiles[: req.limit]

    results = await run_panel(profiles, req.question, DEFAULT_MODEL, concurrency=20)
    aggregate = aggregate_results(results)
    report_id, _path = generate_report(req.question, aggregate, DEFAULT_MODEL, client["name"])

    return {
        "report_id": report_id,
        "report_url": f"/v1/reports/{report_id}",
        "answered": aggregate["answered"],
        "total": aggregate["total"],
        "overall": aggregate["overall"],
    }


_REPORT_ID_RE = re.compile(r"^[0-9a-f]{8,32}$")


@app.get("/v1/reports/{report_id}", response_class=HTMLResponse)
def get_report(report_id: str):
    if not _REPORT_ID_RE.match(report_id):
        raise HTTPException(status_code=404, detail="דוח לא נמצא")
    path = Path(__file__).parent / "reports" / f"{report_id}.html"
    if not path.exists():
        raise HTTPException(status_code=404, detail="דוח לא נמצא")
    return path.read_text(encoding="utf-8")
