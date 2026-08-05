#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בונה את מאתר קודי התקלות של נאור פיקס מתוך קובצי ה-JSON שבתיקיית data/.

הרצה:
    python3 error-codes/build.py

הפלט נכתב ל-error-codes/dist/:
    embed-widget.html   – רק הטבלה האינטראקטיבית (להדבקה בדף הראשי)
    embed-seo.html      – אינדקס הקודים + Schema (להדבקה מתחת לטבלה)
    embed-full.html     – שניהם יחד, הדבקה אחת
    schema.jsonld       – ה-Schema בלבד, למי שמזריק אותו דרך הגדרות ה-SEO של האתר
    index.html          – דף תצוגה מקדימה מקומי (לא להעלאה)
    pages/*.html        – דפי נחיתה נפרדים לכל יצרן+מכשיר (תנועה אורגנית)
"""

import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
TPL = os.path.join(ROOT, "template")
DIST = os.path.join(ROOT, "dist")

SEV_LABEL = {"low": "טיפול עצמי אפשרי", "med": "נדרשת בדיקה", "high": "מומלץ להפסיק שימוש"}

# כמה קודים לכל יצרן+מכשיר ייכללו בגרסה המקוצרת (embed-*-lite) שמיועדת לדף הראשי
LITE_LIMIT = 3


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def read_text(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def natural_key(code):
    """מיון טבעי של קודים: E2 לפני E10, וקידומת אותיות לפני מספרים."""
    # כל רכיב מקבל תג טיפוס כדי שאפשר יהיה להשוות קודים מעורבים (E18 מול "OF OF")
    return tuple((0, p_int, "") if p.isdigit() else (1, 0, p.upper())
                 for p, p_int in ((p, int(p) if p.isdigit() else 0)
                                  for p in re.findall(r"\d+|\D+", str(code))))


# --------------------------------------------------------------------------
# טעינת הנתונים
# --------------------------------------------------------------------------
def load():
    site = read_json(os.path.join(DATA, "site.json"))
    tax = read_json(os.path.join(DATA, "taxonomy.json"))

    codes, notes = {}, {}
    for fname in sorted(os.listdir(os.path.join(DATA, "codes"))):
        if not fname.endswith(".json"):
            continue
        blob = read_json(os.path.join(DATA, "codes", fname))
        fam = blob.get("family") or os.path.splitext(fname)[0]
        notes[fam] = blob.get("note", "")
        per_device = {k: v for k, v in blob.items() if k not in ("family", "note")}
        # _o שומר את סדר הכתיבה בקובץ (הנפוצים קודם) לצורך הגרסה המקוצרת,
        # ואילו התצוגה עצמה ממוינת לפי סדר טבעי של הקודים.
        for entries in per_device.values():
            for idx, entry in enumerate(entries):
                entry["_o"] = idx
            entries.sort(key=lambda e: natural_key(e["code"]))
        codes[fam] = per_device

    device_ids = [d["id"] for d in tax["devices"]]
    for fam, per_device in codes.items():
        for dev in per_device:
            if dev not in device_ids:
                sys.exit("שגיאה: סוג המכשיר '%s' (משפחה %s) לא מוגדר ב-taxonomy.json" % (dev, fam))

    brands = []
    for b in tax["brands"]:
        fam = b.get("codesFrom")
        entry = {"id": b["id"], "name": b["name"], "en": b.get("en", "")}
        if fam and fam in codes:
            entry["family"] = fam
            entry["devices"] = [d["id"] for d in tax["devices"] if codes[fam].get(d["id"])]
        else:
            entry["noData"] = True
        brands.append(entry)

    return site, tax["devices"], brands, codes, notes


# --------------------------------------------------------------------------
# עזרים
# --------------------------------------------------------------------------
def primary_brands(brands):
    """המותג הראשי של כל משפחת קודים – עליו נבנים ה-Schema ודפי הנחיתה."""
    seen, out = set(), []
    for b in brands:
        fam = b.get("family")
        if fam and fam not in seen:
            seen.add(fam)
            out.append(b)
    return out


def siblings(brands, family, exclude_id):
    return [b["name"] for b in brands
            if b.get("family") == family and b["id"] != exclude_id]


def device_by_id(devices, did):
    return next(d for d in devices if d["id"] == did)


def answer_text(entry):
    parts = [entry["meaning"]]
    if entry.get("causes"):
        parts.append("סיבות אפשריות: " + "; ".join(entry["causes"]) + ".")
    if entry.get("steps"):
        parts.append("מה לבדוק לפני הזמנת טכנאי: " + "; ".join(entry["steps"]) + ".")
    if entry.get("pro"):
        parts.append("מתי צריך טכנאי: " + entry["pro"])
    return " ".join(parts)


# --------------------------------------------------------------------------
# הווידג'ט
# --------------------------------------------------------------------------
def theme_of(site):
    return "light" if str(site.get("theme", "dark")).lower() == "light" else "dark"


def widget_css(site):
    return (read_text(os.path.join(TPL, "widget.css"))
            .replace("__BRAND__", site["brandColor"])
            .replace("__BRAND_DARK__", site["brandColorDark"])
            .replace("__ACCENT__", site["accentColor"]))


def build_widget(site, devices, brands, codes, notes):
    css = widget_css(site)
    n_codes = sum(len(v) for fam in codes.values() for v in fam.values())
    n_brands = len([b for b in brands if b.get("family")])
    n_devices = len({d for fam in codes.values() for d in fam})
    html = (read_text(os.path.join(TPL, "widget.html"))
            .replace("__THEME__", theme_of(site))
            .replace("__TITLE__", site["widgetTitle"])
            .replace("__SUBTITLE__", esc(site["widgetSubtitle"]))
            .replace("__DISCLAIMER__", esc(site["disclaimer"]))
            .replace("__STAT_CODES__", str(n_codes))
            .replace("__STAT_BRANDS__", str(n_brands))
            .replace("__STAT_DEVICES__", str(n_devices)))
    js = read_text(os.path.join(TPL, "widget.js"))

    lean = {fam: {dev: [{k: v for k, v in e.items() if not k.startswith("_")} for e in entries]
                  for dev, entries in per_device.items()}
            for fam, per_device in codes.items()}
    payload = {
        "site": {k: site[k] for k in ("businessName", "phone", "phoneE164", "whatsapp", "whatsappText")},
        "devices": devices,
        "brands": brands,
        "codes": lean,
        "notes": notes,
    }
    data_js = "window.NFX_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"

    return ("<!-- נאור פיקס · מאתר קודי תקלות · נוצר על ידי error-codes/build.py – אין לערוך ידנית -->\n"
            "<style>\n" + css + "\n</style>\n\n" + html +
            "\n<script>\n" + data_js + "\n</script>\n<script>\n" + js + "\n</script>\n")


# --------------------------------------------------------------------------
# אינדקס ה-SEO (טקסט אמיתי שנפתח בלחיצה) + Schema
# --------------------------------------------------------------------------
def build_seo(site, devices, brands, codes, notes, standalone_schema=True, limit=None):
    """limit – מספר מרבי של קודים לכל יצרן+מכשיר (לגרסה המקוצרת לדף הראשי)."""
    prim = primary_brands(brands)
    parts = ["<style>\n" + read_text(os.path.join(TPL, "seo.css")) + "\n</style>",
             '<section class="nfx-seo" id="nfx-error-code-index" dir="rtl" lang="he" data-theme="%s">' % theme_of(site),
             "<h2>אינדקס קודי תקלות לפי יצרן וסוג מכשיר</h2>",
             "<p>ריכוז קודי השגיאה הנפוצים במוצרי חשמל ביתיים, המשמעות שלהם ומה אפשר לבדוק לפני הזמנת טכנאי. לחצו על יצרן כדי לפתוח את הרשימה.</p>"]

    faq = []
    for b in prim:
        sibs = siblings(brands, b["family"], b["id"])
        for did in b["devices"]:
            dev = device_by_id(devices, did)
            entries = codes[b["family"]][did]
            if limit:
                keep = sorted(entries, key=lambda e: e["_o"])[:limit]
                entries = [e for e in entries if e in keep]
            head = "%s – %s (%d קודים)" % (b["name"], dev["name"], len(entries))
            parts.append('<details id="idx-%s-%s"><summary><span>%s</span></summary><div class="nfx-seo-inner">'
                         % (b["id"], did, esc(head)))
            if sibs:
                parts.append('<p class="nfx-note">הקודים זהים גם ב: %s.</p>' % esc(", ".join(sibs)))
            if notes.get(b["family"]):
                parts.append('<p class="nfx-note">%s</p>' % esc(notes[b["family"]]))

            for e in entries:
                q = "קוד שגיאה %s ב%s %s – מה המשמעות?" % (e["code"], dev["name"], b["name"])
                item = ['<div class="nfx-seo-item" id="%s">' % esc("code-%s-%s-%s" % (b["id"], did, slug(e["code"]))),
                        "<h3>%s %s %s – %s</h3>" % (esc(b["name"]), esc(dev["name"]), esc(e["code"]), esc(e["title"])),
                        "<p><strong>משמעות:</strong> %s</p>" % esc(e["meaning"])]
                if e.get("causes"):
                    item.append("<p><strong>סיבות אפשריות:</strong></p><ul>%s</ul>"
                                % "".join("<li>%s</li>" % esc(c) for c in e["causes"]))
                if e.get("steps"):
                    item.append("<p><strong>מה לבדוק לפני טכנאי:</strong></p><ul>%s</ul>"
                                % "".join("<li>%s</li>" % esc(c) for c in e["steps"]))
                if e.get("pro"):
                    item.append("<p><strong>מתי צריך טכנאי:</strong> %s</p>" % esc(e["pro"]))
                item.append('<p class="nfx-note">רמת דחיפות: %s</p></div>' % esc(SEV_LABEL.get(e["severity"], "")))
                parts.append("".join(item))

                faq.append({
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {"@type": "Answer", "text": answer_text(e)},
                })
            parts.append("</div></details>")
    parts.append("</section>")

    graph = [
        {
            "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
            "@id": site["url"] + "#business",
            "name": site["businessName"],
            "legalName": site.get("legalName", site["businessName"]),
            "url": site["url"],
            "telephone": site.get("phoneE164", ""),
            "areaServed": [{"@type": "City", "name": c} for c in site.get("areaServed", [])],
            "knowsAbout": ["תיקון מכונות כביסה", "תיקון מדיחי כלים", "תיקון מייבשי כביסה",
                           "תיקון תנורים", "תיקון מקררים", "קודי שגיאה במוצרי חשמל"],
        },
        {
            "@type": "FAQPage",
            "@id": site["url"] + "#error-codes-faq",
            "name": "קודי תקלות במוצרי חשמל – שאלות ותשובות",
            "inLanguage": "he-IL",
            "mainEntity": faq,
        },
        {
            "@type": "ItemList",
            "@id": site["url"] + "#error-code-index",
            "name": "אינדקס קודי תקלות לפי יצרן",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1,
                 "name": "%s %s – קודי תקלות" % (b["name"], device_by_id(devices, did)["name"]),
                 "url": site["url"].rstrip("/") + "/error-codes/%s-%s/" % (b["id"], did)}
                for i, (b, did) in enumerate([(b, d) for b in prim for d in b["devices"]])
            ],
        },
    ]
    schema = {"@context": "https://schema.org", "@graph": graph}
    schema_json = json.dumps(schema, ensure_ascii=False, indent=1)

    seo_html = "\n".join(parts)
    if standalone_schema:
        seo_html += ('\n\n<!-- Schema לגוגל – לא מוצג למשתמש, נועד לזיהוי התוכן על ידי מנועי החיפוש -->\n'
                     '<script type="application/ld+json">\n' + schema_json + "\n</script>\n")
    return seo_html, schema_json, len(faq)


# --------------------------------------------------------------------------
# דפי נחיתה לכל יצרן+מכשיר
# --------------------------------------------------------------------------
def build_landing_pages(site, devices, brands, codes, notes, widget):
    css = widget_css(site)
    dark = theme_of(site) == "dark"
    skin = {
        "page_bg": "#070c16" if dark else "#f2f5fa",
        "fg": "#eaf0fb" if dark else "#0e1b2e",
        "mut": "#8fa0bd" if dark else "#4a5b75",
        "panel": "rgba(255,255,255,.04)" if dark else "#ffffff",
        "panel_2": "rgba(255,255,255,.07)" if dark else "#eef2f8",
        "line": "rgba(255,255,255,.09)" if dark else "rgba(13,26,51,.1)",
        "brand": site["brandColor"],
    }
    pages = []
    for b in primary_brands(brands):
        sibs = siblings(brands, b["family"], b["id"])
        for did in b["devices"]:
            dev = device_by_id(devices, did)
            entries = codes[b["family"]][did]
            title = "קודי תקלות %s %s – טבלת קודים מלאה ומה עושים" % (b["name"], dev["name"])
            desc = ("טבלת קודי שגיאה ל%s %s: %s ועוד. מה המשמעות של כל קוד, מה אפשר לבדוק לבד ומתי צריך טכנאי. %s."
                    % (dev["seoName"], b["name"], ", ".join(e["code"] for e in entries[:5]), site["businessName"]))

            rows = "".join(
                '<tr><td class="c">%s</td><td>%s</td><td>%s</td></tr>'
                % (esc(e["code"]), esc(e["title"]), esc(e["meaning"])) for e in entries)

            blocks = []
            for e in entries:
                blk = ['<article class="pg-item" id="%s">' % esc("code-" + slug(e["code"])),
                       "<h3>%s %s %s – %s</h3>" % (esc(b["name"]), esc(dev["name"]), esc(e["code"]), esc(e["title"])),
                       "<p>%s</p>" % esc(e["meaning"])]
                if e.get("causes"):
                    blk.append("<h4>סיבות אפשריות</h4><ul>%s</ul>"
                               % "".join("<li>%s</li>" % esc(c) for c in e["causes"]))
                if e.get("steps"):
                    blk.append("<h4>מה לבדוק לפני הזמנת טכנאי</h4><ol>%s</ol>"
                               % "".join("<li>%s</li>" % esc(c) for c in e["steps"]))
                if e.get("pro"):
                    blk.append("<p><strong>מתי צריך טכנאי:</strong> %s</p>" % esc(e["pro"]))
                blk.append("</article>")
                blocks.append("".join(blk))

            faq = [{"@type": "Question",
                    "name": "קוד שגיאה %s ב%s %s – מה המשמעות?" % (e["code"], dev["name"], b["name"]),
                    "acceptedAnswer": {"@type": "Answer", "text": answer_text(e)}} for e in entries]
            page_url = site["url"].rstrip("/") + "/error-codes/%s-%s/" % (b["id"], did)
            schema = {"@context": "https://schema.org", "@graph": [
                {"@type": "FAQPage", "@id": page_url + "#faq", "inLanguage": "he-IL", "mainEntity": faq},
                {"@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "דף הבית", "item": site["url"]},
                    {"@type": "ListItem", "position": 2, "name": "קודי תקלות",
                     "item": site["url"].rstrip("/") + "/error-codes/"},
                    {"@type": "ListItem", "position": 3, "name": "%s %s" % (b["name"], dev["name"]), "item": page_url}]},
            ]}

            body = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s | %(biz)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<style>
%(css)s
body { margin:0; background:%(page_bg)s; color:%(fg)s;
  font-family:"Assistant","Rubik","Heebo",-apple-system,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
.pg { max-width:980px; margin:0 auto; padding:36px 16px 70px; }
.pg h1 { font-size:clamp(1.5rem,3.6vw,2.1rem); line-height:1.25; letter-spacing:-.02em; margin:0 0 10px; }
.pg .lede { color:%(mut)s; margin:0 0 26px; max-width:70ch; }
.pg h2 { font-size:1.3rem; letter-spacing:-.01em; margin:38px 0 12px; }
.pg-wrap { overflow-x:auto; border-radius:16px; border:1px solid %(line)s; }
.pg table { width:100%%; border-collapse:collapse; background:%(panel)s; font-size:.94rem; }
.pg th, .pg td { padding:12px 14px; text-align:right; border-bottom:1px solid %(line)s; vertical-align:top; }
.pg tr:last-child td { border-bottom:0; }
.pg th { background:%(panel_2)s; font-weight:800; }
.pg td.c { font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:800; direction:ltr; white-space:nowrap; color:%(brand)s; }
.pg-item { background:%(panel)s; border:1px solid %(line)s; border-radius:16px; padding:18px 20px; margin-bottom:12px; }
.pg-item h3 { font-size:1.06rem; margin:0 0 6px; letter-spacing:-.01em; }
.pg-item h4 { font-size:.85rem; color:%(mut)s; margin:14px 0 5px; }
.pg-item p { margin:0; }
.pg-item ul, .pg-item ol { margin:0; padding-inline-start:20px; font-size:.95rem; color:%(mut)s; }
.pg-cta { background:%(panel)s; border:1px solid %(line)s; border-radius:18px; padding:22px; margin-top:28px; }
.pg-cta a { display:inline-block; margin-top:6px; padding:11px 22px; border-radius:12px; text-decoration:none;
  font-weight:800; color:#fff; background:%(brand)s; }
</style>
</head>
<body>
<main class="pg">
<h1>%(h1)s</h1>
<p class="lede">%(lede)s</p>

%(widget)s

<h2>טבלת הקודים המלאה</h2>
<div class="pg-wrap"><table><thead><tr><th>קוד</th><th>התקלה</th><th>משמעות</th></tr></thead><tbody>%(rows)s</tbody></table></div>

<h2>הסבר מפורט לכל קוד</h2>
%(blocks)s

<div class="pg-cta">
<h2 style="margin-top:0">צריכים טכנאי?</h2>
<p>%(biz)s – תיקון %(seodev)s בבית הלקוח. שלחו לנו את הדגם ואת קוד השגיאה ונדע מראש איזה חלק להביא.</p>
<p><a href="tel:%(tel)s">%(phone)s</a></p>
</div>
</main>
<script type="application/ld+json">
%(schema)s
</script>
</body>
</html>
""" % {
                "title": esc(title), "desc": esc(desc), "url": esc(page_url), "css": css,
                "h1": esc(title), "biz": esc(site["businessName"]), "seodev": esc(dev["seoName"]),
                "lede": esc("מה אומר כל קוד שגיאה ב%s %s, מה אפשר לבדוק לבד לפני שמזמינים טכנאי, ומתי חייבים טיפול מקצועי.%s"
                            % (dev["name"], b["name"], (" הקודים תקפים גם ל: " + ", ".join(sibs) + ".") if sibs else "")),
                "widget": widget.replace('id="nfx-ec" class="nfx-ec"',
                                         'id="nfx-ec" class="nfx-ec" data-brand="%s" data-device="%s"' % (b["id"], did)),
                "rows": rows, "blocks": "\n".join(blocks),
                "page_bg": skin["page_bg"], "fg": skin["fg"], "mut": skin["mut"],
                "panel": skin["panel"], "panel_2": skin["panel_2"], "line": skin["line"], "brand": skin["brand"],
                "tel": esc(site.get("phoneE164", "")), "phone": esc(site.get("phone", "")),
                "schema": json.dumps(schema, ensure_ascii=False, indent=1),
            }
            pages.append(("%s-%s.html" % (b["id"], did), body))
    return pages


# --------------------------------------------------------------------------
# קובצי גילוי: robots.txt, מפת אתר, ו-llms.txt למנועי בינה מלאכותית
# --------------------------------------------------------------------------

# סורקים של מנועי חיפוש ו-AI. הקבוצה הראשונה היא זו שמביאה ציטוטים והפניות;
# הקבוצה השנייה משמשת גם לאימון מודלים – אם לא רוצים, מוחקים אותה מהרשימה.
AI_CITATION_BOTS = [
    ("OAI-SearchBot", "האינדקס של ChatGPT – זה מה שמאפשר להופיע כמקור בתשובות"),
    ("ChatGPT-User", "גלישה של ChatGPT בעקבות בקשת משתמש"),
    ("PerplexityBot", "האינדקס של Perplexity"),
    ("Perplexity-User", "גלישה של Perplexity בעקבות בקשת משתמש"),
    ("Claude-SearchBot", "האינדקס של Claude"),
    ("Claude-User", "גלישה של Claude בעקבות בקשת משתמש"),
    ("Applebot", "Siri וחיפוש של אפל"),
    ("Bingbot", "Bing – מזין גם כלי AI שונים"),
]
AI_TRAINING_BOTS = [
    ("GPTBot", "OpenAI – אימון מודלים"),
    ("ClaudeBot", "Anthropic – אימון מודלים"),
    ("Google-Extended", "Gemini – שימוש בתוכן וביסוס תשובות"),
    ("Applebot-Extended", "Apple Intelligence"),
    ("meta-externalagent", "Meta AI"),
]


def build_discovery(site, devices, brands, codes, notes):
    base = site["url"].rstrip("/")
    hub = base + "/error-codes/"
    today = datetime.date.today().isoformat()
    prim = primary_brands(brands)
    pages = [(b, device_by_id(devices, did)) for b in prim for did in b["devices"]]

    # ---- robots.txt ----
    rb = ["# %s – robots.txt" % site["businessName"],
          "# נוצר על ידי error-codes/build.py",
          "",
          "User-agent: *",
          "Allow: /",
          "",
          "# מנועי חיפוש מבוססי AI – סריקה מותרת כדי שנוכל להופיע כמקור בתשובות"]
    for ua, why in AI_CITATION_BOTS:
        rb += ["# %s" % why, "User-agent: %s" % ua, "Allow: /", ""]
    rb += ["# סורקים שמשמשים גם לאימון מודלים – מחקו את הבלוק אם אינכם מעוניינים"]
    for ua, why in AI_TRAINING_BOTS:
        rb += ["# %s" % why, "User-agent: %s" % ua, "Allow: /", ""]
    rb += ["Sitemap: %s/sitemap.xml" % base, ""]
    robots = "\n".join(rb)

    # ---- sitemap.xml ----
    urls = [(base + "/", "1.0"), (hub, "0.9")] + \
           [(base + "/error-codes/%s-%s/" % (b["id"], d["id"]), "0.8") for b, d in pages]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, prio in urls:
        sm += ["  <url>", "    <loc>%s</loc>" % url, "    <lastmod>%s</lastmod>" % today,
               "    <changefreq>monthly</changefreq>", "    <priority>%s</priority>" % prio, "  </url>"]
    sm.append("</urlset>")
    sitemap = "\n".join(sm) + "\n"

    # ---- llms.txt : מפת תוכן קריאה למודלים ----
    lt = ["# %s" % site["businessName"],
          "",
          "> %s. אנחנו מתחזקים אינדקס פתוח של קודי תקלות במוצרי חשמל ביתיים: "
          "%d קודים, %d יצרנים, %d סוגי מכשירים – עם המשמעות של כל קוד, מה אפשר לבדוק לבד ומתי נדרש טכנאי."
          % (site.get("legalName", site["businessName"]),
             sum(len(v) for fam in codes.values() for v in fam.values()),
             len([b for b in brands if b.get("family")]),
             len({d for fam in codes.values() for d in fam})),
          "",
          "אזורי שירות: %s." % ", ".join(site.get("areaServed", [])),
          "טלפון: %s" % site.get("phone", ""),
          "",
          "## אינדקס קודי תקלות", ""]
    for b, d in pages:
        entries = codes[b["family"]][d["id"]]
        rest = len(entries) - 6
        lt.append("- [קודי תקלות %s %s](%s/error-codes/%s-%s/): %s%s."
                  % (b["name"], d["name"], base, b["id"], d["id"],
                     ", ".join(e["code"] for e in entries[:6]),
                     (" ועוד %d קודים" % rest) if rest > 0 else ""))
    lt += ["", "## אופציונלי", "",
           "- [כל הקודים כטקסט אחד](%s/llms-full.txt)" % base, ""]
    llms = "\n".join(lt)

    # ---- llms-full.txt : כל התוכן כטקסט נקי ----
    lf = ["# אינדקס קודי תקלות – %s" % site["businessName"],
          "עודכן: %s" % today,
          "",
          site["disclaimer"], ""]
    for b, d in pages:
        sibs = siblings(brands, b["family"], b["id"])
        lf.append("## %s %s" % (b["name"], d["name"]))
        if sibs:
            lf.append("קודים זהים גם ב: %s." % ", ".join(sibs))
        if notes.get(b["family"]):
            lf.append(notes[b["family"]])
        lf.append("")
        for e in codes[b["family"]][d["id"]]:
            alt = (" (מוצג גם כ: %s)" % ", ".join(e["alt"])) if e.get("alt") else ""
            lf.append("### %s %s – קוד %s%s: %s" % (b["name"], d["name"], e["code"], alt, e["title"]))
            lf.append(answer_text(e))
            lf.append("")
    llms_full = "\n".join(lf)

    return robots, sitemap, llms, llms_full


# --------------------------------------------------------------------------
def main():
    site, devices, brands, codes, notes = load()
    total = sum(len(v) for fam in codes.values() for v in fam.values())

    widget = build_widget(site, devices, brands, codes, notes)
    seo_html, schema_json, faq_count = build_seo(site, devices, brands, codes, notes)
    seo_only_html, _, _ = build_seo(site, devices, brands, codes, notes, standalone_schema=False)
    lite_html, lite_schema, lite_count = build_seo(site, devices, brands, codes, notes, limit=LITE_LIMIT)

    write_text(os.path.join(DIST, "embed-widget.html"), widget)
    write_text(os.path.join(DIST, "embed-seo.html"), seo_html)
    write_text(os.path.join(DIST, "embed-seo-lite.html"), lite_html)
    write_text(os.path.join(DIST, "embed-full.html"), widget + "\n\n" + seo_html)
    write_text(os.path.join(DIST, "embed-full-lite.html"), widget + "\n\n" + lite_html)
    write_text(os.path.join(DIST, "schema.jsonld"), schema_json + "\n")
    write_text(os.path.join(DIST, "schema-lite.jsonld"), lite_schema + "\n")

    robots, sitemap, llms, llms_full = build_discovery(site, devices, brands, codes, notes)
    write_text(os.path.join(DIST, "robots.txt"), robots)
    write_text(os.path.join(DIST, "sitemap.xml"), sitemap)
    write_text(os.path.join(DIST, "llms.txt"), llms)
    write_text(os.path.join(DIST, "llms-full.txt"), llms_full)

    preview = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תצוגה מקדימה – מאתר קודי תקלות | %s</title>
<style>body{margin:0;background:%s;padding:34px 16px 80px;font-family:"Assistant","Rubik",Arial,sans-serif}</style>
</head>
<body>
%s
%s
</body>
</html>
""" % (esc(site["businessName"]),
       "#070c16" if theme_of(site) == "dark" else "#f2f5fa",
       widget, seo_only_html)
    write_text(os.path.join(DIST, "index.html"), preview)

    pages_dir = os.path.join(DIST, "pages")
    if os.path.isdir(pages_dir):
        for f in os.listdir(pages_dir):
            os.remove(os.path.join(pages_dir, f))
    pages = build_landing_pages(site, devices, brands, codes, notes, widget)
    for name, body in pages:
        write_text(os.path.join(pages_dir, name), body)

    kb = lambda p: os.path.getsize(os.path.join(DIST, p)) / 1024.0
    print("נבנה בהצלחה:")
    print("  יצרנים: %d (מתוכם %d עם טבלת קודים)" % (len(brands), len([b for b in brands if b.get("family")])))
    print("  קודים סה\"כ: %d | שאלות ב-Schema: %d | דפי נחיתה: %d" % (total, faq_count, len(pages)))
    for name in ("embed-widget.html", "embed-seo.html", "embed-seo-lite.html",
                 "embed-full.html", "embed-full-lite.html", "schema.jsonld",
                 "robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"):
        print("  %-22s %6.1f KB" % (name, kb(name)))
    print("  (הגרסה המקוצרת כוללת %d שאלות – עד %d קודים לכל יצרן+מכשיר)" % (lite_count, LITE_LIMIT))


if __name__ == "__main__":
    main()
