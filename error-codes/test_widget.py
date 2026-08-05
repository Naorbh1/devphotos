#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בדיקה אוטומטית של הווידג'ט בדפדפן אמיתי (Chromium דרך Playwright).

    python3 error-codes/build.py && python3 error-codes/test_widget.py
"""

import glob
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
PREVIEW = "file://" + os.path.join(ROOT, "dist", "index.html")


def chromium_path():
    """מאתר Chromium מותקן מראש, אם גרסת Playwright מצפה לבניה אחרת."""
    found = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"))
    return found[-1] if found else None

# (יצרן, מכשיר, קלט, טקסט שחייב להופיע בתוצאה)
CASES = [
    ("bosch",      "washer",     "E18",    "ניקוז"),
    ("bosch",      "washer",     "f18",    "ניקוז"),       # אות קטנה + וריאנט F
    ("bosch",      "washer",     " e-18 ", "ניקוז"),       # רווחים ומקף
    ("siemens",    "dishwasher", "E15",    "אקווסטופ"),    # מותג שיורש קודים מבוש
    ("samsung",    "washer",     "4C",     "אספקת מים"),   # alias של 4E
    ("samsung",    "washer",     "SUD",    "קצף"),
    ("lg",         "dryer",      "d90",    "אוורור"),
    ("lg",         "washer",     "1E",     "כניסת מים"),   # בלבול I/1
    ("indesit",    "washer",     "F05",    "מתנקזים"),
    ("electrolux", "dishwasher", "i30",    "הצפה"),
    ("beko",       "washer",     "H1",     "מנעול"),       # alias של E01
    ("miele",      "dishwasher", "F78",    "סחרור"),
]

MISS = [("bosch", "washer", "E28", "האם התכוונתם"),   # קוד לא קיים – מוצעות אפשרויות קרובות
        ("bosch", "washer", "ZZ99", "לא מצאנו")]      # קוד רחוק – פנייה ליצירת קשר


def main():
    failures = []
    with sync_playwright() as p:
        exe = chromium_path()
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(PREVIEW)

        def lookup(brand, device, code):
            page.select_option("#nfx-brand", brand)
            page.select_option("#nfx-device", device)
            page.fill("#nfx-code", code)
            page.click(".nfx-btn")
            return page.inner_text("#nfx-result")

        for brand, device, code, expect in CASES:
            got = lookup(brand, device, code)
            ok = expect in got
            print(("  ✓ " if ok else "  ✗ ") + "%-11s %-11s %-8s → %s"
                  % (brand, device, code.strip(), got.split("\n")[1] if "\n" in got else got[:60]))
            if not ok:
                failures.append("%s/%s/%s: ציפינו ל-'%s', קיבלנו: %s" % (brand, device, code, expect, got[:200]))

        for brand, device, code, expect in MISS:
            got = lookup(brand, device, code)
            ok = expect in got
            print(("  ✓ " if ok else "  ✗ ") + "%-11s %-11s %-8s → טיפול בקוד לא מוכר" % (brand, device, code))
            if not ok:
                failures.append("%s/%s/%s: ציפינו ל-'%s'" % (brand, device, code, expect))

        # מותג ללא נתונים
        page.select_option("#nfx-brand", "crystal")
        page.click(".nfx-btn")
        txt = page.inner_text("#nfx-result")
        ok = "עדיין אין אצלנו" in txt
        print(("  ✓ " if ok else "  ✗ ") + "מותג ללא טבלת קודים מציג פנייה ליצירת קשר")
        if not ok:
            failures.append("מותג ללא נתונים: " + txt[:200])

        # רשימת המכשירים מתעדכנת לפי היצרן
        page.select_option("#nfx-brand", "miele")
        devs = page.eval_on_selector_all("#nfx-device option", "els => els.map(e => e.value).filter(Boolean)")
        ok = devs == ["washer", "dryer", "dishwasher"]
        print(("  ✓ " if ok else "  ✗ ") + "מילה: סוגי מכשירים זמינים = %s" % devs)
        if not ok:
            failures.append("סינון מכשירים למילה: %s" % devs)

        # מספר הצ'יפים תואם למספר הקודים
        page.select_option("#nfx-device", "dishwasher")
        chips = page.eval_on_selector_all("#nfx-chips-list .nfx-chip", "els => els.length")
        ok = chips == 7
        print(("  ✓ " if ok else "  ✗ ") + "מילה/מדיח: %d קודים נפוצים מוצגים" % chips)
        if not ok:
            failures.append("מספר צ'יפים: %d" % chips)

        if errors:
            failures.append("שגיאות JavaScript בקונסולה: %s" % errors[:3])
        browser.close()

    print()
    if failures:
        print("נכשלו %d בדיקות:" % len(failures))
        for f in failures:
            print("  - " + f)
        sys.exit(1)
    print("כל הבדיקות עברו.")


if __name__ == "__main__":
    main()
