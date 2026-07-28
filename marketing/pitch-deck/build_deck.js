const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const pptxgen = require("pptxgenjs");
const {
  FiActivity, FiClock, FiDollarSign, FiUsers, FiShield, FiTrendingUp,
  FiMail, FiTarget, FiCheckCircle, FiLayers, FiPieChart, FiZap,
} = require("react-icons/fi");

// ---------- palette (Dofek brand, shared with landing page / reports) ----------
const NAVY = "14182B";     // dominant dark
const PAPER = "FFFFFF";    // light content bg
const PAPER2 = "F3F4EE";   // soft card fill on light
const INK_SOFT = "4B5163"; // secondary text on light
const CORAL = "E8384E";    // sharp accent ("the pulse")
const GOLD = "DE8A12";
const SAGE = "3E7A50";
const CREAM_TXT = "F1F1EA"; // text on navy

const FONT_HEAD = "Calibri";
const FONT_BODY = "Calibri";

async function iconPng(IconComponent, colorHex, sizePx = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { size: sizePx, color: `#${colorHex}` })
  );
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`;
  const buf = await sharp(Buffer.from(full)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function freshShadow() {
  return { type: "outer", color: "0B0D18", opacity: 0.28, blur: 10, offset: 3, angle: 90 };
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5 in
  pres.rtlMode = true;

  const icons = {
    pulse: await iconPng(FiActivity, CORAL),
    pulseNavy: await iconPng(FiActivity, NAVY),
    pulseCream: await iconPng(FiActivity, CREAM_TXT),
    clock: await iconPng(FiClock, GOLD),
    dollar: await iconPng(FiDollarSign, SAGE),
    users: await iconPng(FiUsers, CORAL),
    shield: await iconPng(FiShield, GOLD),
    trend: await iconPng(FiTrendingUp, SAGE),
    mail: await iconPng(FiMail, CREAM_TXT),
    target: await iconPng(FiTarget, CORAL),
    check: await iconPng(FiCheckCircle, SAGE),
    layers: await iconPng(FiLayers, GOLD),
    pie: await iconPng(FiPieChart, CORAL),
    zap: await iconPng(FiZap, GOLD),
  };

  const iconBadge = (slide, img, x, y, d, ringColor) => {
    slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: PAPER2 }, line: { color: ringColor, width: 1.25 } });
    const pad = d * 0.27;
    slide.addImage({ data: img, x: x + pad / 2, y: y + pad / 2, w: d - pad, h: d - pad });
  };
  const iconBadgeDark = (slide, img, x, y, d, ringColor) => {
    slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: "1C2138" }, line: { color: ringColor, width: 1.25 } });
    const pad = d * 0.27;
    slide.addImage({ data: img, x: x + pad / 2, y: y + pad / 2, w: d - pad, h: d - pad });
  };

  const footer = (slide, dark, pageNum) => {
    slide.addText("דופק", {
      x: 0.5, y: 7.14, w: 3, h: 0.3, fontFace: FONT_HEAD, bold: true, fontSize: 10,
      color: dark ? CREAM_TXT : NAVY, align: "right", margin: 0,
    });
    slide.addText(String(pageNum), {
      x: 12.3, y: 7.14, w: 0.5, h: 0.3, fontFace: FONT_BODY, fontSize: 10,
      color: dark ? "8A8FA6" : "9AA0B4", align: "left", margin: 0,
    });
  };

  // avatar mark used for the AI presenter persona, reused across title + closing
  const drawAvatarMark = (slide, cx, cy, r, dark) => {
    const ring = dark ? CORAL : CORAL;
    slide.addShape("ellipse", {
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      fill: { color: dark ? "1C2138" : PAPER2 }, line: { color: ring, width: 2.25 },
      shadow: freshShadow(),
    });
    slide.addShape("ellipse", {
      x: cx - r * 0.62, y: cy - r * 0.62, w: r * 1.24, h: r * 1.24,
      fill: { type: "none" }, line: { color: ring, width: 1, dashType: "sysDot" },
    });
    const img = dark ? icons.pulseCream : icons.pulseNavy;
    slide.addImage({ data: img, x: cx - r * 0.34, y: cy - r * 0.34, w: r * 0.68, h: r * 0.68 });
  };

  // ================= Slide 1 — Title =================
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addShape("ellipse", { x: 9.6, y: -2.2, w: 7, h: 7, fill: { color: "1A2038" }, line: { type: "none" } });
    s.addShape("ellipse", { x: -2.6, y: 5.2, w: 5.4, h: 5.4, fill: { color: "1A2038" }, line: { type: "none" } });

    s.addText("כלי B2B לבדיקת מסרים וקונספטים", {
      x: 0.9, y: 0.75, w: 8, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true,
      color: CORAL, charSpacing: 2, align: "right", margin: 0,
    });
    s.addText("דופק", {
      x: 0.9, y: 1.15, w: 8, h: 1.3, fontFace: FONT_HEAD, fontSize: 60, bold: true,
      color: PAPER, align: "right", margin: 0,
    });
    s.addText("דעו איך ישראל תגיב — לפני שאתם משיקים", {
      x: 0.9, y: 2.35, w: 8.3, h: 0.6, fontFace: FONT_BODY, fontSize: 20,
      color: "C6C9DA", align: "right", margin: 0,
    });
    s.addText(
      "פאנל דעת קהל סינתטי מבוסס AI, של 220 פרופילים מגוונים של ישראלים — "
      + "דוח תוך דקות, לא שבועות.",
      { x: 0.9, y: 3.05, w: 7.6, h: 0.7, fontFace: FONT_BODY, fontSize: 13.5, color: "9DA2B8", align: "right", margin: 0, lineSpacingMultiple: 1.3 }
    );

    // AI presenter avatar card
    drawAvatarMark(s, 10.9, 2.55, 1.05, true);
    s.addText("מאי", {
      x: 9.85, y: 3.85, w: 2.1, h: 0.4, fontFace: FONT_HEAD, fontSize: 16, bold: true,
      color: PAPER, align: "center", margin: 0,
    });
    s.addText("הנציגה הדיגיטלית של דופק", {
      x: 9.35, y: 4.25, w: 3.1, h: 0.55, fontFace: FONT_BODY, fontSize: 10.5,
      color: "9DA2B8", align: "center", margin: 0, lineSpacingMultiple: 1.2,
    });

    s.addText("מצגת מכירה · מוכנה להפקה כווידאו עם אווטאר AI (ראו הערות דובר)", {
      x: 0.9, y: 6.75, w: 8.5, h: 0.35, fontFace: FONT_BODY, fontSize: 10.5, italic: true,
      color: "6E7389", align: "right", margin: 0,
    });

    s.addNotes(
      "שלום, אני מאי — הנציגה הדיגיטלית של דופק. במצגת הקצרה הזו אני אראה לכם "
      + "איך אפשר לדעת תוך דקות איך ישראל תגיב למסר, לסלוגן או לקונספט — עוד "
      + "לפני שהתקציב יוצא לדרך."
    );
  }

  // ================= Slide 2 — The problem =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("הבעיה", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("מחקר שוק אמיתי לוקח שבועות.\nהקמפיין לא יכול לחכות.", {
      x: 0.7, y: 0.95, w: 11.9, h: 1.3, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: NAVY, align: "right", margin: 0, lineSpacingMultiple: 1.08,
    });

    const items = [
      { icon: icons.clock, ring: GOLD, title: "שבועות של המתנה", body: "תיאום, גיוס משתתפים וניתוח לוקחים זמן — התקציב מחכה בינתיים." },
      { icon: icons.dollar, ring: SAGE, title: "תקציב שלא תמיד מוצדק", body: "מחקר שוק מוסמך עשוי לעלות עשרות אלפי שקלים — הרבה מעבר לבדיקת אינטואיציה." },
      { icon: icons.users, ring: CORAL, title: "עיוורון לקהלים שלא בחדר", body: "קל לפספס איך מגזר שלם יגיב למסר שנוסח בחדר הומוגני." },
    ];
    const colW = 3.75, gap = 0.35, startX = 0.7, y = 2.65;
    items.forEach((it, i) => {
      const x = startX + i * (colW + gap);
      s.addShape("roundRect", { x, y, w: colW, h: 3.55, rectRadius: 0.14, fill: { color: PAPER2 }, line: { type: "none" }, shadow: freshShadow() });
      iconBadge(s, it.icon, x + colW / 2 - 0.5, y + 0.4, 1.0, it.ring);
      s.addText(it.title, { x: x + 0.28, y: y + 1.55, w: colW - 0.56, h: 0.5, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: NAVY, align: "center", margin: 0 });
      s.addText(it.body, { x: x + 0.32, y: y + 2.05, w: colW - 0.64, h: 1.35, fontFace: FONT_BODY, fontSize: 12, color: INK_SOFT, align: "center", margin: 0, lineSpacingMultiple: 1.3 });
    });
    footer(s, false, 2);
    s.addNotes(
      "רוב הסוכנויות והחברות פשוט לא בודקות את המסר שלהן לפני השקה. סקר אמיתי "
      + "לוקח שבועות, מחקר שוק מוסמך עולה עשרות אלפי שקלים, וקל לפספס איך מגזר "
      + "שלם — חרדי, ערבי, מסורתי — יגיב למסר שנוסח בחדר הומוגני. אז ההחלטה "
      + "מתקבלת על בסיס אינטואיציה בלבד. וזה מסוכן."
    );
  }

  // ================= Slide 3 — The solution =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("הפתרון", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("פאנל דעת קהל סינתטי, זמין תמיד", {
      x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0,
    });
    s.addText(
      "דופק מריץ את השאלה שלכם מול 220 פרופילים סינתטיים מגוונים של ישראלים — "
      + "כל אחד עם רקע, מגזר, נטייה פוליטית, עיסוק ומצב משפחתי משלו — ומצרף "
      + "את התשובות לתמונת מצב אחת ברורה.",
      { x: 0.7, y: 1.75, w: 7.1, h: 1.2, fontFace: FONT_BODY, fontSize: 13.5, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.35 }
    );

    const rows = [
      { icon: icons.layers, ring: CORAL, title: "כיסוי מגזרי אמיתי", body: "חילונים, דתיים-לאומיים, חרדים (ליטאים/חסידים/ספרדים), ערבים, דרוזים ובדואים." },
      { icon: icons.zap, ring: GOLD, title: "מהירות", body: "דוח מוכן תוך דקות מרגע שליחת השאלה." },
      { icon: icons.shield, ring: SAGE, title: "שקיפות מלאה", body: "כל דוח כולל גילוי נאות: זו סימולציה, לא סקר רשמי." },
    ];
    let ry = 3.15;
    rows.forEach((r) => {
      iconBadge(s, r.icon, 0.7, ry, 0.62, r.ring);
      s.addText(r.title, { x: 1.55, y: ry - 0.02, w: 5.9, h: 0.35, fontFace: FONT_HEAD, fontSize: 14, bold: true, color: NAVY, align: "right", margin: 0 });
      s.addText(r.body, { x: 1.55, y: ry + 0.33, w: 5.9, h: 0.5, fontFace: FONT_BODY, fontSize: 11.5, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.25 });
      ry += 0.98;
    });

    // right-side mini "who answers" card
    s.addShape("roundRect", { x: 8.15, y: 1.75, w: 4.45, h: 4.55, rectRadius: 0.14, fill: { color: NAVY }, line: { type: "none" }, shadow: freshShadow() });
    s.addText("220", { x: 8.45, y: 2.15, w: 3.85, h: 1.0, fontFace: FONT_HEAD, fontSize: 54, bold: true, color: PAPER, align: "center", margin: 0 });
    s.addText("פרופילים סינתטיים מגוונים", { x: 8.45, y: 3.05, w: 3.85, h: 0.4, fontFace: FONT_BODY, fontSize: 12.5, color: "C6C9DA", align: "center", margin: 0 });
    const tags = ["חילוני", "מסורתי", "דתי-לאומי", "חרדי", "ערבי", "דרוזי", "בדואי"];
    let tx = 8.55, ty = 3.75, th = 0.4;
    tags.forEach((t) => {
      const w = 0.42 + t.length * 0.135;
      if (tx + w > 8.55 + 3.65) { tx = 8.55; ty += th + 0.14; }
      s.addShape("roundRect", { x: tx, y: ty, w, h: th, rectRadius: 0.2, fill: { color: "1C2138" }, line: { color: "343B58", width: 0.75 } });
      s.addText(t, { x: tx, y: ty, w, h: th, fontFace: FONT_BODY, fontSize: 10, color: CREAM_TXT, align: "center", valign: "middle", margin: 0 });
      tx += w + 0.14;
    });
    footer(s, false, 3);
    s.addNotes(
      "דופק הוא פאנל דעת קהל סינתטי: מריצים שאלה מול 220 פרופילים מגוונים של "
      + "ישראלים — כולל מגזרים שרוב כלי המחקר הרגילים מפספסים — ומקבלים תמונת "
      + "מצב תוך דקות, עם גילוי נאות מלא שזו סימולציה ולא סקר רשמי."
    );
  }

  // ================= Slide 4 — How it works =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("איך זה עובד", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("שלושה שלבים, דקות ספורות", {
      x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0,
    });

    const steps = [
      { n: "01", title: "שולחים שאלה", body: "בשפה חופשית — בדיוק כמו ששואלים בן אדם. “האם כדאי להשיק במחיר פרימיום או נגיש?”" },
      { n: "02", title: "הפאנל עונה", body: "220 פרופילים מגיבים במקביל, כל אחד מנקודת המבט של הרקע והערכים שלו." },
      { n: "03", title: "מקבלים דוח", body: "התפלגות עמדות, פילוח לפי מגזר/פוליטיקה/גיל, וציטוטים מייצגים." },
    ];
    const colW = 3.75, gap = 0.35, startX = 0.7, y = 2.15;
    steps.forEach((st, i) => {
      const x = startX + i * (colW + gap);
      s.addShape("roundRect", { x, y, w: colW, h: 3.85, rectRadius: 0.14, fill: { color: PAPER2 }, line: { type: "none" }, shadow: freshShadow() });
      s.addText(st.n, { x: x + 0.3, y: y + 0.28, w: 1.6, h: 0.6, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: CORAL, align: "right", margin: 0 });
      s.addText(st.title, { x: x + 0.3, y: y + 0.95, w: colW - 0.6, h: 0.45, fontFace: FONT_HEAD, fontSize: 16, bold: true, color: NAVY, align: "right", margin: 0 });
      s.addText(st.body, { x: x + 0.3, y: y + 1.5, w: colW - 0.6, h: 2.1, fontFace: FONT_BODY, fontSize: 12, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.35 });
      if (i < steps.length - 1) {
        const arrowW = 0.26;
        const arrowX = x + colW + (gap - arrowW) / 2;
        s.addText("←", { x: arrowX, y: y + 1.55, w: arrowW, h: 0.5, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: "C7CADA", align: "center", margin: 0 });
      }
    });
    footer(s, false, 4);
    s.addNotes(
      "התהליך פשוט: שולחים שאלה בשפה חופשית, 220 הפרופילים עונים במקביל, "
      + "ותוך דקות מתקבל דוח מוכן להצגה — בלי צורך בתיאום או המתנה."
    );
  }

  // ================= Slide 5 — Sample report / chart =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("דוגמה", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("כך נראה דוח דופק", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0 });
    s.addText("“האם כדאי להשיק את המוצר במחיר פרימיום או נגיש?”", {
      x: 0.7, y: 1.65, w: 11.9, h: 0.45, fontFace: FONT_BODY, fontSize: 13.5, italic: true, color: INK_SOFT, align: "right", margin: 0,
    });

    s.addChart(pres.ChartType.bar, [{
      name: "התפלגות עמדות",
      labels: ["תומך", "מתנגד", "מעורב/תלוי", "לא בטוח"],
      values: [46, 29, 18, 7],
    }], {
      x: 0.7, y: 2.25, w: 6.7, h: 4.15,
      barDir: "bar",
      showTitle: true, title: "התפלגות כללית (n=220)", titleFontSize: 13, titleColor: NAVY, titleFontFace: FONT_HEAD,
      showLegend: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: NAVY, dataLabelFormatCode: "0\"%\"",
      chartColors: [CORAL],
      catAxisLabelColor: INK_SOFT, catAxisLabelFontSize: 11,
      valAxisHidden: true,
      catGridLine: { style: "none" },
      valGridLine: { style: "none" },
      barGapWidthPct: 45,
    });

    s.addShape("roundRect", { x: 7.7, y: 2.25, w: 4.9, h: 4.15, rectRadius: 0.14, fill: { color: NAVY }, line: { type: "none" }, shadow: freshShadow() });
    s.addText("פילוח לפי מגזר", { x: 8.0, y: 2.5, w: 4.3, h: 0.35, fontFace: FONT_HEAD, fontSize: 13, bold: true, color: PAPER, align: "right", margin: 0 });
    const sect = [["חילוני", "תומך 61%"], ["דתי-לאומי", "מעורב 44%"], ["חרדי", "מתנגד 58%"], ["ערבי", "תומך 39%"]];
    let sy = 2.95;
    sect.forEach(([k, v]) => {
      s.addText(k, { x: 8.0, y: sy, w: 2.1, h: 0.35, fontFace: FONT_BODY, fontSize: 11.5, color: "C6C9DA", align: "right", margin: 0 });
      s.addText(v, { x: 10.1, y: sy, w: 2.2, h: 0.35, fontFace: FONT_BODY, fontSize: 11.5, bold: true, color: CORAL, align: "right", margin: 0 });
      sy += 0.42;
    });
    s.addShape("line", { x: 8.0, y: sy + 0.05, w: 4.3, h: 0, line: { color: "343B58", width: 0.75 } });
    sy += 0.25;
    s.addText("“אם המחיר מרגיש נגיש, אני אמליץ עליו לחברים. פרימיום צריך להרגיש שווה את זה.”", {
      x: 8.0, y: sy, w: 4.3, h: 0.9, fontFace: FONT_BODY, italic: true, fontSize: 11, color: PAPER, align: "right", margin: 0, lineSpacingMultiple: 1.3,
    });
    s.addText("— נועה, 29, חילונית, תל אביב", { x: 8.0, y: sy + 0.95, w: 4.3, h: 0.3, fontFace: FONT_BODY, fontSize: 9.5, color: "9DA2B8", align: "right", margin: 0 });

    s.addText("* נתוני הדגמה, לצורך המחשה של פורמט הדוח", { x: 0.7, y: 6.65, w: 8, h: 0.3, fontFace: FONT_BODY, fontSize: 9.5, italic: true, color: "9AA0B4", align: "right", margin: 0 });
    footer(s, false, 5);
    s.addNotes(
      "כך נראה דוח בפועל: התפלגות עמדות כללית, פילוח לפי מגזר, ונטייה פוליטית "
      + "וגיל, וציטוטים מייצגים מכמה נקודות מבט שונות — הכל בעמוד אחד ברור."
    );
  }

  // ================= Slide 6 — Target audience =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("קהל יעד", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("למי דופק הכי שימושי", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0 });

    const grid = [
      { icon: icons.target, ring: CORAL, title: "סוכנויות פרסום ושיווק", body: "בדיקת קונספט קריאייטיב וסלוגן לפני הצגה ללקוח." },
      { icon: icons.zap, ring: GOLD, title: "צוותי מוצר וסטארטאפים", body: "בדיקת מיצוב, שם מוצר ורגישות תמחור." },
      { icon: icons.mail, ring: SAGE, title: "יועצי תקשורת ו-PR", body: "בדיקת ניסוח הודעה רגישה לפני פרסום או תגובה במשבר." },
      { icon: icons.pie, ring: CORAL, title: "בוטיקי מחקר שוק", body: "הרחבת השירות ללקוחות קיימים, במיתוג עצמי (white-label)." },
    ];
    const colW = 5.75, rowH = 1.9, gapX = 0.4, gapY = 0.3, startX = 0.7, startY = 2.1;
    grid.forEach((g, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = startX + col * (colW + gapX), y = startY + row * (rowH + gapY);
      s.addShape("roundRect", { x, y, w: colW, h: rowH, rectRadius: 0.14, fill: { color: PAPER2 }, line: { type: "none" }, shadow: freshShadow() });
      iconBadge(s, g.icon, x + 0.3, y + rowH / 2 - 0.4, 0.8, g.ring);
      s.addText(g.title, { x: x + 1.35, y: y + 0.32, w: colW - 1.65, h: 0.45, fontFace: FONT_HEAD, fontSize: 14.5, bold: true, color: NAVY, align: "right", margin: 0 });
      s.addText(g.body, { x: x + 1.35, y: y + 0.82, w: colW - 1.65, h: 0.95, fontFace: FONT_BODY, fontSize: 11.5, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.3 });
    });
    footer(s, false, 6);
    s.addNotes(
      "הקהל העיקרי: סוכנויות פרסום ושיווק, צוותי מוצר וסטארטאפים, יועצי תקשורת "
      + "ו-PR, ובוטיקי מחקר שוק שרוצים להוסיף שירות מהיר וזול ללקוחותיהם."
    );
  }

  // ================= Slide 7 — Pricing =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("מודל עסקי", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("תמחור: קרדיט אחד = הרצה מלאה אחת", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: NAVY, align: "right", margin: 0 });

    const tiers = [
      { name: "דוח חד-פעמי", price: "2,000 ₪", note: "הרצה אחת", feats: ["הרצה מלאה (עד 220 פרופילים)", "דוח HTML מוכן להצגה", "מתאים לניסיון ראשון"], featured: false },
      { name: "מנוי סוכנות", price: "6,000 ₪", note: "לחודש · 6 הרצות", feats: ["6 הרצות בחודש", "דוח ממותג לכל הרצה", "שימוש שוטף"], featured: true },
      { name: "Enterprise / White-label", price: "15,000 ₪", note: "לחודש · 20 הרצות", feats: ["20 הרצות בחודש", "דוחות במיתוג שלכם", "גישת API ישירה"], featured: false },
    ];
    const colW = 3.85, gap = 0.32, startX = 0.7, y = 2.05;
    tiers.forEach((t, i) => {
      const x = startX + i * (colW + gap);
      const bg = t.featured ? NAVY : PAPER2;
      const fg = t.featured ? PAPER : NAVY;
      const sub = t.featured ? "C6C9DA" : INK_SOFT;
      s.addShape("roundRect", { x, y, w: colW, h: 4.35, rectRadius: 0.14, fill: { color: bg }, line: t.featured ? { color: CORAL, width: 1.5 } : { type: "none" }, shadow: freshShadow() });
      if (t.featured) {
        s.addShape("roundRect", { x: x + colW / 2 - 0.85, y: y - 0.22, w: 1.7, h: 0.42, rectRadius: 0.21, fill: { color: CORAL }, line: { type: "none" } });
        s.addText("הכי נפוץ", { x: x + colW / 2 - 0.85, y: y - 0.22, w: 1.7, h: 0.42, fontFace: FONT_BODY, fontSize: 10.5, bold: true, color: PAPER, align: "center", valign: "middle", margin: 0 });
      }
      s.addText(t.name, { x: x + 0.32, y: y + 0.35, w: colW - 0.64, h: 0.4, fontFace: FONT_BODY, fontSize: 12, bold: true, color: sub, align: "right", margin: 0 });
      s.addText(t.price, { x: x + 0.32, y: y + 0.75, w: colW - 0.64, h: 0.7, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: fg, align: "right", margin: 0 });
      s.addText(t.note, { x: x + 0.32, y: y + 1.42, w: colW - 0.64, h: 0.35, fontFace: FONT_BODY, fontSize: 10.5, color: sub, align: "right", margin: 0 });
      let fy = y + 1.95;
      t.feats.forEach((f) => {
        s.addText("✓  " + f, { x: x + 0.32, y: fy, w: colW - 0.64, h: 0.45, fontFace: FONT_BODY, fontSize: 11, color: fg, align: "right", margin: 0 });
        fy += 0.52;
      });
    });
    footer(s, false, 7);
    s.addNotes(
      "שלוש רמות תמחור: דוח חד-פעמי ב-2,000 שקל להתנסות ראשונה, מנוי סוכנות "
      + "ב-6,000 שקל לחודש עם 6 הרצות, ו-Enterprise עם מיתוג עצמי ב-15,000 שקל "
      + "לחודש. קרדיט אחד תמיד שווה להרצה מלאה אחת של הפאנל."
    );
  }

  // ================= Slide 8 — Revenue math (dark) =================
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addText("תחזית הכנסות", { x: 0.7, y: 0.55, w: 5, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("מ-6 לקוחות ל-78,000 ₪ בחודש", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: PAPER, align: "right", margin: 0 });

    const rows = [
      { label: "6 × מנוי סוכנות", amount: "36,000 ₪", pct: 46 },
      { label: "2 × Enterprise / White-label", amount: "30,000 ₪", pct: 39 },
      { label: "~6 × דוח חד-פעמי", amount: "12,000 ₪", pct: 15 },
    ];
    const barColors = [CORAL, GOLD, SAGE];
    let y = 2.15;
    rows.forEach((r, i) => {
      s.addText(r.label, { x: 0.7, y, w: 4.3, h: 0.4, fontFace: FONT_BODY, fontSize: 13, color: "C6C9DA", align: "right", margin: 0 });
      s.addText(r.amount, { x: 0.7, y, w: 4.3, h: 0.4, fontFace: FONT_HEAD, fontSize: 13, bold: true, color: PAPER, align: "left", margin: 0 });
      s.addShape("roundRect", { x: 0.7, y: y + 0.42, w: 4.3, h: 0.22, rectRadius: 0.11, fill: { color: "1C2138" }, line: { type: "none" } });
      s.addShape("roundRect", { x: 0.7, y: y + 0.42, w: 4.3 * (r.pct / 46), h: 0.22, rectRadius: 0.11, fill: { color: barColors[i] }, line: { type: "none" } });
      y += 0.95;
    });

    s.addShape("roundRect", { x: 0.7, y: y + 0.15, w: 4.3, h: 1.0, rectRadius: 0.14, fill: { color: "1C2138" }, line: { color: CORAL, width: 1 } });
    s.addText("סה\"כ חודשי", { x: 1.0, y: y + 0.3, w: 2.2, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: "C6C9DA", align: "right", margin: 0 });
    s.addText("~78,000 ₪", { x: 1.0, y: y + 0.6, w: 3.7, h: 0.45, fontFace: FONT_HEAD, fontSize: 22, bold: true, color: CORAL, align: "right", margin: 0 });

    // right column: growth lever note
    s.addShape("roundRect", { x: 5.7, y: 2.15, w: 6.9, h: 4.55, rectRadius: 0.14, fill: { color: "1C2138" }, line: { type: "none" }, shadow: freshShadow() });
    iconBadgeDark(s, icons.trend, 6.0, 2.45, 0.75, SAGE);
    s.addText("מנוע הצמיחה", { x: 6.9, y: 2.55, w: 5.4, h: 0.4, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: PAPER, align: "right", margin: 0 });
    s.addText(
      "כל הרצה שמדורגת כמוצלחת ע\"י לקוח “דוח חד-פעמי” היא מועמדת טבעית "
      + "להמרה למנוי סוכנות. Enterprise / white-label הוא המנוע המשמעותי ביותר "
      + "להכנסה — לכן שווה להשקיע זמן מכירה ממוקד ב-3‑5 בוטיקי מחקר וסוכנויות "
      + "גדולות, לצד גיוס רחב יותר של לקוחות דוח חד-פעמי כערוץ upsell.",
      { x: 6.05, y: 3.15, w: 6.2, h: 2.2, fontFace: FONT_BODY, fontSize: 12.5, color: "C6C9DA", align: "right", margin: 0, lineSpacingMultiple: 1.4 }
    );
    s.addText(
      "* תמהיל לדוגמה אחד מתוך כמה שמגיעים ליעד — לא תחזית מובטחת.",
      { x: 6.05, y: 5.9, w: 6.2, h: 0.4, fontFace: FONT_BODY, fontSize: 10, italic: true, color: "8A8FA6", align: "right", margin: 0 }
    );
    footer(s, true, 8);
    s.addNotes(
      "תמהיל לדוגמה שמגיע ל-78,000 שקל בחודש: שישה לקוחות במנוי סוכנות בשישה "
      + "אלף שקל, שני לקוחות אנטרפרייז בחמישה עשר אלף שקל, וכשישה דוחות חד "
      + "פעמיים בחודש. זה תמהיל אחד לדוגמה, לא היחיד שמגיע ליעד — אבל הוא "
      + "ריאלי עם מספר לקוחות קטן יחסית."
    );
  }

  // ================= Slide 9 — Go to market =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("כניסה לשוק", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("90 יום ראשונים", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0 });

    const phases = [
      { m: "חודש 1", title: "הוכחת קונספט", body: "3 שאלות ניסיון בחינם ל-10‑15 סוכנויות וצוותי מוצר מוכרים, בתמורה למשוב." },
      { m: "חודש 2", title: "חומר שיווקי", body: "1‑2 case studies אמיתיים (בהסכמת לקוח) שמראים דוח בפועל ואת הפער בין מגזרים." },
      { m: "חודש 3", title: "מכירה ממוקדת", body: "פנייה ישירה למתכנני אסטרטגיה בסוכנויות, ולבוטיקי מחקר שוק לשיתופי פעולה." },
    ];
    const colW = 3.75, gap = 0.35, startX = 0.7, y = 2.1;
    phases.forEach((p, i) => {
      const x = startX + i * (colW + gap);
      s.addShape("roundRect", { x, y: y + 0.25, w: colW, h: 3.6, rectRadius: 0.14, fill: { color: PAPER2 }, line: { type: "none" }, shadow: freshShadow() });
      s.addShape("roundRect", { x: x + colW / 2 - 0.65, y, w: 1.3, h: 0.42, rectRadius: 0.21, fill: { color: NAVY }, line: { type: "none" } });
      s.addText(p.m, { x: x + colW / 2 - 0.65, y, w: 1.3, h: 0.42, fontFace: FONT_BODY, fontSize: 11, bold: true, color: PAPER, align: "center", valign: "middle", margin: 0 });
      s.addText(p.title, { x: x + 0.3, y: y + 0.65, w: colW - 0.6, h: 0.45, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: NAVY, align: "right", margin: 0 });
      s.addText(p.body, { x: x + 0.3, y: y + 1.15, w: colW - 0.6, h: 2.5, fontFace: FONT_BODY, fontSize: 12, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.35 });
    });
    s.addText("יעד ל-90 יום: 4‑6 לקוחות משלמים ראשונים.", {
      x: 0.7, y: 6.15, w: 11.9, h: 0.4, fontFace: FONT_BODY, fontSize: 12.5, bold: true, color: CORAL, align: "right", margin: 0,
    });
    footer(s, false, 9);
    s.addNotes(
      "תוכנית 90 היום הראשונים: חודש ראשון להוכחת קונספט עם דמו חינמי, חודש "
      + "שני להכנת חומר שיווקי מבוסס מקרים אמיתיים, וחודש שלישי למכירה ממוקדת. "
      + "היעד: 4 עד 6 לקוחות משלמים ראשונים כאימות שהמודל עובד."
    );
  }

  // ================= Slide 10 — Trust / disclosure =================
  {
    const s = pres.addSlide();
    s.background = { color: PAPER };
    s.addText("אמינות", { x: 0.7, y: 0.55, w: 4, h: 0.4, fontFace: FONT_BODY, fontSize: 13, bold: true, color: CORAL, charSpacing: 2, align: "right", margin: 0 });
    s.addText("חשוב לדעת", { x: 0.7, y: 0.95, w: 11.9, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: NAVY, align: "right", margin: 0 });

    s.addShape("roundRect", { x: 0.7, y: 2.0, w: 11.9, h: 3.9, rectRadius: 0.14, fill: { color: PAPER2 }, line: { type: "none" }, shadow: freshShadow() });
    iconBadge(s, icons.shield, 10.9, 2.4, 1.1, GOLD);
    s.addText(
      "דופק מבוסס על סימולציית בינה מלאכותית של פרופילים מגוונים — זה לא סקר "
      + "דעת קהל רשמי ולא מדגם אקראי מייצג סטטיסטית.",
      { x: 1.1, y: 2.35, w: 9.3, h: 0.95, fontFace: FONT_HEAD, fontSize: 16, bold: true, color: NAVY, align: "right", margin: 0, lineSpacingMultiple: 1.3 }
    );
    s.addText(
      "זהו כלי לגיבוש אינטואיציה מהירה לפני החלטה — לא תחליף למחקר שוק מוסמך, "
      + "לסקר דעת קהל, או לייעוץ משפטי/רגולטורי. כל דוח שיוצא מהמערכת כולל את "
      + "ההבהרה הזו במפורש, וכך גם כל חוזה לקוח.\n\n"
      + "לא מתאים כתחליף לסקר פוליטי רשמי או ככלי לקמפיינים פוליטיים בפועל.",
      { x: 1.1, y: 3.35, w: 9.3, h: 2.35, fontFace: FONT_BODY, fontSize: 12.5, color: INK_SOFT, align: "right", margin: 0, lineSpacingMultiple: 1.4 }
    );
    footer(s, false, 10);
    s.addNotes(
      "שקיפות היא חלק מהמוצר, לא רק הערת שוליים: דופק הוא כלי סימולציה מבוסס "
      + "AI, לא סקר רשמי. אנחנו אומרים את זה בכל דוח ובכל חוזה, ולא ממליצים "
      + "להשתמש בו ככלי יחיד לקמפיינים פוליטיים בפועל."
    );
  }

  // ================= Slide 11 — Closing / CTA (dark) =================
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addShape("ellipse", { x: -2.4, y: -2.6, w: 6.5, h: 6.5, fill: { color: "1A2038" }, line: { type: "none" } });

    drawAvatarMark(s, 3.0, 3.4, 1.35, true);
    s.addText("מאי", { x: 1.5, y: 5.0, w: 3, h: 0.4, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: PAPER, align: "center", margin: 0 });
    s.addText("הנציגה הדיגיטלית של דופק", { x: 0.9, y: 5.4, w: 4.2, h: 0.4, fontFace: FONT_BODY, fontSize: 10.5, color: "9DA2B8", align: "center", margin: 0 });

    s.addText("מוכנים לבדוק את הדופק?", { x: 5.6, y: 2.15, w: 7.0, h: 0.9, fontFace: FONT_HEAD, fontSize: 32, bold: true, color: PAPER, align: "right", margin: 0 });
    s.addText("3 שאלות ניסיון ראשונות — בחינם, בלי התחייבות.", { x: 5.6, y: 2.95, w: 7.0, h: 0.5, fontFace: FONT_BODY, fontSize: 14, color: "C6C9DA", align: "right", margin: 0 });

    iconBadgeDark(s, icons.mail, 5.6, 3.75, 0.6, CORAL);
    s.addText("hello@dofek.co.il", { x: 6.35, y: 3.8, w: 4.5, h: 0.5, fontFace: FONT_HEAD, fontSize: 15, bold: true, color: PAPER, align: "right", margin: 0 });

    s.addText(
      "הערה טכנית: כדי להפוך את המצגת הזו לווידאו עם אווטאר AI מדבר — יש "
      + "להעתיק את הטקסט מהערות הדובר (Speaker Notes) של כל שקופית לכלי כמו "
      + "HeyGen / Synthesia / Colossyan, לבחור אווטאר ולהפיק את הסרטון.",
      { x: 5.6, y: 4.7, w: 7.0, h: 1.4, fontFace: FONT_BODY, fontSize: 10.5, italic: true, color: "7D8296", align: "right", margin: 0, lineSpacingMultiple: 1.35 }
    );
    footer(s, true, 11);
    s.addNotes(
      "תודה שהקשבתם. מוכנים לבדוק את הדופק של הקהל שלכם? כתבו לנו ל-"
      + "hello@dofek.co.il ונתחיל עם שלוש שאלות ניסיון ראשונות, בחינם וללא "
      + "התחייבות."
    );
  }

  const outPath = path.join(__dirname, "dofek-pitch-deck.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("Wrote " + outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
