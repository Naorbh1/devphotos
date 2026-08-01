#!/usr/bin/env python3
"""
שואל שאלה את כל הפרופילים במאגר (panel/profiles.json) במקביל דרך Claude API,
ומצרף את התשובות לכדי "חכמת ההמונים": התפלגות עמדות כללית, פילוח לפי
מגזר/נטייה פוליטית/גיל, וציטוטים מייצגים.

שימוש:
    export ANTHROPIC_API_KEY=...
    python panel/ask.py "האם צריך להעלות את גיל הפרישה?"

    # הרצה חלקית לבדיקה מהירה / זולה:
    python panel/ask.py "שאלה כלשהי" --limit 20

    # שמירת התוצאות הגולמיות לקובץ:
    python panel/ask.py "שאלה כלשהי" --output results.json

    # שאלה פתוחה (מיפוי כאבים/צרכים) במקום שאלת עמדה:
    python panel/ask.py "מה הכי מעצבן אותך ביומיום?" --open
"""
import argparse
import asyncio
import json
import os
import sys
from collections import Counter, defaultdict

try:
    import anthropic
except ImportError:
    print("חסרה חבילת anthropic. הריצו: pip install -r panel/requirements.txt", file=sys.stderr)
    sys.exit(1)

DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5")
STANCES = ["תומך", "מתנגד", "מעורב/תלוי", "לא בטוח"]
PAY_LEVELS = ["הייתי משלם", "אולי", "לא הייתי משלם"]

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "stance": {"type": "string", "enum": STANCES},
        "answer": {"type": "string"},
    },
    "required": ["stance", "answer"],
    "additionalProperties": False,
}

# מצב שאלה פתוחה: אין עמדה בעד/נגד להצביע עליה, אלא נושא חופשי שהדמות מעלה
# ואינדיקציה אם היא הייתה משלמת על פתרון. מיועד למיפוי כאבים/צרכים.
OPEN_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "pay": {"type": "string", "enum": PAY_LEVELS},
        "answer": {"type": "string"},
    },
    "required": ["topic", "pay", "answer"],
    "additionalProperties": False,
}

OPEN_INSTRUCTIONS = (
    "\n\nענה/י גם על שני שדות נוספים: `topic` - תווית קצרה של 2-4 מילים לתחום שאת/ה מדבר/ת עליו "
    "(למשל \"תורים בקופת חולים\" או \"חניה בעיר\"), ו-`pay` - האם היית משלם/ת מכיסך על פתרון טוב לזה."
)


def build_system_prompt(profile: dict, open_mode: bool = False) -> str:
    prompt = (
        f"את/ה {profile['name']}, בן/בת {profile['age']}, {profile['gender']} שגר/ה ב{profile['region']}.\n"
        f"רקע: {profile['sector']}. נטייה פוליטית: {profile['political_leaning']}. "
        f"עיסוק: {profile['profession']}. מצב משפחתי: {profile['family_status']}.\n"
        f"{profile['background']}\n\n"
        "זוהי סימולציית מחקר לבדיקת מגוון דעות בציבור הישראלי. ענה/י בעברית, בגוף ראשון, "
        "כפי שהדמות הזו הייתה עונה באמת בהתבסס על הרקע, הערכים והנטייה הפוליטית שתוארו - "
        "בכנות ובקצרה (2-4 משפטים), בלי להתנצל על העמדה ובלי לנסות לרצות את כולם. "
        "זו לא בהכרח דעתך האמיתית כעוזר AI - את/ה משחק/ת דמות לצורך מחקר."
    )
    return prompt + OPEN_INSTRUCTIONS if open_mode else prompt


async def ask_one(client: "anthropic.AsyncAnthropic", profile: dict, question: str, model: str, sem: asyncio.Semaphore, open_mode: bool = False):
    async with sem:
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=500,
                system=build_system_prompt(profile, open_mode),
                messages=[{"role": "user", "content": question}],
                output_config={"format": {"type": "json_schema", "schema": OPEN_SCHEMA if open_mode else OUTPUT_SCHEMA}},
            )
            text = next((b.text for b in response.content if b.type == "text"), None)
            if text is None:
                return profile, None, "אין תשובת טקסט"
            data = json.loads(text)
            return profile, data, None
        except Exception as exc:  # noqa: BLE001 - report and continue, don't crash the whole panel
            return profile, None, str(exc)


async def run_panel(profiles: list[dict], question: str, model: str, concurrency: int, open_mode: bool = False):
    client = anthropic.AsyncAnthropic()
    sem = asyncio.Semaphore(concurrency)
    tasks = [ask_one(client, p, question, model, sem, open_mode) for p in profiles]
    results = []
    done = 0
    total = len(tasks)
    for coro in asyncio.as_completed(tasks):
        profile, data, error = await coro
        done += 1
        print(f"\r[{done}/{total}] נאספות תשובות...", end="", file=sys.stderr, flush=True)
        results.append((profile, data, error))
    print(file=sys.stderr)
    return results


