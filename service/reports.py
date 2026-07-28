"""
הפקת דוח HTML ללקוח עסקי מתוצאות הרצת פאנל (panel.ask.aggregate_results).
הדוח נשמר תחת service/reports/<report_id>.html ומוגש דרך ה-API.
"""
import html
import uuid
from datetime import datetime
from pathlib import Path

REPORTS_DIR = Path(__file__).parent / "reports"

STANCE_COLORS = {
    "תומך": "#2f9e44",
    "מתנגד": "#e03131",
    "מעורב/תלוי": "#f08c00",
    "לא בטוח": "#868e96",
}

_TEMPLATE = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>דוח חכמת המונים - {question_short}</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", Arial, sans-serif; max-width: 860px;
         margin: 40px auto; padding: 0 20px; color: #1a1a1a; background: #fafafa; }}
  h1 {{ font-size: 1.4rem; }}
  .meta {{ color: #666; font-size: 0.9rem; margin-bottom: 24px; }}
  .card {{ background: #fff; border: 1px solid #e5e5e5; border-radius: 10px;
           padding: 20px 24px; margin-bottom: 20px; }}
  .bar-row {{ display: flex; align-items: center; gap: 10px; margin: 6px 0; }}
  .bar-label {{ width: 130px; font-size: 0.9rem; }}
  .bar-track {{ flex: 1; background: #eee; border-radius: 6px; overflow: hidden; height: 18px; }}
  .bar-fill {{ height: 100%; border-radius: 6px; }}
  .bar-pct {{ width: 60px; text-align: left; font-size: 0.85rem; color: #444; }}
  .breakdown-group {{ margin-bottom: 14px; }}
  .breakdown-key {{ font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }}
  blockquote {{ border-right: 3px solid #ccc; margin: 10px 0; padding: 4px 14px;
                font-style: italic; color: #333; }}
  .quote-src {{ font-size: 0.8rem; color: #777; }}
  .disclaimer {{ font-size: 0.8rem; color: #888; border-top: 1px solid #eee;
                 margin-top: 30px; padding-top: 14px; }}
  .brand {{ font-size: 0.85rem; color: #999; }}
</style>
</head>
<body>
  <div class="brand">חכמת ההמונים | דוח פאנל דעת קהל סינתטי</div>
  <h1>{question}</h1>
  <div class="meta">
    הופק עבור: {client_name} &middot; {generated_at} &middot;
    מודל: {model} &middot; {answered}/{total} פרופילים ענו
  </div>

  <div class="card">
    <h2>התפלגות כללית</h2>
    {overall_bars}
  </div>

  {breakdown_cards}

  <div class="card">
    <h2>ציטוטים מייצגים</h2>
    {quotes_html}
  </div>

  <div class="disclaimer">
    זהו דוח המבוסס על סימולציית פרופילים סינתטיים (LLM) ולא על סקר דעת קהל
    אמיתי או מדגם אקראי מייצג סטטיסטית. הכלי נועד לגיבוש אינטואיציה מהירה
    ולבדיקת "איך זה עשוי להתקבל" אצל קהלים מגוונים - לא כתחליף למחקר שוק,
    סקר דעת קהל מוסמך, או ייעוץ משפטי/רגולטורי.
  </div>
</body>
</html>
"""


def _bar(label: str, n: int, pct: float, color: str) -> str:
    return (
        f'<div class="bar-row">'
        f'<div class="bar-label">{html.escape(label)}</div>'
        f'<div class="bar-track"><div class="bar-fill" style="width:{pct:.1f}%;background:{color}"></div></div>'
        f'<div class="bar-pct">{n} ({pct:.0f}%)</div>'
        f"</div>"
    )


def _render_overall(overall: dict, total_answered: int) -> str:
    if total_answered == 0:
        return "<p>לא התקבלו תשובות תקינות.</p>"
    rows = []
    for stance, n in overall.items():
        pct = 100 * n / total_answered
        rows.append(_bar(stance, n, pct, STANCE_COLORS.get(stance, "#888")))
    return "\n".join(rows)


def _render_breakdowns(breakdowns: dict) -> str:
    cards = []
    for title, groups in breakdowns.items():
        rows = []
        for key, info in groups.items():
            n = info["n"]
            parts = ", ".join(f"{s}: {c}" for s, c in info["stances"].items())
            rows.append(
                f'<div class="breakdown-group"><div class="breakdown-key">'
                f"{html.escape(key)} (n={n})</div>"
                f'<div style="font-size:0.9rem;color:#444">{html.escape(parts)}</div></div>'
            )
        cards.append(
            f'<div class="card"><h2>פילוח לפי {html.escape(title)}</h2>{"".join(rows)}</div>'
        )
    return "\n".join(cards)


def _render_quotes(quotes: dict) -> str:
    if not quotes:
        return "<p>אין ציטוטים זמינים.</p>"
    blocks = []
    for stance, items in quotes.items():
        blocks.append(f"<h3>{html.escape(stance)}</h3>")
        for q in items:
            blocks.append(
                f'<blockquote>&ldquo;{html.escape(q["text"])}&rdquo;'
                f'<div class="quote-src">&mdash; {html.escape(q["name"])}, '
                f'{q["age"]}, {html.escape(q["sector"])}, {html.escape(q["region"])}</div>'
                f"</blockquote>"
            )
    return "\n".join(blocks)


def generate_report(question: str, aggregate: dict, model: str, client_name: str) -> tuple[str, Path]:
    """בונה קובץ HTML לדוח ומחזיר (report_id, path)."""
    REPORTS_DIR.mkdir(exist_ok=True)
    report_id = uuid.uuid4().hex[:12]
    html_doc = _TEMPLATE.format(
        question=html.escape(question),
        question_short=html.escape(question[:60]),
        client_name=html.escape(client_name),
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        model=html.escape(model),
        answered=aggregate["answered"],
        total=aggregate["total"],
        overall_bars=_render_overall(aggregate["overall"], aggregate["answered"]),
        breakdown_cards=_render_breakdowns(aggregate["breakdowns"]),
        quotes_html=_render_quotes(aggregate["quotes"]),
    )
    path = REPORTS_DIR / f"{report_id}.html"
    path.write_text(html_doc, encoding="utf-8")
    return report_id, path
