# מצגת מכירה — דופק

`dofek-pitch-deck.pptx` — 11 שקופיות: הבעיה, הפתרון, איך זה עובד, דוגמת
דוח, קהל יעד, תמחור, תחזית הכנסות, כניסה לשוק, אמינות/גילוי נאות, וסגירה.

כל שקופית כוללת **הערות דובר (Speaker Notes)** בעברית, כתובות כסקריפט
בגוף ראשון של "מאי" — הנציגה הדיגיטלית של דופק. אין כאן כלי ליצירת וידאו
עם אווטאר AI מדבר בפועל; כדי להפוך את זה לסרטון:

1. פתחו את המצגת ב-PowerPoint/Google Slides והעתיקו את הערות הדובר של כל
   שקופית.
2. הדביקו את הטקסט ככתוביות/סקריפט בכלי ליצירת אווטאר AI מדבר, למשל
   HeyGen, Synthesia או Colossyan.
3. בחרו אווטאר, קול והתאמה של קצב הדיבור, והפיקו סרטון לכל שקופית או
   לרצף כולו.

## בנייה מחדש

```bash
cd marketing/pitch-deck
npm install pptxgenjs react-icons react react-dom sharp
node build_deck.js
```

מייצר מחדש את `dofek-pitch-deck.pptx` מהקוד ב-`build_deck.js` (פלטת
הצבעים והמיתוג תואמים את `service/reports.py` ואת דף הנחיתה ב-
`marketing/landing-page.html`).