def bucket_age(age: int) -> str:
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 50:
        return "35-49"
    if age < 65:
        return "50-64"
    return "65+"


def print_report(question: str, results: list, model: str, open_mode: bool = False):
    ok = [(p, d) for p, d, e in results if d is not None]
    failed = [(p, e) for p, d, e in results if d is None]

    # במצב פתוח מסווגים לפי נכונות לשלם במקום לפי עמדה בעד/נגד
    field, categories = ("pay", PAY_LEVELS) if open_mode else ("stance", STANCES)

    print("\n" + "=" * 70)
    print(f"שאלה: {question}")
    print(f"מודל: {model}  |  פרופילים שנענו בהצלחה: {len(ok)}/{len(results)}")
    print("=" * 70)

    if not ok:
        print("לא התקבלו תשובות תקינות.")
        if failed:
            print(f"דוגמת שגיאה: {failed[0][1]}")
        return

    overall = Counter(d[field] for _, d in ok)
    print("\n--- התפלגות כללית (חכמת ההמונים) ---")
    for category in categories:
        n = overall.get(category, 0)
        pct = 100 * n / len(ok)
        bar = "█" * int(pct / 2)
        print(f"  {category:<14} {n:>4} ({pct:5.1f}%) {bar}")

    if open_mode:
        print("\n--- נושאים שעלו (top 20) ---")
        topics = Counter(d["topic"].strip() for _, d in ok)
        for topic, n in topics.most_common(20):
            pay = Counter(d["pay"] for _, d in ok if d["topic"].strip() == topic)
            parts = ", ".join(f"{c}: {pay[c]}" for c in PAY_LEVELS if pay.get(c))
            print(f"  {topic:<30} (n={n:>3})  {parts}")
        print("\n  (תוויות דומות אינן מאוחדות אוטומטית - הריצו עם --output לניתוח מלא)")

    def breakdown(key_fn, title):
        print(f"\n--- פילוח לפי {title} ---")
        groups = defaultdict(Counter)
        totals = Counter()
        for p, d in ok:
            key = key_fn(p)
            groups[key][d[field]] += 1
            totals[key] += 1
        for key in sorted(groups, key=lambda k: -totals[k]):
            n = totals[key]
            parts = ", ".join(f"{c}: {groups[key].get(c, 0)}" for c in categories if groups[key].get(c, 0))
            print(f"  {key:<20} (n={n:>3})  {parts}")

    breakdown(lambda p: p["sector"], "מגזר")
    breakdown(lambda p: p["political_leaning"], "נטייה פוליטית")
    breakdown(lambda p: bucket_age(p["age"]), "קבוצת גיל")

    print("\n--- ציטוטים מייצגים ---")
    for category in categories:
        quotes = [(p, d) for p, d in ok if d[field] == category]
        if not quotes:
            continue
        print(f"\n  [{category}]")
        import random as _r
        for p, d in _r.Random(1).sample(quotes, k=min(3, len(quotes))):
            print(f"    “{d['answer']}”")
            print(f"      — {p['name']}, {p['age']}, {p['sector']}, {p['region']}")

    if failed:
        print(f"\n({len(failed)} פרופילים נכשלו בקבלת תשובה - לרוב שגיאת רשת/rate limit)")


def main():
    parser = argparse.ArgumentParser(description="שאל שאלה את פאנל הפרופילים הישראלי המגוון")
    parser.add_argument("question", help="השאלה שתישאל לכל הפרופילים")
    parser.add_argument("--profiles-file", default="panel/profiles.json")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--limit", type=int, default=None, help="הגבלת מספר פרופילים (לבדיקה מהירה/זולה)")
    parser.add_argument("--output", default=None, help="שמירת התוצאות הגולמיות לקובץ JSON")
    parser.add_argument("--open", dest="open_mode", action="store_true",
                        help="מצב שאלה פתוחה: נושא חופשי + נכונות לשלם, במקום עמדה בעד/נגד")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("שימו לב: משתנה הסביבה ANTHROPIC_API_KEY לא מוגדר.", file=sys.stderr)

    with open(args.profiles_file, encoding="utf-8") as f:
        profiles = json.load(f)
    if args.limit:
        profiles = profiles[: args.limit]

    print(f"שולח את השאלה ל-{len(profiles)} פרופילים (concurrency={args.concurrency})...", file=sys.stderr)
    results = asyncio.run(run_panel(profiles, args.question, args.model, args.concurrency, args.open_mode))
    print_report(args.question, results, args.model, args.open_mode)

    if args.output:
        serializable = [
            {"profile": p, "result": d, "error": e} for p, d, e in results
        ]
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
        print(f"\nהתוצאות הגולמיות נשמרו ל-{args.output}")


if __name__ == "__main__":
    main()
